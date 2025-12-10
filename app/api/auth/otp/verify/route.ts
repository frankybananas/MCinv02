import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import parsePhoneNumber from 'libphonenumber-js';
import { connect } from '@/lib/mongodb';
import User from '@/models/User';
import Session from '@/models/Session';
import { getTestOtp, getTestPhoneNumbers } from '@/lib/test-accounts';
import { Twilio } from 'twilio';
import { checkOtpBlock, recordOtpFailure, resetOtpBlock } from '@/lib/rate-limit';
import { TooManyRequestsError } from '@/lib/errors';
import { logAuthEvent, getClientIp, getDeviceType } from '@/lib/audit-logger';

export async function POST(request: Request) {
  const jwtSecret = process.env.JWT_SECRET;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!jwtSecret || !accountSid || !authToken || !verifyServiceSid) {
    const missing: string[] = [];
    if (!jwtSecret) missing.push('JWT_SECRET');
    if (!accountSid) missing.push('TWILIO_ACCOUNT_SID');
    if (!authToken) missing.push('TWILIO_AUTH_TOKEN');
    if (!verifyServiceSid) missing.push('TWILIO_VERIFY_SERVICE_SID');
    const detail = !process.env.NODE_ENV || process.env.NODE_ENV !== 'production' ? `Missing ${missing.join(', ')}` : undefined;
    console.error('OTP verify configuration missing.', detail || '');
    return NextResponse.json({ error: 'Server configuration error.', detail }, { status: 500 });
  }

  const client = new Twilio(accountSid, authToken);

  try {
    const { phone: rawPhone, code } = await request.json();

    if (!rawPhone || !code) {
      return NextResponse.json({ error: 'Phone number and code are required' }, { status: 400 });
    }

    const phoneNumber = parsePhoneNumber(rawPhone, 'ZA');
    if (!phoneNumber || !phoneNumber.isValid()) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }
    const phone = phoneNumber.format('E.164');

    // Reject test phone numbers in production
    if (process.env.NODE_ENV === 'production' && getTestPhoneNumbers().includes(phone)) {
      return NextResponse.json({ error: 'This phone number is not allowed.' }, { status: 403 });
    }

    // Progressive blocking: check if phone is blocked
    await checkOtpBlock(phone);

    // 1. Handle test accounts by checking the code directly (non-production only)
    const testOtp = getTestOtp(phone);
    let isApproved = false;

    if (testOtp) {
      if (code === testOtp) {
        isApproved = true;
        if (process.env.NODE_ENV !== 'production') {
          console.log(`Test OTP verification successful for ${phone}`);
        }
      } else {
        // Record failed attempt for progressive blocking
        await recordOtpFailure(phone);
        const ua = request.headers.get('user-agent') || 'unknown';
        logAuthEvent({
          event: 'login_failure',
          phone,
          ip: getClientIp(request),
          userAgent: ua,
          deviceType: getDeviceType(ua),
          success: false,
          reason: 'Invalid test OTP',
        });
        return NextResponse.json({ success: false, error: 'Invalid test OTP.' }, { status: 400 });
      }
    } else {
      // For real users, verify using Twilio Verify
      const verificationCheck = await client.verify.v2.services(verifyServiceSid)
        .verificationChecks
        .create({ to: phone, code });
      if (verificationCheck.status === 'approved') {
        isApproved = true;
      } else {
        // Record failed attempt for progressive blocking
        await recordOtpFailure(phone);
        const ua = request.headers.get('user-agent') || 'unknown';
        logAuthEvent({
          event: 'login_failure',
          phone,
          ip: getClientIp(request),
          userAgent: ua,
          deviceType: getDeviceType(ua),
          success: false,
          reason: 'Invalid OTP',
        });
        return NextResponse.json({ success: false, error: 'Invalid OTP.' }, { status: 400 });
      }
    }

    // 2. If approved, proceed with session creation
    if (isApproved) {
      await connect();

      // Reset progressive blocking on successful login
      await resetOtpBlock(phone);

      // 3. Find user and enforce device limits
      const user = await User.findOne({ phone });
      if (!user) {
        // This case should not be reached if the `send` route is working correctly
        return NextResponse.json({ error: 'User not found after OTP verification.' }, { status: 404 });
      }

      const ua = request.headers.get('user-agent') || '';
      const deviceType: 'mobile' | 'desktop' = /android|iphone|ipad|mobile/i.test(ua) ? 'mobile' : 'desktop';

      const activeSessions = await Session.find({ phoneNumber: phone, isActive: true }).sort({ createdAt: 1 });
      const sessionsByType = {
        mobile: activeSessions.filter((s: any) => s.deviceType === 'mobile'),
        desktop: activeSessions.filter((s: any) => s.deviceType === 'desktop'),
      };

      // Block login only if user already has 2 active sessions (1 mobile, 1 desktop)
      if (sessionsByType.mobile.length >= 1 && sessionsByType.desktop.length >= 1) {
        // And the current login attempt is from a new device type (which is impossible, but good practice)
        if (!sessionsByType[deviceType] || sessionsByType[deviceType].length === 0) {
            return NextResponse.json({ success: false, error: 'Device limit of 2 (1 mobile, 1 desktop) reached.' }, { status: 403 });
        }
      }

      // If a session of the same type already exists, deactivate it.
      if (sessionsByType[deviceType].length >= 1) {
        const oldestSession = sessionsByType[deviceType][0]; // Already sorted by date
        await Session.findByIdAndUpdate(oldestSession._id, { isActive: false });
      }

      // 4. Create a JWT to manage the session
      const jwtId = uuidv4();
      const secret = new TextEncoder().encode(jwtSecret);

      // Store the timestamp when OTP was verified for 7-day validation
      const now = new Date();
      const lastOtpAt = now.getTime(); // Unix timestamp in milliseconds

      const token = await new SignJWT({ phone: user.phone, userId: String(user._id), role: user.role, lastOtpAt })
        .setProtectedHeader({ alg: 'HS256' })
        .setJti(jwtId)
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret);

      // 5. Create a new session record with device tracking
      const newSession = new Session({
        phoneNumber: phone,
        userId: user._id,
        jwtId: jwtId,
        deviceType,
        lastOtpAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
        userAgent: ua,
        ipAddress: request.headers.get('x-forwarded-for') || 'Unknown',
      });
      await newSession.save();

      // 6. Log successful login
      logAuthEvent({
        event: 'login_success',
        phone,
        userId: String(user._id),
        ip: getClientIp(request),
        userAgent: ua,
        deviceType,
        success: true,
      });

      // 7. Create the response and set the cookie
      const response = NextResponse.json({ success: true, message: 'OTP verified successfully.', user: { role: user.role } });
      response.cookies.set('session_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
        sameSite: 'lax' // Lax allows cookie on top-level navigation (PWA reopening)
      });

      return response;
    } else {
      return NextResponse.json({ success: false, error: 'Invalid OTP.' }, { status: 400 });
    }

  } catch (error) {
    // Handle rate limit errors
    if (error instanceof TooManyRequestsError) {
      logAuthEvent({
        event: 'blocked',
        phone: 'unknown',
        ip: getClientIp(request),
        userAgent: request.headers.get('user-agent') || 'unknown',
        success: false,
        reason: error.message,
      });
      return NextResponse.json({ success: false, error: error.message }, { status: 429 });
    }
    console.error('Error verifying OTP:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    const isDev = process.env.NODE_ENV !== 'production';
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to verify OTP.', 
      details: isDev ? errorMessage : undefined 
    }, { status: 500 });
  }
}
