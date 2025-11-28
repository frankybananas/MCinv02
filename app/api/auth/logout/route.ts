import { NextResponse } from 'next/server';
import { connect } from '@/lib/mongodb';
import Session from '@/models/Session';
import { getSession } from '@/lib/auth-session';
import { formatHttpError, isHttpError } from '@/lib/errors';
import { logAuthEvent, getClientIp, getDeviceType } from '@/lib/audit-logger';

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

    // Log logout event
    const ua = request.headers.get('user-agent') || 'unknown';
    const phone = session?.payload?.phone as string || 'unknown';
    const userId = session?.payload?.userId as string || undefined;
    logAuthEvent({
      event: 'logout',
      phone,
      userId,
      ip: getClientIp(request),
      userAgent: ua,
      deviceType: getDeviceType(ua),
      success: true,
    });

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
