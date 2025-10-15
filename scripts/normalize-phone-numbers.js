/**
 * Script to normalize all phone numbers in the database to E.164 format
 * Run with: node scripts/normalize-phone-numbers.js
 */

const mongoose = require('mongoose');
const parsePhoneNumber = require('libphonenumber-js').default;
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const UserSchema = new mongoose.Schema({
  phone: String,
  profile: {
    firstName: String,
    lastName: String,
  },
}, { strict: false });

const User = mongoose.model('User', UserSchema);

async function normalizePhoneNumbers() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected successfully');

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to process`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const rawPhone = user.phone;
        
        // Skip if already in E.164 format (starts with +)
        if (rawPhone.startsWith('+')) {
          // Verify it's valid
          const phoneNumber = parsePhoneNumber(rawPhone);
          if (phoneNumber && phoneNumber.isValid()) {
            console.log(`✓ ${user.profile?.firstName} ${user.profile?.lastName}: ${rawPhone} (already normalized)`);
            skipped++;
            continue;
          }
        }

        // Try to parse and normalize
        const phoneNumber = parsePhoneNumber(rawPhone, 'ZA');
        
        if (!phoneNumber || !phoneNumber.isValid()) {
          console.error(`✗ ${user.profile?.firstName} ${user.profile?.lastName}: ${rawPhone} (invalid format)`);
          errors++;
          continue;
        }

        const normalizedPhone = phoneNumber.format('E.164');
        
        if (normalizedPhone !== rawPhone) {
          // Update the user
          await User.updateOne(
            { _id: user._id },
            { $set: { phone: normalizedPhone } }
          );
          console.log(`✓ ${user.profile?.firstName} ${user.profile?.lastName}: ${rawPhone} → ${normalizedPhone}`);
          updated++;
        } else {
          console.log(`✓ ${user.profile?.firstName} ${user.profile?.lastName}: ${rawPhone} (no change needed)`);
          skipped++;
        }
      } catch (error) {
        console.error(`✗ Error processing user ${user._id}:`, error.message);
        errors++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total users: ${users.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Errors: ${errors}`);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
normalizePhoneNumbers();
