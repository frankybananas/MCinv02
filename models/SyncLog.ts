import mongoose, { Document, Model, Schema } from 'mongoose';

export type SyncLogStatus = 'running' | 'success' | 'error';

export interface ISyncLog extends Document {
  startedAt: Date;
  completedAt?: Date | null;
  status: SyncLogStatus;
  vehiclesAdded: number;
  vehiclesUpdated: number;
  vehiclesFlagged: number;
  vehiclesReturned: number;
  totalFetched: number;
  syncErrors: string[];
  durationMs?: number | null;
  triggeredBy: 'cron' | 'manual';
  createdAt: Date;
  updatedAt: Date;
}

const SyncLogSchema = new Schema<ISyncLog>(
  {
    startedAt: { type: Date, required: true, default: () => new Date() },
    completedAt: { type: Date, default: null },
    status: {
      type: String,
      required: true,
      enum: ['running', 'success', 'error'],
      default: 'running',
    },
    vehiclesAdded: { type: Number, default: 0 },
    vehiclesUpdated: { type: Number, default: 0 },
    vehiclesFlagged: { type: Number, default: 0 },
    vehiclesReturned: { type: Number, default: 0 },
    totalFetched: { type: Number, default: 0 },
    syncErrors: { type: [String], default: [] },
    durationMs: { type: Number, default: null },
    triggeredBy: {
      type: String,
      required: true,
      enum: ['cron', 'manual'],
      default: 'cron',
    },
  },
  { timestamps: true }
);

SyncLogSchema.index({ startedAt: -1 });
SyncLogSchema.index({ status: 1 });

const SyncLog: Model<ISyncLog> =
  mongoose.models.SyncLog || mongoose.model<ISyncLog>('SyncLog', SyncLogSchema);

export default SyncLog;
