import mongoose from 'mongoose';
import CronRun from '@/models/CronRun';

function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function markCronRunning(job: string): Promise<void> {
  if (!isDbConnected()) return;
  await CronRun.updateOne(
    { job },
    {
      $set: {
        job,
        status: 'running',
        lastRunAt: new Date(),
      },
    },
    { upsert: true }
  );
}

export async function markCronSuccess(
  job: string,
  options?: { message?: string | null; durationMs?: number | null }
): Promise<void> {
  if (!isDbConnected()) return;
  await CronRun.updateOne(
    { job },
    {
      $set: {
        job,
        status: 'success',
        lastRunAt: new Date(),
        lastSuccessAt: new Date(),
        message: options?.message ?? null,
        durationMs: typeof options?.durationMs === 'number' ? options.durationMs : null,
      },
    },
    { upsert: true }
  );
}

export async function markCronError(
  job: string,
  error: unknown,
  options?: { durationMs?: number | null }
): Promise<void> {
  if (!isDbConnected()) return;
  const message = error instanceof Error ? error.message : String(error);

  await CronRun.updateOne(
    { job },
    {
      $set: {
        job,
        status: 'error',
        lastRunAt: new Date(),
        lastErrorAt: new Date(),
        message,
        durationMs: typeof options?.durationMs === 'number' ? options.durationMs : null,
      },
    },
    { upsert: true }
  );
}
