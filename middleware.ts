import { NextResponse, NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Removed Session DB lookup in middleware to maintain Edge-compatibility

// Paths that do not require authentication
const PUBLIC_PATHS = [
  '/auth',
  '/api/auth',
  '/_next',
  '/favicon',
  '/favicon.ico',
  '/manifest.json',
  '/manifest.webmanifest',
  '/halfway-logo.png',
  '/placeholder-logo.png',
  '/placeholder.svg',
  '/docs',
];

const ADMIN_PATHS = ['/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public assets and auth routes
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('session_token')?.value;
  const jwtSecret = process.env.JWT_SECRET;

  if (!token || !jwtSecret) {
    return redirectToLogin(request);
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);

    // Enforce daily OTP: if the token's otpDay is not today (ZA timezone), force re-auth
    const nowUtc = new Date();
    const zaNow = new Date(nowUtc.toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }));
    const todayZa = zaNow.toISOString().slice(0, 10);
    const tokenOtpDay = (payload as any).otpDay as string | undefined;
    if (!tokenOtpDay || tokenOtpDay !== todayZa) {
      // Clear cookie and redirect to login for fresh OTP
      const res = redirectToLogin(request);
      res.cookies.delete('session_token');
      return res;
    }

    // Role-based authorization for admin panel
    if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
      if (payload.role !== 'admin') {
        // Redirect non-admins away from admin pages to the dashboard
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
    }

    const response = NextResponse.next();
    response.headers.set('x-user-phone', payload.phone as string);
    response.headers.set('x-user-role', payload.role as string);
    return response;

  } catch (err) {
    // Invalid / expired JWT
    return redirectToLogin(request);
  }

  // Skipping database session validation inside middleware because Mongoose is not
  // supported in edge runtime yet. Rely on JWT validity alone; session cleanup
  // still runs server-side via cron.


}

function redirectToLogin(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/auth/login';
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // TEMP: disable middleware matching to verify it isn't interfering with dev chunks
  matcher: [],
};
