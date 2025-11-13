import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import crypto from 'crypto';

/**
 * Initialize Facebook OAuth2 flow
 * 
 * GET /api/facebook/auth/init
 * 
 * Redirects user to Facebook OAuth dialog with required permissions.
 * Sets CSRF state cookie for security validation in callback.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.phone) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in first.' },
        { status: 401 }
      );
    }

    // Validate required environment variables
    const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
    const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;
    const FACEBOOK_GRAPH_API_VERSION = process.env.FACEBOOK_GRAPH_API_VERSION || 'v18.0';

    if (!FACEBOOK_APP_ID) {
      console.error('FACEBOOK_APP_ID is not configured');
      return NextResponse.redirect(
        `${NEXT_PUBLIC_BASE_URL}/profile?error=facebook_not_configured`
      );
    }

    if (!NEXT_PUBLIC_BASE_URL) {
      console.error('NEXT_PUBLIC_BASE_URL is not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Generate CSRF state token
    const state = crypto.randomUUID();
    
    // Build redirect URI
    const redirectUri = `${NEXT_PUBLIC_BASE_URL}/api/facebook/auth/callback`;
    
    // Facebook OAuth permissions
    const scopes = [
      'public_profile',
      'email',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts'
    ].join(',');
    
    // Build Facebook OAuth URL
    const facebookAuthUrl = new URL(`https://www.facebook.com/${FACEBOOK_GRAPH_API_VERSION}/dialog/oauth`);
    facebookAuthUrl.searchParams.set('client_id', FACEBOOK_APP_ID);
    facebookAuthUrl.searchParams.set('redirect_uri', redirectUri);
    facebookAuthUrl.searchParams.set('state', state);
    facebookAuthUrl.searchParams.set('scope', scopes);
    facebookAuthUrl.searchParams.set('response_type', 'code');
    
    // Create response with redirect
    const response = NextResponse.redirect(facebookAuthUrl.toString());
    
    // Set state cookie for CSRF validation (10 minute expiry)
    response.cookies.set('fb_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/'
    });
    
    // Store user phone for callback verification
    response.cookies.set('fb_oauth_user', session.user.phone, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/'
    });
    
    console.log(`[Facebook OAuth] Initiating OAuth flow for user: ${session.user.phone}`);
    
    return response;
    
  } catch (error) {
    console.error('[Facebook OAuth Init] Error:', error);
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    return NextResponse.redirect(
      `${baseUrl}/profile?error=oauth_init_failed`
    );
  }
}
