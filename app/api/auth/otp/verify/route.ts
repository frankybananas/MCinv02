import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import parsePhoneNumber from 'libphonenumber-js';
import { connect } from '@/lib/mongodb';
import User from '@/models/User';
import Session from '@/models/Session';
import { getTestOtp } from '@/lib/test-accounts';
import Otp from '@/models/Otp';

export async function POST(request: Request) {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error('JWT_SECRET is not configured.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

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

    // 1. Handle test accounts by checking the code directly
    const testOtp = getTestOtp(phone);
    let isApproved = false;

    if (testOtp) {
      if (code === testOtp) {
        isApproved = true;
        console.log(`Test OTP verification successful for ${phone}`);
      } else {
        return NextResponse.json({ success: false, error: 'Invalid test OTP.' }, { status: 400 });
      }
    } else {
      // For real users, verify against our stored OTP
      await connect();
      const record = await Otp.findOne({ phone });
      if (!record) {
        return NextResponse.json({ success: false, error: 'No OTP found. Please request a new code.' }, { status: 400 });
      }
      // Increment attempts
      record.attempts = (record.attempts || 0) + 1;
      await record.save();

      if (record.expiresAt < new Date()) {
        return NextResponse.json({ success: false, error: 'OTP expired. Please request a new code.' }, { status: 400 });
      }
      if (record.code !== code) {
        return NextResponse.json({ success: false, error: 'Invalid OTP.' }, { status: 400 });
      }
      isApproved = true;
    }

    // 2. If approved, proceed with session creation
    if (isApproved) {
      await connect();
      // Invalidate OTP on success
      try { await Otp.deleteOne({ phone }); } catch {}

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

      // Compute the current day in the primary usage timezone (Africa/Johannesburg)
      const nowUtc = new Date();
      const zaNow = new Date(nowUtc.toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }));
      const otpDay = zaNow.toISOString().slice(0, 10); // YYYY-MM-DD in ZA tz

      const token = await new SignJWT({ phone: user.phone, userId: user._id, role: user.role, otpDay })
        .setProtectedHeader({ alg: 'HS256' })
        .setJti(jwtId)
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret);

      // 5. Create a new session record with device tracking
      const now = new Date();
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

      // 6. Create the response and set the cookie
      const response = NextResponse.json({ success: true, message: 'OTP verified successfully.', user: { role: user.role } });
      response.cookies.set('session_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
        sameSite: 'lax' // Add sameSite for better compatibility
      });

      return response;
    } else {
      return NextResponse.json({ success: false, error: 'Invalid OTP.' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error verifying OTP:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to verify OTP.', details: errorMessage }, { status: 500 });
  }
}
