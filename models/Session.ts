import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ISession extends Document {
  phoneNumber: string;
  jwtId: string;
  isActive: boolean;
  deviceType: 'mobile' | 'desktop';
  lastOtpAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  lastAccessedAt: Date;
}

const SessionSchema = new Schema<ISession>({
  phoneNumber: { type: String, required: true, index: true },
  jwtId: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  deviceType: { type: String, enum: ['mobile', 'desktop'], required: true, index: true },
  lastOtpAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, index: true },
  ipAddress: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now },
  lastAccessedAt: { type: Date, default: Date.now },
});

const Session: Model<ISession> = mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema);
export default Session;
