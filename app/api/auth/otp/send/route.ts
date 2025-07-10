import { NextResponse } from 'next/server';
import { Twilio } from 'twilio';
import parsePhoneNumber from 'libphonenumber-js';
import User from '@/models/User';
const dbConnect = require('@/lib/mongodb');
import { createTestUser, getTestOtp } from '@/lib/test-accounts';

const twilioClient = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function POST(req: Request) {
  try {
    await dbConnect();
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

    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!verifyServiceSid) {
      console.error('Twilio Verify Service SID is not configured.');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    // Send the OTP using Twilio Verify
    await twilioClient.verify.v2.services(verifyServiceSid)
      .verifications
      .create({ to: phone, channel: 'sms' });

    return NextResponse.json({ success: true, message: 'OTP sent successfully.' });

  } catch (error) {
    console.error('Error in /api/auth/otp/send:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to send OTP.', details: errorMessage }, { status: 500 });
  }
}
