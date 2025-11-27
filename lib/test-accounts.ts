import User from '@/models/User';

// Test accounts are DISABLED in production
const TEST_ACCOUNTS: { [key: string]: string } = process.env.NODE_ENV !== 'production'
  ? {
      '+16505553434': '123456', // A standard test number
    }
  : {};

/**
 * Returns the list of test phone numbers (for rejection in production).
 */
export function getTestPhoneNumbers(): string[] {
  return Object.keys(TEST_ACCOUNTS);
}

/**
 * Returns the OTP for a given test phone number.
 * @param phone The E.164 formatted phone number.
 * @returns The OTP string if it's a test account, otherwise null.
 */
export function getTestOtp(phone: string): string | null {
  if (process.env.NODE_ENV === 'production') {
    return null; // Never return test OTPs in production
  }
  return TEST_ACCOUNTS[phone] || null;
}

/**
 * Creates a user record for a test account if it doesn't already exist.
 * This ensures that test users can proceed through the login flow.
 * @param phone The E.164 formatted phone number.
 */
export async function createTestUser(phone: string): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    return; // Never create test users in production
  }
  try {
    const existingUser = await User.findOne({ phone });
    if (!existingUser) {
      const is_admin = phone === '+27720560090';
      const newUser = new User({
        phone,
        role: is_admin ? 'admin' : 'user',
        profile: {
          firstName: 'Test',
          lastName: is_admin ? 'Admin' : 'User',
        },
        isVerified: true,
      });
      await newUser.save();
      // Only log in non-production (already guarded above)
      console.log(`Created test user for ${phone}`);
    }
  } catch (error) {
    // Only log in non-production (already guarded above)
    console.error(`Failed to create test user for ${phone}:`, error);
  }
}
