import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connect as connectDb } from '@/lib/mongodb';
import User from '@/models/User';
import FacebookAuth from '@/models/FacebookAuth';

/**
 * Check Facebook connection status
 * 
 * GET /api/facebook/auth/status
 * 
 * Returns user's Facebook connection status and details.
 */
export async function GET(request: NextRequest) {
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

    // Check if Facebook is connected
    if (!user.facebookConnected) {
      return NextResponse.json({
        connected: false,
        accountType: null,
        lastSynced: null
      });
    }

    // Get Facebook auth details
    const fbAuth = await FacebookAuth.findOne({ userId: user._id });
    
    if (!fbAuth || !fbAuth.isActive) {
      // Update user status if auth not found or inactive
      user.facebookConnected = false;
      await user.save();
      
      return NextResponse.json({
        connected: false,
        accountType: null,
        lastSynced: null
      });
    }

    // Check if token is expired
    const isExpired = fbAuth.expiresAt < new Date();

    return NextResponse.json({
      connected: true,
      accountType: fbAuth.accountType,
      facebookPageName: fbAuth.facebookPageName || null,
      lastSynced: user.facebookLastSyncedAt,
      isExpired,
      expiresAt: fbAuth.expiresAt,
      grantedPermissions: fbAuth.grantedPermissions
    });

  } catch (error) {
    console.error('[Facebook Auth Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check Facebook status' },
      { status: 500 }
    );
  }
}
