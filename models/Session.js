import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    index: true,
  },
  jwtId: {
    type: String,
    required: true,
    unique: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  // 'mobile' or 'desktop'
  deviceType: {
    type: String,
    enum: ['mobile', 'desktop'],
    required: true,
    index: true,
  },
  // Timestamp of the last OTP verification for this session
  lastOtpAt: {
    type: Date,
    required: true,
  },
  // Session expiry (24 h after last OTP)
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  ipAddress: String,
  userAgent: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models.Session || mongoose.model('Session', sessionSchema);
