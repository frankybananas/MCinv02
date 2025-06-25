import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: [true, 'Please provide a phone number'],
    unique: true,
    trim: true,
  },
  isAuthorized: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    enum: ['admin', 'user', 'manager'],
    default: 'user',
  },
  profile: {
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address'],
    },
    avatar: String,
  },
  lastLogin: {
    type: Date,
  },
  otpSecret: {
    type: String,
  },
  otpExpiry: {
    type: Date,
  },
  isTestAccount: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field on save
UserSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if this is a test phone number
UserSchema.methods.isTestNumber = function() {
  // Test phone numbers (e.g., +1 650-555-3434)
  const testNumbers = ['+1 650-555-3434'];
  return testNumbers.includes(this.phone);
};

export default mongoose.models.User || mongoose.model('User', UserSchema);
