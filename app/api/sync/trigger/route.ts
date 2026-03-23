import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { runSync } from '@/lib/etoyota/sync-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession(request);

    const allowedRoles = ['admin', 'manager'];
    if (!session.role || !allowedRoles.includes(session.role)) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const result = await runSync('manual');
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Sync Trigger] Error:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
