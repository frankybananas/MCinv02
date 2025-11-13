import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUser extends Document {
  phone: string;
  isAuthorized: boolean;
  role: 'admin' | 'user' | 'manager' | 'recon';
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
  
  // Facebook Contact Information
  whatsappNumber?: string;
  location?: string;
  businessName?: string;
  
  // Facebook Connection Status
  facebookConnected: boolean;
  facebookAccountType?: 'personal' | 'business_page';
  facebookLastSyncedAt?: Date;
  
  // Facebook Posting Preferences
  defaultPostSchedule?: string;
  autoHashtags: boolean;
  postingCooldown: number;
  
  createdAt: Date;
  updatedAt: Date;
  isTestNumber(): boolean;
}

const UserSchema = new Schema<IUser>({
  phone: { type: String, required: [true, 'Please provide a phone number'], unique: true, trim: true },
  isAuthorized: { type: Boolean, default: false },
  role: { type: String, enum: ['admin', 'user', 'manager', 'recon'], default: 'user' },
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
  
  // Facebook Contact Information
  whatsappNumber: {
    type: String,
    validate: {
      validator: function(v: string) {
        if (!v) return true; // Optional field
        return /^\+\d{10,15}$/.test(v);
      },
      message: 'WhatsApp number must be in E.164 format (+27824544656)'
    }
  },
  location: { type: String, maxlength: 200 },
  businessName: { type: String, maxlength: 100 },
  
  // Facebook Connection Status
  facebookConnected: { type: Boolean, default: false },
  facebookAccountType: { type: String, enum: ['personal', 'business_page'] },
  facebookLastSyncedAt: { type: Date },
  
  // Facebook Posting Preferences
  defaultPostSchedule: { type: String, default: 'immediate' },
  autoHashtags: { type: Boolean, default: true },
  postingCooldown: { type: Number, default: 5, min: 1, max: 60 },
  
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
