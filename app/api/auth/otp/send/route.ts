import { NextResponse } from 'next/server';
import twilio from 'twilio';

// --- Whitelist of approved phone numbers ---
// IMPORTANT: In a real application, this should come from your database.
const ALLOWED_PHONE_NUMBERS = [
  '+27720560090', // Example number, replace with your test number
  // Add other numbers that are allowed to log in
];

export async function POST(request: Request) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !verifyServiceSid) {
    console.error('Twilio environment variables are not fully configured.');
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  const client = twilio(accountSid, authToken);

  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // 1. Check if the phone number is in the allowed list
    if (!ALLOWED_PHONE_NUMBERS.includes(phone)) {
      return NextResponse.json({ error: 'This phone number is not authorized.' }, { status: 403 });
    }

    // 2. Send the OTP using Twilio Verify
    const verification = await client.verify.v2.services(verifyServiceSid)
      .verifications
      .create({ to: phone, channel: 'sms' });

    console.log('Twilio verification sent:', verification.sid);

    return NextResponse.json({ success: true, message: 'OTP sent successfully.' });

  } catch (error) {
    console.error('Error sending OTP:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to send OTP.', details: errorMessage }, { status: 500 });
  }
}
