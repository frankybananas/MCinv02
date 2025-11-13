import { generateEncryptionKey } from '../lib/encryption';

/**
 * Generate a secure 32-byte encryption key for Facebook token encryption
 * 
 * Run: pnpm tsx scripts/generate-encryption-key.ts
 * 
 * Copy the generated key and add it to your .env file as:
 * FACEBOOK_TOKEN_ENCRYPTION_KEY=<generated_key>
 */

console.log('\n🔐 Generating Facebook Token Encryption Key...\n');

const key = generateEncryptionKey();

console.log('✅ Generated 32-byte encryption key (64 hex characters):\n');
console.log(`   ${key}\n`);
console.log('📋 Add this to your .env file:\n');
console.log(`   FACEBOOK_TOKEN_ENCRYPTION_KEY=${key}\n`);
console.log('⚠️  IMPORTANT: Keep this key secret and never commit it to version control!\n');
