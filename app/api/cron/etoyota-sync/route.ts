import { NextRequest, NextResponse } from 'next/server';
import { runSync } from '@/lib/etoyota/sync-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handleCron(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runSync('cron');
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[e-Toyota Cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleCron(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleCron(request);
}
