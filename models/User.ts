import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUser extends Document {
  phone: string;
  isAuthorized: boolean;
  role: 'admin' | 'user' | 'manager';
  position?: string;
  department: 'new' | 'used';
  matchingEnabled?: boolean;
  todoEnabled?: boolean;
  marketingEnabled?: boolean;
  notificationsDoneIds?: string[];
  profile?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
  };
  lastLogin?: Date;
  notificationsLastSeenAt?: Date;
  otpSecret?: string;
  otpExpiry?: Date;
  isTestAccount: boolean;
  createdAt: Date;
  updatedAt: Date;
  isTestNumber(): boolean;
}

const UserSchema = new Schema<IUser>({
  phone: { type: String, required: [true, 'Please provide a phone number'], unique: true, trim: true },
  isAuthorized: { type: Boolean, default: false },
  role: { type: String, enum: ['admin', 'user', 'manager'], default: 'user' },
  position: { type: String, trim: true },
  department: { type: String, enum: ['new', 'used'], required: true },
  matchingEnabled: { type: Boolean, default: true },
  todoEnabled: { type: Boolean, default: false },
  marketingEnabled: { type: Boolean, default: false },
  notificationsDoneIds: { type: [String], default: [] },
  profile: {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true, match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address'] },
    avatar: String,
  },
  lastLogin: { type: Date },
  notificationsLastSeenAt: { type: Date },
  otpSecret: { type: String },
  otpExpiry: { type: Date },
  isTestAccount: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

UserSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

UserSchema.methods.isTestNumber = function () {
  const testNumbers = ['+1 650-555-3434'];
  return testNumbers.includes(this.phone);
};

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export default User;
