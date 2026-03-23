import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connectToDatabase } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireSession(request);
    await connectToDatabase();

    const CronRun = (await import('@/models/CronRun')).default;
    const SyncLog = (await import('@/models/SyncLog')).default;
    const Car = (await import('@/models/Car')).default;

    const [cronRun, lastLog, syncCounts] = await Promise.all([
      CronRun.findOne({ job: 'etoyota-sync' }).lean(),
      SyncLog.findOne({ status: 'success' }).sort({ startedAt: -1 }).lean(),
      Car.aggregate([
        {
          $group: {
            _id: null,
            totalSynced: {
              $sum: {
                $cond: [{ $in: ['$syncStatus', ['synced', 'new']] }, 1, 0],
              },
            },
            totalNew: {
              $sum: { $cond: [{ $eq: ['$syncStatus', 'new'] }, 1, 0] },
            },
            totalMissing: {
              $sum: { $cond: [{ $eq: ['$missingFromStock', true] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const counts = syncCounts[0] ?? { totalSynced: 0, totalNew: 0, totalMissing: 0 };

    return NextResponse.json({
      success: true,
      lastSync: cronRun
        ? {
            status: (cronRun as any).status,
            lastRunAt: (cronRun as any).lastRunAt,
            lastSuccessAt: (cronRun as any).lastSuccessAt,
            lastErrorAt: (cronRun as any).lastErrorAt,
            message: (cronRun as any).message,
            durationMs: (cronRun as any).durationMs,
          }
        : null,
      lastSuccessfulSync: lastLog
        ? {
            startedAt: (lastLog as any).startedAt,
            completedAt: (lastLog as any).completedAt,
            vehiclesAdded: (lastLog as any).vehiclesAdded,
            vehiclesUpdated: (lastLog as any).vehiclesUpdated,
            vehiclesFlagged: (lastLog as any).vehiclesFlagged,
            totalFetched: (lastLog as any).totalFetched,
            durationMs: (lastLog as any).durationMs,
          }
        : null,
      inventory: {
        totalSynced: counts.totalSynced,
        totalNew: counts.totalNew,
        totalMissing: counts.totalMissing,
      },
    });
  } catch (error) {
    console.error('[Sync Status] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch sync status';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
