import { NextRequest, NextResponse } from 'next/server';
import { connect as connectDb } from '@/lib/mongodb';
import User from '@/models/User';
import FacebookAuth from '@/models/FacebookAuth';
import { encryptToken } from '@/lib/encryption';
import axios from 'axios';

/**
 * Facebook OAuth2 callback handler
 * 
 * GET /api/facebook/auth/callback
 * 
 * Receives authorization code from Facebook, exchanges it for access token,
 * fetches user's pages, and stores encrypted tokens in database.
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle Facebook OAuth errors
    if (error) {
      console.error('[Facebook OAuth Callback] Facebook error:', error, errorDescription);
      return NextResponse.redirect(
        `${baseUrl}/profile?error=facebook_${error}&message=${encodeURIComponent(errorDescription || 'Unknown error')}`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('[Facebook OAuth Callback] Missing code or state');
      return NextResponse.redirect(
        `${baseUrl}/profile?error=invalid_callback`
      );
    }

    // Verify CSRF state token
    const storedState = request.cookies.get('fb_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      console.error('[Facebook OAuth Callback] State mismatch - possible CSRF attack');
      return NextResponse.redirect(
        `${baseUrl}/profile?error=invalid_state`
      );
    }

    // Get user phone from cookie
    const userPhone = request.cookies.get('fb_oauth_user')?.value;
    if (!userPhone) {
      console.error('[Facebook OAuth Callback] User phone not found in cookie');
      return NextResponse.redirect(
        `${baseUrl}/profile?error=session_expired`
      );
    }

    // Validate environment variables
    const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
    const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
    const FACEBOOK_GRAPH_API_VERSION = process.env.FACEBOOK_GRAPH_API_VERSION || 'v18.0';

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
      console.error('[Facebook OAuth Callback] Missing Facebook credentials');
      return NextResponse.redirect(
        `${baseUrl}/profile?error=server_config_error`
      );
    }

    // Exchange authorization code for access token
    const redirectUri = `${baseUrl}/api/facebook/auth/callback`;
    const tokenUrl = `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}/oauth/access_token`;
    
    const tokenResponse = await axios.get(tokenUrl, {
      params: {
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        redirect_uri: redirectUri,
        code
      }
    });

    const { access_token, token_type, expires_in } = tokenResponse.data;

    if (!access_token) {
      console.error('[Facebook OAuth Callback] No access token received');
      return NextResponse.redirect(
        `${baseUrl}/profile?error=token_exchange_failed`
      );
    }

    // Fetch user's Facebook pages
    const pagesUrl = `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}/me/accounts`;
    const pagesResponse = await axios.get(pagesUrl, {
      params: {
        access_token,
        fields: 'id,name,access_token,category,tasks'
      }
    });

    const pages = pagesResponse.data.data || [];

    // Fetch user's basic info
    const userInfoUrl = `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}/me`;
    const userInfoResponse = await axios.get(userInfoUrl, {
      params: {
        access_token,
        fields: 'id,name,email'
      }
    });

    const facebookUserId = userInfoResponse.data.id;

    // Fetch granted permissions
    const permissionsUrl = `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}/me/permissions`;
    const permissionsResponse = await axios.get(permissionsUrl, {
      params: { access_token }
    });

    const grantedPermissions = permissionsResponse.data.data
      .filter((p: any) => p.status === 'granted')
      .map((p: any) => p.permission);

    // Connect to database
    await connectDb();

    // Find user
    const user = await User.findOne({ phone: userPhone });
    if (!user) {
      console.error('[Facebook OAuth Callback] User not found:', userPhone);
      return NextResponse.redirect(
        `${baseUrl}/profile?error=user_not_found`
      );
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + (expires_in * 1000));

    // Encrypt access token
    const encryptedToken = encryptToken(access_token);

    // Determine account type (default to personal if no pages)
    const accountType = pages.length > 0 ? 'business_page' : 'personal';

    // Store or update Facebook auth
    await FacebookAuth.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        accessToken: encryptedToken,
        tokenType: token_type || 'Bearer',
        expiresAt,
        accountType,
        facebookUserId,
        grantedPermissions,
        isActive: true,
        lastUsed: new Date()
      },
      { upsert: true, new: true }
    );

    // Update user's Facebook connection status
    user.facebookConnected = true;
    user.facebookAccountType = accountType;
    user.facebookLastSyncedAt = new Date();
    await user.save();

    console.log(`[Facebook OAuth Callback] Successfully connected Facebook for user: ${userPhone}`);

    // Create response with redirect
    const response = NextResponse.redirect(
      `${baseUrl}/profile?success=facebook_connected&pages=${pages.length}`
    );

    // Clear OAuth cookies
    response.cookies.delete('fb_oauth_state');
    response.cookies.delete('fb_oauth_user');

    return response;

  } catch (error) {
    console.error('[Facebook OAuth Callback] Error:', error);
    
    // Clear OAuth cookies on error
    const response = NextResponse.redirect(
      `${baseUrl}/profile?error=oauth_callback_failed`
    );
    response.cookies.delete('fb_oauth_state');
    response.cookies.delete('fb_oauth_user');
    
    return response;
  }
}
