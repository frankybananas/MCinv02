import mongoose from 'mongoose';

const PhoneSchema = new mongoose.Schema({
  number: {
    type: String,
    required: [true, 'Please provide a phone number'],
    trim: true,
    unique: true,
  },
  type: {
    type: String,
    enum: ['mobile', 'work', 'home', 'other'],
    default: 'mobile',
  },
  countryCode: {
    type: String,
    default: '+1',
    trim: true,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
  },
  isTestNumber: {
    type: Boolean,
    default: false,
  },
  notes: String,
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
PhoneSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Add a method to check if this is a Firebase test phone number
PhoneSchema.methods.isFirebaseTestNumber = function() {
  // Firebase test phone numbers (e.g., +1 650-555-3434)
  const testNumbers = ['+1 650-555-3434'];
  return testNumbers.includes(this.number);
};

export default mongoose.models.Phone || mongoose.model('Phone', PhoneSchema);
