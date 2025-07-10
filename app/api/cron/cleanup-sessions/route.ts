import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Session from '@/models/Session';

// Simple cleanup route to deactivate sessions whose expiresAt is in the past.
// You can hit this route via a scheduled cron job (e.g. Vercel cron) daily.
// It does not require auth because it should not be publicly exposed; restrict via deployment settings.
export async function GET() {
  try {
    await connectToDatabase();
    const result = await Session.updateMany(
      { expiresAt: { $lte: new Date() }, isActive: true },
      { isActive: false }
    );
    return NextResponse.json({ success: true, modified: result.modifiedCount });
  } catch (error) {
    return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
  }
}
