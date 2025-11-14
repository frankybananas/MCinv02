import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connect as connectDb } from '@/lib/mongodb';
import User from '@/models/User';
import FacebookAuth from '@/models/FacebookAuth';

/**
 * Disconnect Facebook account
 * 
 * DELETE /api/facebook/auth/disconnect
 * 
 * Removes Facebook connection and deletes stored tokens.
 */
export async function DELETE(request: NextRequest) {
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

    // Delete Facebook auth record
    await FacebookAuth.deleteOne({ userId: user._id });

    // Update user's Facebook connection status
    user.facebookConnected = false;
    user.facebookAccountType = undefined;
    user.facebookLastSyncedAt = undefined;
    await user.save();

    console.log(`[Facebook Auth] Disconnected Facebook for user: ${userPhone}`);

    return NextResponse.json({
      success: true,
      message: 'Facebook account disconnected successfully'
    });

  } catch (error) {
    console.error('[Facebook Auth Disconnect] Error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Facebook account' },
      { status: 500 }
    );
  }
}
