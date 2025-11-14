import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connect as connectDb } from '@/lib/mongodb';
import User from '@/models/User';
import FacebookAuth from '@/models/FacebookAuth';
import { encryptToken, decryptToken } from '@/lib/encryption';
import axios from 'axios';

/**
 * Refresh Facebook access token
 * 
 * POST /api/facebook/auth/refresh
 * 
 * Exchanges current access token for a new long-lived token.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await requireSession(request);
    const userPhone = session.phone;

    await connectDb();

    // Find user
    const user = await User.findOne({ phone: userPhone });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get Facebook auth with token
    const fbAuth = await FacebookAuth.findOne({ userId: user._id }).select('+accessToken');
    if (!fbAuth) {
      return NextResponse.json(
        { error: 'Facebook not connected' },
        { status: 404 }
      );
    }

    // Validate environment variables
    const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
    const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
    const FACEBOOK_GRAPH_API_VERSION = process.env.FACEBOOK_GRAPH_API_VERSION || 'v18.0';

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
      console.error('[Facebook Auth Refresh] Missing Facebook credentials');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Decrypt current token
    const currentToken = decryptToken(fbAuth.accessToken);

    // Exchange for long-lived token
    const tokenUrl = `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}/oauth/access_token`;
    
    try {
      const tokenResponse = await axios.get(tokenUrl, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: FACEBOOK_APP_ID,
          client_secret: FACEBOOK_APP_SECRET,
          fb_exchange_token: currentToken
        }
      });

      const { access_token, expires_in } = tokenResponse.data;

      if (!access_token) {
        throw new Error('No access token received from Facebook');
      }

      // Calculate new expiry
      const expiresAt = new Date(Date.now() + (expires_in * 1000));

      // Encrypt new token
      const encryptedToken = encryptToken(access_token);

      // Update Facebook auth
      fbAuth.accessToken = encryptedToken;
      fbAuth.expiresAt = expiresAt;
      fbAuth.lastUsed = new Date();
      await fbAuth.save();

      // Update user sync time
      user.facebookLastSyncedAt = new Date();
      await user.save();

      console.log(`[Facebook Auth Refresh] Token refreshed for user: ${userPhone}`);

      return NextResponse.json({
        success: true,
        expiresAt,
        message: 'Token refreshed successfully'
      });

    } catch (error: any) {
      console.error('[Facebook Auth Refresh] Token exchange failed:', error.response?.data || error.message);
      
      // If token is invalid, mark as inactive
      if (error.response?.status === 400 || error.response?.status === 401) {
        fbAuth.isActive = false;
        await fbAuth.save();
        
        user.facebookConnected = false;
        await user.save();
        
        return NextResponse.json(
          { error: 'Token is invalid. Please reconnect your Facebook account.' },
          { status: 401 }
        );
      }

      throw error;
    }

  } catch (error) {
    console.error('[Facebook Auth Refresh] Error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      { status: 500 }
    );
  }
}
