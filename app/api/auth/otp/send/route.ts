import { NextResponse } from 'next/server';
import { Twilio } from 'twilio';
import parsePhoneNumber from 'libphonenumber-js';
import User from '@/models/User';
import { connect } from '@/lib/mongodb';
import { createTestUser, getTestOtp } from '@/lib/test-accounts';
import Otp from '@/models/Otp';

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

    // Handle test accounts
    const testOtp = getTestOtp(phone);
    if (testOtp) {
      await createTestUser(phone); // Ensure test user exists
      console.log(`Test account login for ${phone}. OTP: ${testOtp}`);
      return NextResponse.json({ success: true, message: 'Test OTP sent', testOtp });
    }

    // For real users, check if they exist in the database
    const user = await User.findOne({ phone });
    if (!user) {
      return NextResponse.json({ error: 'This phone number is not authorized.' }, { status: 403 });
    }

    // Generate a 6-digit numeric OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const ttlMinutes = parseInt(process.env.OTP_TTL_MINUTES || '5', 10);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    // Upsert OTP record for this phone
    await Otp.findOneAndUpdate(
      { phone },
      { code, expiresAt, attempts: 0, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    // Compose WebOTP-compliant SMS
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const domain = host.replace(/^https?:\/\//, '');
    const prefix = '<#>'; // Helpful for Android SMS Retriever; harmless otherwise
    const body = `${prefix} Your verification code is ${code}\n@${domain} #${code}`;

    // Send via Twilio Messaging
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken) {
      console.error('Twilio credentials are not configured.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }
    if (!messagingServiceSid && !fromNumber) {
      console.error('Either TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER must be configured.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    const twilioClient = new Twilio(accountSid, authToken);
    await twilioClient.messages.create({
      to: phone,
      body,
      ...(messagingServiceSid ? { messagingServiceSid } : { from: fromNumber as string }),
    });

    return NextResponse.json({ success: true, message: 'OTP sent successfully.' });

  } catch (error) {
    console.error('Error in /api/auth/otp/send:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to send OTP.', details: errorMessage }, { status: 500 });
  }
}
