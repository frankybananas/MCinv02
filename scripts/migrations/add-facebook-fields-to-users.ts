import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import mongoose from 'mongoose';
import User from '../../models/User';
import { connect } from '../../lib/mongodb';

// Load environment variables from .env.local
const envPath = resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

/**
 * Migration: Add Facebook-related fields to User collection
 * 
 * This migration adds the following fields to existing users:
 * - facebookConnected (default: false)
 * - autoHashtags (default: true)
 * - postingCooldown (default: 5)
 * - defaultPostSchedule (default: 'immediate')
 * 
 * Run: pnpm tsx scripts/migrations/add-facebook-fields-to-users.ts
 */

async function migrateFacebookFields() {
  try {
    console.log('🚀 Starting migration: Add Facebook fields to User collection...\n');
    
    await connect();
    console.log('✅ Connected to MongoDB\n');
    
    // Count users that need migration
    const usersToMigrate = await User.countDocuments({
      facebookConnected: { $exists: false }
    });
    
    console.log(`📊 Found ${usersToMigrate} users that need migration\n`);
    
    if (usersToMigrate === 0) {
      console.log('✨ No users need migration. All users already have Facebook fields.');
      await mongoose.connection.close();
      return;
    }
    
    // Perform migration
    const result = await User.updateMany(
      { facebookConnected: { $exists: false } },
      {
        $set: {
          facebookConnected: false,
          autoHashtags: true,
          postingCooldown: 5,
          defaultPostSchedule: 'immediate'
        }
      }
    );
    
    console.log(`✅ Migration complete!`);
    console.log(`   - Matched: ${result.matchedCount} users`);
    console.log(`   - Modified: ${result.modifiedCount} users\n`);
    
    // Verify migration
    const verifyCount = await User.countDocuments({
      facebookConnected: { $exists: true }
    });
    
    console.log(`🔍 Verification: ${verifyCount} users now have Facebook fields`);
    
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    console.log('🎉 Migration successful!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run migration
migrateFacebookFields();
