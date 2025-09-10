import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOtp extends Document {
  phone: string;
  code: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const OtpSchema = new Schema<IOtp>({
  phone: { type: String, required: true, index: true },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

OtpSchema.pre('save', function(next) {
  // @ts-ignore - this refers to the document
  this.updatedAt = new Date();
  next();
});

const Otp: Model<IOtp> = mongoose.models.Otp || mongoose.model<IOtp>('Otp', OtpSchema);
export default Otp;
