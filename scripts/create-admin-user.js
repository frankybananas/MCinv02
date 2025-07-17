const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

// Define User schema directly since we can't import TS modules easily
const UserSchema = new mongoose.Schema({
  phone: { type: String, required: [true, 'Please provide a phone number'], unique: true, trim: true },
  isAuthorized: { type: Boolean, default: false },
  role: { type: String, enum: ['admin', 'user', 'manager'], default: 'user' },
  position: { type: String, trim: true },
  department: { type: String, enum: ['new', 'used'], required: true },
  profile: {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    avatar: String,
  },
  lastLogin: { type: Date },
  otpSecret: { type: String },
  otpExpiry: { type: Date },
  isTestAccount: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function createAdminUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const phone = '+27720560090';
    
    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      console.log(`User ${phone} already exists:`, existingUser.toObject());
      return;
    }

    // Create new admin user
    const newUser = new User({
      phone,
      isAuthorized: true,
      role: 'admin',
      department: 'new', // Required field
      profile: {
        firstName: 'Admin',
        lastName: 'User',
      },
      isTestAccount: false, // This is a real user, not a test account
    });

    await newUser.save();
    console.log(`Created admin user for ${phone}:`, newUser.toObject());

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createAdminUser();
