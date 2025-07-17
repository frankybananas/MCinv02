import User from '@/models/User';

const TEST_ACCOUNTS: { [key: string]: string } = {
  '+16505553434': '123456', // A standard test number
  // Removed +27720560090 to use real Twilio SMS instead of mock OTP
};

/**
 * Returns the OTP for a given test phone number.
 * @param phone The E.164 formatted phone number.
 * @returns The OTP string if it's a test account, otherwise null.
 */
export function getTestOtp(phone: string): string | null {
  return TEST_ACCOUNTS[phone] || null;
}

/**
 * Creates a user record for a test account if it doesn't already exist.
 * This ensures that test users can proceed through the login flow.
 * @param phone The E.164 formatted phone number.
 */
export async function createTestUser(phone: string): Promise<void> {
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
        isVerified: true, // Test users are pre-verified
      });
      await newUser.save();
      console.log(`Created test user for ${phone}`);
    }
  } catch (error) {
    console.error(`Failed to create test user for ${phone}:`, error);
  }
}
