import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connect as connectDb } from '@/lib/mongodb';
import User from '@/models/User';
import FacebookAuth from '@/models/FacebookAuth';
import { encryptToken, decryptToken } from '@/lib/encryption';
import axios from 'axios';

/**
 * Select Facebook page for posting
 * 
 * POST /api/facebook/auth/select-page
 * 
 * Allows user to choose between personal profile or a specific business page.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await requireSession(request);
    const userPhone = session.phone;

    const body = await request.json();
    const { accountType, pageId } = body;

    // Validate input
    if (!accountType || !['personal', 'business_page'].includes(accountType)) {
      return NextResponse.json(
        { error: 'Invalid account type. Must be "personal" or "business_page"' },
        { status: 400 }
      );
    }

    if (accountType === 'business_page' && !pageId) {
      return NextResponse.json(
        { error: 'Page ID is required for business_page account type' },
        { status: 400 }
      );
    }

    await connectDb();

    // Find user
    const user = await User.findOne({ phone: userPhone });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get Facebook auth with tokens
    const fbAuth = await FacebookAuth.findOne({ userId: user._id }).select('+accessToken +facebookPageAccessToken');
    if (!fbAuth) {
      return NextResponse.json(
        { error: 'Facebook not connected. Please connect your Facebook account first.' },
        { status: 404 }
      );
    }

    // Decrypt user's access token
    const userAccessToken = decryptToken(fbAuth.accessToken);

    if (accountType === 'business_page') {
      // Fetch page details from Facebook
      const FACEBOOK_GRAPH_API_VERSION = process.env.FACEBOOK_GRAPH_API_VERSION || 'v18.0';
      const pageUrl = `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}/${pageId}`;
      
      try {
        const pageResponse = await axios.get(pageUrl, {
          params: {
            access_token: userAccessToken,
            fields: 'id,name,access_token,category'
          }
        });

        const pageData = pageResponse.data;

        // Encrypt page access token
        const encryptedPageToken = encryptToken(pageData.access_token);

        // Update Facebook auth with page details
        fbAuth.accountType = 'business_page';
        fbAuth.facebookPageId = pageData.id;
        fbAuth.facebookPageName = pageData.name;
        fbAuth.facebookPageAccessToken = encryptedPageToken;
        await fbAuth.save();

        // Update user
        user.facebookAccountType = 'business_page';
        await user.save();

        console.log(`[Facebook Auth] Selected business page for user ${userPhone}: ${pageData.name}`);

        return NextResponse.json({
          success: true,
          accountType: 'business_page',
          pageName: pageData.name,
          pageId: pageData.id
        });

      } catch (error) {
        console.error('[Facebook Auth Select Page] Error fetching page:', error);
        return NextResponse.json(
          { error: 'Failed to fetch page details. Please ensure you have access to this page.' },
          { status: 400 }
        );
      }

    } else {
      // Personal account selected
      fbAuth.accountType = 'personal';
      fbAuth.facebookPageId = undefined;
      fbAuth.facebookPageName = undefined;
      fbAuth.facebookPageAccessToken = undefined;
      await fbAuth.save();

      // Update user
      user.facebookAccountType = 'personal';
      await user.save();

      console.log(`[Facebook Auth] Selected personal account for user ${userPhone}`);

      return NextResponse.json({
        success: true,
        accountType: 'personal'
      });
    }

  } catch (error) {
    console.error('[Facebook Auth Select Page] Error:', error);
    return NextResponse.json(
      { error: 'Failed to select page' },
      { status: 500 }
    );
  }
}
