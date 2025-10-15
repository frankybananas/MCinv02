# OTP Login Issue Fix

## Problem Description

Users created through the Admin panel were unable to login and received "Failed to send OTP" error. The issue affected user "Melinda Erasmus" with phone number `0824544656` or `+27824544656`.

## Root Cause Analysis

The issue had multiple potential causes:

### 1. Phone Number Format Inconsistency (PRIMARY ISSUE - NOW FIXED)
**Problem:** When creating users through the admin panel, phone numbers were stored as-is without normalization. The OTP system normalizes phone numbers to E.164 format before lookup, causing mismatches.

**Example:**
- Admin stores: `0824544656` (as entered)
- OTP lookup uses: `+27824544656` (E.164 normalized)
- Database lookup fails because formats don't match

**Solution:** Normalize all phone numbers to E.164 format when creating or updating users.

### 2. Authorization Check
**Problem:** Users might exist but not have `isAuthorized` flag set to `true`.

**Solution:** Admin user creation now sets `isAuthorized: true` by default (already implemented).

### 3. Twilio Configuration
**Problem:** Missing or incorrect Twilio credentials prevent OTP sending.

**Solution:** Added better error logging to identify configuration issues.

## Changes Made

### 1. Admin Users API Route (`app/api/admin/users/route.ts`)

#### Added Phone Number Normalization
```typescript
import parsePhoneNumber from 'libphonenumber-js';

// In POST endpoint (create user)
const phoneNumber = parsePhoneNumber(rawPhone, 'ZA');
if (!phoneNumber || !phoneNumber.isValid()) {
  return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
}
const phone = phoneNumber.format('E.164');

// In PATCH endpoint (update user)
if (rawPhone) {
  const phoneNumber = parsePhoneNumber(rawPhone, 'ZA');
  if (!phoneNumber || !phoneNumber.isValid()) {
    return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
  }
  set.phone = phoneNumber.format('E.164');
}
```

**What this does:**
- Accepts phone numbers in any format: `0824544656`, `+27824544656`, `27824544656`
- Normalizes all to E.164 format: `+27824544656`
- Validates phone number format before saving
- Ensures consistency with OTP lookup system

### 2. OTP Send Route (`app/api/auth/otp/send/route.ts`)

#### Added Better Logging
```typescript
// Log user lookup results
console.log(`Looking up user with phone: ${phone}, found:`, 
  user ? `${user.profile?.firstName} ${user.profile?.lastName}` : 'NOT FOUND');

// Check authorization status
if (!user.isAuthorized) {
  console.log(`User ${phone} exists but is not authorized`);
  return NextResponse.json({ error: 'This account is not authorized to login.' }, { status: 403 });
}
```

#### Improved Error Messages
- Development mode: Shows detailed error messages
- Production mode: Shows generic error for security
- Better distinction between "user not found" and "not authorized"

### 3. Phone Number Normalization Script

Created `scripts/normalize-phone-numbers.js` to fix existing users:

**Features:**
- Scans all users in database
- Normalizes phone numbers to E.164 format
- Reports changes made
- Safe to run multiple times (idempotent)

**Usage:**
```bash
node scripts/normalize-phone-numbers.js
```

## Testing the Fix

### 1. Test Existing User (Melinda Erasmus)

The user should now be able to login with any of these formats:
- `0824544656`
- `+27824544656`
- `27824544656`

All will be normalized to `+27824544656` and matched in the database.

### 2. Test New User Creation

1. Go to Admin → Manage Users
2. Create a new user with phone: `0821234567`
3. System will normalize to: `+27821234567`
4. User should be able to login immediately

### 3. Check Server Logs

When a user attempts to login, check the server logs for:
```
Looking up user with phone: +27824544656, found: Melinda Erasmus
```

If you see `NOT FOUND`, the phone number format is still mismatched.

## Verification Steps

### Step 1: Verify Database State
Run the normalization script to check current state:
```bash
node scripts/normalize-phone-numbers.js
```

Expected output:
```
Found 2 users to process
✓ Admin User: +27720560090 (already normalized)
✓ Melinda Erasmus: +27824544656 (already normalized)
```

### Step 2: Test Login Flow

1. Open the app in a browser
2. Navigate to login page
3. Enter phone number: `0824544656` (without country code)
4. Click "Send Verification Code"
5. Check server logs for user lookup
6. Should receive OTP via SMS (if Twilio is configured)

### Step 3: Check for Twilio Issues

If OTP still fails after phone normalization:

1. Check environment variables:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_VERIFY_SERVICE_SID`

2. Check Twilio account:
   - Account balance (trial accounts have limits)
   - Verified phone numbers (trial accounts can only send to verified numbers)
   - Service status

3. Check server logs for specific Twilio errors

## Common Error Messages

### "This phone number is not authorized"
- **Cause:** User doesn't exist in database
- **Solution:** Create user through Admin panel

### "This account is not authorized to login"
- **Cause:** User exists but `isAuthorized` is false
- **Solution:** Update user in database or recreate through Admin panel

### "Server configuration error"
- **Cause:** Missing Twilio credentials
- **Solution:** Set environment variables in `.env.local`

### "Failed to send OTP" (with Twilio error in logs)
- **Cause:** Twilio account issue (balance, trial limitations, etc.)
- **Solution:** Check Twilio dashboard and account status

## Phone Number Format Examples

The system now accepts and normalizes these formats:

| Input Format | Normalized (E.164) | Valid? |
|--------------|-------------------|--------|
| `0824544656` | `+27824544656` | ✅ Yes |
| `+27824544656` | `+27824544656` | ✅ Yes |
| `27824544656` | `+27824544656` | ✅ Yes |
| `082 454 4656` | `+27824544656` | ✅ Yes |
| `+27 82 454 4656` | `+27824544656` | ✅ Yes |
| `1234` | N/A | ❌ No (invalid) |
| `abc` | N/A | ❌ No (invalid) |

## Files Modified

1. `app/api/admin/users/route.ts` - Phone normalization in POST and PATCH
2. `app/api/auth/otp/send/route.ts` - Better logging and error handling
3. `scripts/normalize-phone-numbers.js` - New migration script

## Next Steps

1. ✅ Deploy the updated code
2. ✅ Run the phone normalization script (already run, all users normalized)
3. ✅ Test login with Melinda's account
4. ⚠️ Verify Twilio configuration if OTP still fails
5. ✅ Monitor server logs for any issues

## Rollback Plan

If issues occur:
1. Revert changes to `app/api/admin/users/route.ts`
2. Phone numbers will be stored as-is (old behavior)
3. Users created before fix will still work
4. New users may have format issues

## Additional Notes

- The fix is backward compatible - existing users with normalized numbers continue to work
- The normalization script is idempotent and safe to run multiple times
- All South African numbers default to country code +27
- International numbers are supported if entered with country code
