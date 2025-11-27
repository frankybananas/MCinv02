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
const RECON_PATHS = ['/recon'];

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

    // Enforce 7-day OTP: if more than 7 days have passed since lastOtpAt, force re-auth
    const tokenLastOtpAt = (payload as any).lastOtpAt as number | undefined;
    if (!tokenLastOtpAt) {
      // Token missing lastOtpAt (old format), force re-auth
      const res = redirectToLogin(request);
      res.cookies.delete('session_token');
      return res;
    }
    
    const now = Date.now();
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const timeSinceLastOtp = now - tokenLastOtpAt;
    
    if (timeSinceLastOtp >= sevenDaysInMs) {
      // More than 7 days have passed, clear cookie and redirect to login for fresh OTP
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

    // Role-based authorization for recon page
    if (RECON_PATHS.some((p) => pathname.startsWith(p))) {
      const role = String((payload as any).role || '');
      const allowed = role === 'admin' || role === 'manager' || role === 'recon';
      if (!allowed) {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
    }

    // Forward auth-derived headers to downstream handlers via the REQUEST headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-phone', String((payload as any).phone || ''));
    requestHeaders.set('x-user-role', String((payload as any).role || ''));

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      }
    });

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
  // Run on all paths including /api; PUBLIC_PATHS above will early-return for assets and auth
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)|manifest.json|docs|auth/login).*)'],
};
