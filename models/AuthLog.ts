import mongoose, { Document, Model, Schema } from 'mongoose';

export type AuthEventType = 
  | 'otp_sent'
  | 'otp_verified'
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'session_expired'
  | 'session_revoked'
  | 'rate_limited'
  | 'blocked';

export interface IAuthLog extends Document {
  event: AuthEventType;
  phone: string;
  userId?: mongoose.Types.ObjectId;
  ip: string;
  userAgent: string;
  deviceType?: 'mobile' | 'desktop';
  success: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const AuthLogSchema = new Schema<IAuthLog>(
  {
    event: { 
      type: String, 
      required: true,
      enum: [
        'otp_sent',
        'otp_verified', 
        'login_success',
        'login_failure',
        'logout',
        'session_expired',
        'session_revoked',
        'rate_limited',
        'blocked'
      ],
      index: true
    },
    phone: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    ip: { type: String, required: true },
    userAgent: { type: String, required: true },
    deviceType: { type: String, enum: ['mobile', 'desktop'] },
    success: { type: Boolean, required: true, index: true },
    reason: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { 
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Compound indexes for common queries
AuthLogSchema.index({ phone: 1, createdAt: -1 });
AuthLogSchema.index({ event: 1, success: 1, createdAt: -1 });

// TTL index: auto-delete logs older than 90 days (for compliance)
AuthLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AuthLog: Model<IAuthLog> = 
  mongoose.models.AuthLog || mongoose.model<IAuthLog>('AuthLog', AuthLogSchema);

export default AuthLog;
