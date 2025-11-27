import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IRateLimit extends Document {
  key: string;
  count: number;
  expiresAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>({
  key: { type: String, required: true, unique: true, index: true },
  count: { type: Number, default: 1 },
  expiresAt: { type: Date, required: true },
});

// TTL index to auto-delete expired rate limit records
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit: Model<IRateLimit> = mongoose.models.RateLimit || mongoose.model<IRateLimit>('RateLimit', RateLimitSchema);
export default RateLimit;
