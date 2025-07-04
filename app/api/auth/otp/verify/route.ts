import { NextResponse } from 'next/server';
import twilio from 'twilio';

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
    const { phone, code } = await request.json();

    if (!phone || !code) {
      return NextResponse.json({ error: 'Phone number and code are required' }, { status: 400 });
    }

    // 1. Verify the OTP using Twilio Verify
    const verificationCheck = await client.verify.v2.services(verifyServiceSid)
      .verificationChecks
      .create({ to: phone, code: code });

    // 2. Check if the verification was successful
    if (verificationCheck.status === 'approved') {
      // Here you would typically generate a session token (e.g., JWT)
      // and return it to the client to complete the login process.
      return NextResponse.json({ success: true, message: 'OTP verified successfully.' });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid OTP.' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error verifying OTP:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to verify OTP.', details: errorMessage }, { status: 500 });
  }
}
