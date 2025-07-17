import { NextResponse, NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Removed Session DB lookup in middleware to maintain Edge-compatibility

// Paths that do not require authentication
const PUBLIC_PATHS = [
  '/auth',
  '/api/auth',
  '/_next',
  '/favicon',
  '/docs',
];

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
    
    const response = NextResponse.next();
    response.headers.set('x-user-phone', payload.phone as string);
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
