import mongoose, { Document, Model, Schema } from 'mongoose';

export type CronJobStatus = 'idle' | 'running' | 'success' | 'error';

export interface ICronRun extends Document {
  job: string;
  status: CronJobStatus;
  lastRunAt?: Date | null;
  lastSuccessAt?: Date | null;
  lastErrorAt?: Date | null;
  message?: string | null;
  durationMs?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const CronRunSchema = new Schema<ICronRun>(
  {
    job: { type: String, required: true, unique: true, index: true, trim: true },
    status: {
      type: String,
      required: true,
      enum: ['idle', 'running', 'success', 'error'],
      default: 'idle',
      index: true,
    },
    lastRunAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastErrorAt: { type: Date, default: null },
    message: { type: String, default: null },
    durationMs: { type: Number, default: null },
  },
  { timestamps: true }
);

CronRunSchema.index({ job: 1 }, { unique: true });

const CronRun: Model<ICronRun> =
  mongoose.models.CronRun || mongoose.model<ICronRun>('CronRun', CronRunSchema);

export default CronRun;
