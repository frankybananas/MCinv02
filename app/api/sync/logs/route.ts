import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connectToDatabase } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSession(request);

    const allowedRoles = ['admin', 'manager'];
    if (!session.role || !allowedRoles.includes(session.role)) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    await connectToDatabase();

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '20', 10)));
    const skip = (page - 1) * limit;

    const SyncLog = (await import('@/models/SyncLog')).default;

    const [logs, total] = await Promise.all([
      SyncLog.find({}).sort({ startedAt: -1 }).skip(skip).limit(limit).lean(),
      SyncLog.countDocuments({}),
    ]);

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Sync Logs] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch sync logs';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
