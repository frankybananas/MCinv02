import { NextResponse, NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Removed Session DB lookup in middleware to maintain Edge-compatibility

// Paths that do not require authentication
const PUBLIC_PATHS = [
  '/auth',
  '/api/auth',
  '/_next',
  '/favicon',
  '/manifest.webmanifest',
  '/docs',
];

const ADMIN_PATHS = ['/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log(`\n[Middleware] Processing request for: ${pathname}`);

  // Skip public assets and auth routes
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    console.log(`[Middleware] Path is public, skipping auth.`);
    return NextResponse.next();
  }

  const token = request.cookies.get('session_token')?.value;
  const jwtSecret = process.env.JWT_SECRET;

  if (!token) {
    console.log('[Middleware] No session token found. Redirecting to login.');
    return redirectToLogin(request);
  }

  if (!jwtSecret) {
    console.error('[Middleware] JWT_SECRET is not defined. Redirecting to login.');
    return redirectToLogin(request);
  }

  try {
    console.log('[Middleware] Token found, attempting to verify...');
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    console.log('[Middleware] JWT verification successful. Payload:', payload);

    // Role-based authorization for admin panel
    if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
      console.log(`[Middleware] Path is an admin path. Checking role...`);
      if (payload.role !== 'admin') {
        console.log(`[Middleware] User role is '${payload.role}'. Redirecting non-admin from admin page.`);
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
      console.log(`[Middleware] User is admin. Allowing access.`);
    }

    console.log('[Middleware] Attaching user headers and allowing request.');
    const response = NextResponse.next();
    response.headers.set('x-user-phone', payload.phone as string);
    response.headers.set('x-user-role', payload.role as string);
    return response;

  } catch (err) {
    console.error('[Middleware] JWT verification failed:', err);
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
