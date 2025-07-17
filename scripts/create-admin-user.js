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
    const adminData = {
      phone,
      isAuthorized: true,
      role: 'admin',
      department: 'new',
      profile: {
        firstName: 'Admin',
        lastName: 'User',
      },
      isTestAccount: false,
    };

    // Use findOneAndUpdate with upsert to create or update the admin user
    const updatedUser = await User.findOneAndUpdate(
      { phone },
      { $set: adminData },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log(`Admin user ${phone} ensured:`, updatedUser.toObject());

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createAdminUser();
