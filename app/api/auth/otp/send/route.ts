import { NextResponse } from 'next/server';
import { Twilio } from 'twilio';
import parsePhoneNumber from 'libphonenumber-js';
import User from '@/models/User';
import { connect } from '@/lib/mongodb';
import { createTestUser, getTestOtp, getTestPhoneNumbers } from '@/lib/test-accounts';
import { checkOtpRateLimit } from '@/lib/rate-limit';
import { TooManyRequestsError } from '@/lib/errors';
import { logAuthEvent, getClientIp, getDeviceType } from '@/lib/audit-logger';

export async function POST(req: Request) {
  try {
    await connect();
    const { phone: rawPhone } = await req.json();

    if (!rawPhone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Default to South Africa, but libphonenumber-js is smart enough to handle international numbers
    const phoneNumber = parsePhoneNumber(rawPhone, 'ZA'); 
    
    if (!phoneNumber || !phoneNumber.isValid()) {
      return NextResponse.json({ error: 'Invalid or unsupported phone number format' }, { status: 400 });
    }

    const phone = phoneNumber.format('E.164'); // Normalize to E.164

    // Reject test phone numbers in production
    if (process.env.NODE_ENV === 'production' && getTestPhoneNumbers().includes(phone)) {
      return NextResponse.json({ error: 'This phone number is not allowed.' }, { status: 403 });
    }

    // Rate limiting: max 5 sends per phone per hour
    await checkOtpRateLimit(phone, 'send');

    // Handle test accounts (non-production only)
    const testOtp = getTestOtp(phone);
    if (testOtp) {
      await createTestUser(phone); // Ensure test user exists
      // SECURITY: Only log OTP to server console, never expose in response
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[TEST OTP] Phone: ${phone}, Code: ${testOtp}`);
      }
      return NextResponse.json({ success: true, message: 'Test OTP sent' });
    }

    // For real users, check if they exist in the database
    const user = await User.findOne({ phone });
    if (!user) {
      return NextResponse.json({ error: 'This phone number is not authorized.' }, { status: 403 });
    }
    
    // Check if user is authorized
    if (!user.isAuthorized) {
      return NextResponse.json({ error: 'This account is not authorized to login.' }, { status: 403 });
    }

    // Use Twilio Verify to send OTP
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    if (!accountSid || !authToken || !verifyServiceSid) {
      const missing: string[] = [];
      if (!accountSid) missing.push('TWILIO_ACCOUNT_SID');
      if (!authToken) missing.push('TWILIO_AUTH_TOKEN');
      if (!verifyServiceSid) missing.push('TWILIO_VERIFY_SERVICE_SID');
      const detail = !process.env.NODE_ENV || process.env.NODE_ENV !== 'production' ? `Missing ${missing.join(', ')}` : undefined;
      console.error('Twilio Verify is not fully configured.', detail || '');
      return NextResponse.json({ error: 'Server configuration error.', detail }, { status: 500 });
    }

    const twilioClient = new Twilio(accountSid, authToken);
    await twilioClient.verify.v2.services(verifyServiceSid)
      .verifications
      .create({ to: phone, channel: 'sms' });

    // Log successful OTP send
    const userAgent = req.headers.get('user-agent') || 'unknown';
    logAuthEvent({
      event: 'otp_sent',
      phone,
      userId: String(user._id),
      ip: getClientIp(req),
      userAgent,
      deviceType: getDeviceType(userAgent),
      success: true,
    });

    return NextResponse.json({ success: true, message: 'OTP sent successfully.' });

  } catch (error) {
    // Handle rate limit errors
    if (error instanceof TooManyRequestsError) {
      // Log rate limit event
      logAuthEvent({
        event: 'rate_limited',
        phone: 'unknown',
        ip: getClientIp(req),
        userAgent: req.headers.get('user-agent') || 'unknown',
        success: false,
        reason: error.message,
      });
      return NextResponse.json({ success: false, error: error.message }, { status: 429 });
    }
    console.error('Error in /api/auth/otp/send:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV !== 'production';
    return NextResponse.json({ 
      success: false,
      error: 'Failed to send OTP.', 
      details: isDev ? errorMessage : undefined 
    }, { status: 500 });
  }
}
