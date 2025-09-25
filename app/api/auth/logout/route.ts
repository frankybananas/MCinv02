import { NextResponse } from 'next/server';
import { connect } from '@/lib/mongodb';
import Session from '@/models/Session';
import { getSession } from '@/lib/auth-session';
import { formatHttpError, isHttpError } from '@/lib/errors';

const COOKIE_NAME = 'session_token';

export async function POST(request: Request) {
  try {
    const session = await getSession(request);

    if (session?.payload && typeof session.payload.jti === 'string') {
      try {
        await connect();
        await Session.findOneAndUpdate(
          { jwtId: session.payload.jti, isActive: true },
          { isActive: false, lastAccessedAt: new Date() }
        );
      } catch (updateError) {
        console.warn('Logout session cleanup failed:', updateError instanceof Error ? updateError.message : updateError);
      }
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
    response.cookies.set(COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: new Date(0),
      path: '/',
    });

    return response;
  } catch (err: unknown) {
    if (isHttpError(err)) {
      return NextResponse.json(formatHttpError(err), { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Failed to logout.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
