import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IOtpBlock extends Document {
  phone: string;              // Phone number (E.164 format)
  failedAttempts: number;     // Failed attempts in current block cycle (resets at 3)
  totalFailures: number;      // Total failures since last successful login
  blockCount: number;         // Number of times blocked (used to calculate duration)
  blockUntil: Date | null;    // When the block expires (null = not blocked)
  lastFailureAt: Date;        // Timestamp of last failed attempt
  createdAt: Date;
  updatedAt: Date;
}

const OtpBlockSchema = new Schema<IOtpBlock>(
  {
    phone: { type: String, required: true, unique: true, index: true },
    failedAttempts: { type: Number, default: 0 },
    totalFailures: { type: Number, default: 0 },
    blockCount: { type: Number, default: 0 },
    blockUntil: { type: Date, default: null },
    lastFailureAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// TTL index to auto-clean old records (clean up 30 days after last update)
OtpBlockSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const OtpBlock: Model<IOtpBlock> =
  mongoose.models.OtpBlock || mongoose.model<IOtpBlock>('OtpBlock', OtpBlockSchema);

export default OtpBlock;
