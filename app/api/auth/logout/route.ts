import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { connectToDatabase } from '@/lib/mongodb';
import Session from '@/models/Session';

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;

    if (token) {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not defined');
      }

            try {
        const secret = new TextEncoder().encode(jwtSecret);
        const { payload } = await jwtVerify(token, secret);
        const jti = payload.jti;

        if (jti) {
          await Session.findOneAndUpdate(
            { jwtId: jti, isActive: true },
            { isActive: false, lastAccessedAt: new Date() }
          );
        }
      } catch (error) {
        // If token is invalid or expired, we can just clear it
        console.warn('Error verifying token on logout, clearing cookie anyway:', error);
      }
    }

    // Clear the cookie
    const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
    response.cookies.set('session_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: new Date(0), // Set expiry to the past
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ success: false, error: 'Failed to logout.', details: errorMessage }, { status: 500 });
  }
}
