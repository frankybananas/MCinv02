import { NextResponse } from 'next/server';
import twilio from 'twilio';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { connectToDatabase } from '@/lib/mongodb';
import Session from '@/models/Session';

export async function POST(request: Request) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  const jwtSecret = process.env.JWT_SECRET;

  if (!accountSid || !authToken || !verifyServiceSid || !jwtSecret) {
    console.error('Server environment variables are not fully configured.');
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
      await connectToDatabase();

      // 3. Check for concurrent sessions
      const existingSessions = await Session.find({ phoneNumber: phone, isActive: true });
      if (existingSessions.length > 0) {
        console.warn(`Concurrent session detected for ${phone}. Active sessions: ${existingSessions.length}`);
        // Depending on business logic, you might want to invalidate old sessions here.
        // For now, we'll just log it.
      }

      // 4. Create a JWT to manage the session
      const jwtId = uuidv4();
      const token = jwt.sign({ phone }, jwtSecret, { expiresIn: '7d', jwtid: jwtId });

      // 5. Create a new session record
      const newSession = new Session({
        phoneNumber: phone,
        jwtId: jwtId,
        userAgent: request.headers.get('user-agent') || 'Unknown',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('remote-addr') || 'Unknown',
      });
      await newSession.save();

      // 6. Create the response and set the cookie
      const response = NextResponse.json({ success: true, message: 'OTP verified successfully.' });
      response.cookies.set('session_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
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
