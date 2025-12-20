import mongoose, { Document, Model, Schema } from 'mongoose';

export type AuditEventType =
  | 'OTP_REQUEST'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAIL'
  | 'ROLE_CHANGE'
  | 'PERMISSIONS_CHANGE'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'CAR_STATUS_CHANGE';

export interface IAuditLog extends Document {
  eventType: AuditEventType | string;
  phone?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    eventType: { type: String, required: true, index: true, trim: true },
    phone: { type: String, index: true },
    userId: { type: String, index: true },
    ip: { type: String },
    userAgent: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ eventType: 1, createdAt: -1 });
AuditLogSchema.index({ phone: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AuditLog: Model<IAuditLog> = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
