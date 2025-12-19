import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth-session';
import { connect } from '@/lib/mongodb';
import CronRun from '@/models/CronRun';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRACKED_JOBS = ['match-requests', 'cleanup-sold-cars'] as const;

type TrackedJob = (typeof TRACKED_JOBS)[number];

type CronJobResponse = {
  job: TrackedJob;
  status: 'idle' | 'running' | 'success' | 'error';
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  message: string | null;
  durationMs: number | null;
  updatedAt: string | null;
};

function toIso(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'string') {
    const d = new Date(value);
    if (Number.isFinite(d.getTime())) return d.toISOString();
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    await connect();

    const docs = (await CronRun.find({ job: { $in: TRACKED_JOBS } }).lean()) as Array<any>;

    const byJob = new Map<string, any>();
    for (const doc of docs) {
      if (doc && typeof doc.job === 'string') {
        byJob.set(doc.job, doc);
      }
    }

    const data: CronJobResponse[] = TRACKED_JOBS.map((job) => {
      const doc = byJob.get(job) || {};

      const statusRaw = typeof doc.status === 'string' ? doc.status : 'idle';
      const status = (['idle', 'running', 'success', 'error'].includes(statusRaw)
        ? statusRaw
        : 'idle') as CronJobResponse['status'];

      const durationMs = typeof doc.durationMs === 'number' ? doc.durationMs : null;
      const message = typeof doc.message === 'string' ? doc.message : null;

      return {
        job,
        status,
        lastRunAt: toIso(doc.lastRunAt),
        lastSuccessAt: toIso(doc.lastSuccessAt),
        lastErrorAt: toIso(doc.lastErrorAt),
        message,
        durationMs,
        updatedAt: toIso(doc.updatedAt),
      };
    });

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Cron status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cron status' },
      { status: 500 }
    );
  }
}
