# Phase 1: Data Models & Database Schema

**Phase:** 1 of 8  
**Duration:** 1-2 days  
**Dependencies:** None  
**Status:** Ready for Implementation

---

## Overview

This phase establishes the foundational data structures for the Facebook posting feature. All database schemas, TypeScript interfaces, and data validation rules are defined here.

---

## Objectives

1. ✅ Create MongoDB schemas for Facebook authentication and post history
2. ✅ Define TypeScript interfaces for type safety
3. ✅ Extend existing User model with Facebook-related fields
4. ✅ Implement data validation and migration scripts
5. ✅ Document all data relationships

---

## Database Schema Design

### 1. FacebookAuth Collection

**Purpose:** Store Facebook OAuth tokens and page information per user

**Schema:**
```typescript
// models/FacebookAuth.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IFacebookAuth extends Document {
  userId: mongoose.Types.ObjectId;  // Reference to User
  
  // OAuth Tokens
  accessToken: string;                // Encrypted access token
  tokenType: string;                  // Usually "Bearer"
  expiresAt: Date;                    // Token expiration timestamp
  refreshToken?: string;              // Optional refresh token (encrypted)
  
  // User/Page Selection
  accountType: 'personal' | 'business_page';
  facebookUserId?: string;            // FB user ID (if personal)
  facebookPageId?: string;            // FB page ID (if business)
  facebookPageName?: string;          // Display name for UI
  facebookPageAccessToken?: string;   // Page-specific token (encrypted)
  
  // Permissions
  grantedPermissions: string[];       // e.g., ['pages_manage_posts', 'pages_read_engagement']
  
  // Status
  isActive: boolean;                  // Can be deactivated by user
  lastUsed: Date;                     // Track last successful post
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const FacebookAuthSchema = new Schema<IFacebookAuth>({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true,  // One FB account per user
    index: true 
  },
  
  accessToken: { 
    type: String, 
    required: true,
    select: false  // Don't return by default
  },
  tokenType: { 
    type: String, 
    default: 'Bearer' 
  },
  expiresAt: { 
    type: Date, 
    required: true,
    index: true  // For cleanup queries
  },
  refreshToken: { 
    type: String,
    select: false 
  },
  
  accountType: { 
    type: String, 
    enum: ['personal', 'business_page'],
    required: true 
  },
  facebookUserId: { 
    type: String,
    index: true 
  },
  facebookPageId: { 
    type: String,
    index: true 
  },
  facebookPageName: String,
  facebookPageAccessToken: { 
    type: String,
    select: false 
  },
  
  grantedPermissions: [{ 
    type: String 
  }],
  
  isActive: { 
    type: Boolean, 
    default: true,
    index: true 
  },
  lastUsed: Date,
  
}, {
  timestamps: true,
  collection: 'facebook_auths'
});

// Indexes
FacebookAuthSchema.index({ userId: 1, isActive: 1 });
FacebookAuthSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });  // Auto-delete expired

export default mongoose.models.FacebookAuth || mongoose.model<IFacebookAuth>('FacebookAuth', FacebookAuthSchema);
```

**Encryption:** Tokens will be encrypted using AES-256-CBC before storage (see Security section).

---

### 2. FacebookPost Collection

**Purpose:** Track posting history, status, and analytics

**Schema:**
```typescript
// models/FacebookPost.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IFacebookPost extends Document {
  // User & Car Reference
  userId: mongoose.Types.ObjectId;       // Who posted
  carId: mongoose.Types.ObjectId;        // Which car
  
  // Post Content
  content: string;                       // Generated text
  hashtags: string[];                    // Extracted hashtags
  imageUrls: string[];                   // Car images (R2 URLs)
  
  // Facebook Data
  facebookPostId?: string;               // FB post ID (once published)
  facebookPageId?: string;               // Target page
  accountType: 'personal' | 'business_page';
  
  // Status Tracking
  status: 'pending' | 'processing' | 'published' | 'failed' | 'scheduled';
  scheduledFor?: Date;                   // If scheduled post
  publishedAt?: Date;                    // When successfully posted
  
  // Error Handling
  error?: string;                        // Error message if failed
  retryCount: number;                    // Number of retry attempts
  maxRetries: number;                    // Max allowed retries
  lastAttempt?: Date;                    // Last processing attempt
  
  // Analytics (populated after posting)
  analytics?: {
    likes?: number;
    comments?: number;
    shares?: number;
    reach?: number;
    engagement?: number;
    lastSynced?: Date;
  };
  
  // AI Generation Metadata
  aiModel: string;                       // e.g., 'gemini-1.5-flash'
  aiPromptVersion: string;               // Track prompt changes
  generationTime: number;                // Milliseconds
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const FacebookPostSchema = new Schema<IFacebookPost>({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  carId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Car', 
    required: true,
    index: true 
  },
  
  content: { 
    type: String, 
    required: true 
  },
  hashtags: [String],
  imageUrls: [String],
  
  facebookPostId: { 
    type: String,
    unique: true,
    sparse: true,  // Allows nulls
    index: true 
  },
  facebookPageId: String,
  accountType: { 
    type: String, 
    enum: ['personal', 'business_page'] 
  },
  
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'published', 'failed', 'scheduled'],
    default: 'pending',
    required: true,
    index: true 
  },
  scheduledFor: Date,
  publishedAt: { 
    type: Date,
    index: true 
  },
  
  error: String,
  retryCount: { 
    type: Number, 
    default: 0 
  },
  maxRetries: { 
    type: Number, 
    default: 3 
  },
  lastAttempt: Date,
  
  analytics: {
    likes: Number,
    comments: Number,
    shares: Number,
    reach: Number,
    engagement: Number,
    lastSynced: Date
  },
  
  aiModel: { 
    type: String, 
    default: 'gemini-1.5-flash' 
  },
  aiPromptVersion: { 
    type: String, 
    default: 'v1.0' 
  },
  generationTime: Number,
  
}, {
  timestamps: true,
  collection: 'facebook_posts'
});

// Indexes for common queries
FacebookPostSchema.index({ userId: 1, status: 1 });
FacebookPostSchema.index({ userId: 1, createdAt: -1 });
FacebookPostSchema.index({ carId: 1, status: 1 });
FacebookPostSchema.index({ status: 1, scheduledFor: 1 });  // Queue processing

export default mongoose.models.FacebookPost || mongoose.model<IFacebookPost>('FacebookPost', FacebookPostSchema);
```

---

### 3. User Model Extensions

**Purpose:** Add Facebook-related contact and preference fields

**Changes to `models/User.ts`:**
```typescript
// Add new fields to existing IUser interface
export interface IUser extends Document {
  // ... existing fields ...
  
  // NEW: Contact Information
  whatsappNumber?: string;      // WhatsApp contact (formatted)
  location?: string;             // Physical location (e.g., "George, Western Cape")
  businessName?: string;         // Display name (e.g., "Frederik Brand @ Halfway Toyota George")
  
  // NEW: Facebook Preferences
  facebookConnected: boolean;    // Quick check without DB lookup
  facebookAccountType?: 'personal' | 'business_page';
  facebookLastSyncedAt?: Date;
  
  // NEW: Posting Preferences
  defaultPostSchedule?: string;  // e.g., "immediate", "9am", "6pm"
  autoHashtags: boolean;         // Enable/disable auto hashtags
  postingCooldown: number;       // Minutes between posts (default: 5)
}

// Add to existing schema
const UserSchema = new Schema<IUser>({
  // ... existing fields ...
  
  // Contact Information
  whatsappNumber: {
    type: String,
    validate: {
      validator: function(v: string) {
        // Must be E.164 format: +27xxxxxxxxx
        return /^\+\d{10,15}$/.test(v);
      },
      message: 'WhatsApp number must be in E.164 format (+27824544656)'
    }
  },
  location: {
    type: String,
    maxlength: 200
  },
  businessName: {
    type: String,
    maxlength: 100
  },
  
  // Facebook Preferences
  facebookConnected: {
    type: Boolean,
    default: false
  },
  facebookAccountType: {
    type: String,
    enum: ['personal', 'business_page']
  },
  facebookLastSyncedAt: Date,
  
  // Posting Preferences
  defaultPostSchedule: {
    type: String,
    default: 'immediate'
  },
  autoHashtags: {
    type: Boolean,
    default: true
  },
  postingCooldown: {
    type: Number,
    default: 5,
    min: 1,
    max: 60
  }
}, {
  // ... existing options ...
});
```

---

### 4. Car Model (No Changes)

**Existing fields sufficient:**
- `images[]` with `isVin` flag for VIN identification
- `doNotAdvertise` boolean for exclusion
- All vehicle details (make, model, year, price, etc.)

---

## TypeScript Interfaces

**Location:** `app/types.ts`

```typescript
// Add to existing types.ts file

// Facebook Auth Types
export interface FacebookAuthData {
  userId: string;
  accountType: 'personal' | 'business_page';
  facebookUserId?: string;
  facebookPageId?: string;
  facebookPageName?: string;
  isActive: boolean;
  expiresAt: string;  // ISO date string
  lastUsed?: string;
  grantedPermissions: string[];
}

export interface FacebookOAuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;  // Seconds
  userId?: string;
  pages?: FacebookPage[];
}

export interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
  category: string;
  tasks: string[];  // Permissions for this page
}

// Post Types
export interface FacebookPostData {
  id: string;
  userId: string;
  carId: string;
  content: string;
  hashtags: string[];
  imageUrls: string[];
  status: 'pending' | 'processing' | 'published' | 'failed' | 'scheduled';
  scheduledFor?: string;
  publishedAt?: string;
  facebookPostId?: string;
  error?: string;
  analytics?: FacebookPostAnalytics;
  createdAt: string;
}

export interface FacebookPostAnalytics {
  likes?: number;
  comments?: number;
  shares?: number;
  reach?: number;
  engagement?: number;
  lastSynced?: string;
}

export interface CreatePostRequest {
  carIds: string[];
  scheduledFor?: string;  // ISO date string
  customMessage?: string;  // Optional override
}

export interface GeneratedPost {
  carId: string;
  content: string;
  hashtags: string[];
  imageUrls: string[];
}

// User Profile Extensions
export interface UserContactInfo {
  whatsappNumber?: string;
  location?: string;
  businessName?: string;
}

export interface UserFacebookPreferences {
  defaultPostSchedule?: string;
  autoHashtags: boolean;
  postingCooldown: number;
}
```

---

## Data Validation Rules

### Facebook Auth Validation
```typescript
// Validation helper
export const validateFacebookAuth = (auth: Partial<IFacebookAuth>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!auth.accessToken || auth.accessToken.length < 10) {
    errors.push('Invalid access token');
  }
  
  if (!auth.expiresAt || new Date(auth.expiresAt) <= new Date()) {
    errors.push('Token is expired or invalid expiration date');
  }
  
  if (auth.accountType === 'business_page' && !auth.facebookPageId) {
    errors.push('Business page requires facebookPageId');
  }
  
  if (auth.accountType === 'personal' && !auth.facebookUserId) {
    errors.push('Personal account requires facebookUserId');
  }
  
  return { valid: errors.length === 0, errors };
};
```

### Post Validation
```typescript
export const validateFacebookPost = (post: Partial<IFacebookPost>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!post.content || post.content.trim().length === 0) {
    errors.push('Post content is required');
  }
  
  if (post.content && post.content.length > 63206) {
    errors.push('Facebook post exceeds character limit (63,206)');
  }
  
  if (!post.imageUrls || post.imageUrls.length === 0) {
    errors.push('At least one image is required');
  }
  
  if (post.imageUrls && post.imageUrls.length > 10) {
    errors.push('Maximum 10 images allowed per post');
  }
  
  if (post.scheduledFor && new Date(post.scheduledFor) <= new Date()) {
    errors.push('Scheduled time must be in the future');
  }
  
  return { valid: errors.length === 0, errors };
};
```

---

## Security Implementation

### Token Encryption

**Location:** `lib/encryption.ts` (new file)

```typescript
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY!; // Must be 32 bytes
const IV_LENGTH = 16;

export const encryptToken = (token: string): string => {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes');
  }
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
};

export const decryptToken = (encryptedToken: string): string => {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes');
  }
  
  const [ivHex, encrypted] = encryptedToken.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};
```

**Environment Variables Required:**
```env
# .env
FACEBOOK_TOKEN_ENCRYPTION_KEY=your-32-byte-secret-key-here!!!
```

---

## Migration Scripts

### Script 1: Add Facebook Fields to Users

**Location:** `scripts/migrations/add-facebook-fields-to-users.ts`

```typescript
import mongoose from 'mongoose';
import User from '../../models/User';
import { connectDB } from '../../lib/mongodb';

async function migrateFacebookFields() {
  await connectDB();
  
  console.log('Starting migration: Add Facebook fields to User collection...');
  
  const result = await User.updateMany(
    { facebookConnected: { $exists: false } },
    {
      $set: {
        facebookConnected: false,
        autoHashtags: true,
        postingCooldown: 5
      }
    }
  );
  
  console.log(`Migration complete. Updated ${result.modifiedCount} users.`);
  
  await mongoose.connection.close();
}

migrateFacebookFields().catch(console.error);
```

**Run:** `pnpm tsx scripts/migrations/add-facebook-fields-to-users.ts`

---

## Database Indexes Summary

### FacebookAuth Collection
- `userId` (unique, ascending)
- `{ userId: 1, isActive: 1 }` (compound)
- `expiresAt` (ascending, TTL)
- `facebookUserId` (sparse)
- `facebookPageId` (sparse)

### FacebookPost Collection
- `userId` (ascending)
- `carId` (ascending)
- `facebookPostId` (unique, sparse)
- `status` (ascending)
- `{ userId: 1, status: 1 }` (compound)
- `{ userId: 1, createdAt: -1 }` (compound, for history)
- `{ status: 1, scheduledFor: 1 }` (compound, for queue)

### User Collection (additions)
- No new indexes required (existing `phone` index sufficient)

---

## Testing Requirements

### Unit Tests
**File:** `__tests__/models/facebook-auth.test.ts`

```typescript
describe('FacebookAuth Model', () => {
  test('should create valid FacebookAuth document', async () => {
    const authData = {
      userId: new mongoose.Types.ObjectId(),
      accessToken: 'encrypted_token_here',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      accountType: 'business_page',
      facebookPageId: '123456789',
      facebookPageName: 'Test Page',
      isActive: true,
      grantedPermissions: ['pages_manage_posts']
    };
    
    const auth = new FacebookAuth(authData);
    const savedAuth = await auth.save();
    
    expect(savedAuth._id).toBeDefined();
    expect(savedAuth.accountType).toBe('business_page');
  });
  
  test('should reject duplicate userId', async () => {
    const userId = new mongoose.Types.ObjectId();
    
    await FacebookAuth.create({
      userId,
      accessToken: 'token1',
      expiresAt: new Date(Date.now() + 1000000),
      accountType: 'personal',
      facebookUserId: '111'
    });
    
    await expect(FacebookAuth.create({
      userId,
      accessToken: 'token2',
      expiresAt: new Date(Date.now() + 1000000),
      accountType: 'personal',
      facebookUserId: '222'
    })).rejects.toThrow();
  });
  
  // ... more tests
});
```

**File:** `__tests__/models/facebook-post.test.ts`
- Test post creation with all statuses
- Test validation rules
- Test compound index queries
- Test analytics updates

**File:** `__tests__/lib/encryption.test.ts`
- Test token encryption/decryption
- Test invalid key handling
- Test malformed encrypted data

**Target:** 90%+ coverage

---

## Acceptance Criteria

### Must Have (MVP)
- ✅ FacebookAuth model with encrypted tokens
- ✅ FacebookPost model with status tracking
- ✅ User model extensions for contact info
- ✅ All database indexes created
- ✅ Encryption/decryption utilities
- ✅ Basic validation functions

### Should Have (V1.0)
- ✅ Migration scripts tested
- ✅ Comprehensive unit tests (85%+ coverage)
- ✅ Token expiry cleanup job
- ✅ Data relationship documentation

### Nice to Have (Future)
- ⏳ Analytics aggregation views
- ⏳ Post performance reporting
- ⏳ Historical trend analysis

---

## Dependencies & Prerequisites

### Environment Variables
```env
# Required for Phase 1
FACEBOOK_TOKEN_ENCRYPTION_KEY=<32-byte-secret>
```

### NPM Packages (install in Phase 2)
```json
{
  "dependencies": {
    "mongoose": "^8.0.0"  // Already installed
  },
  "devDependencies": {
    "tsx": "^4.0.0"  // For migration scripts
  }
}
```

---

## Next Steps

After Phase 1 completion:
1. **Review:** Code review of all schemas and interfaces
2. **Test:** Run all unit tests, verify coverage
3. **Deploy:** Apply migrations to development database
4. **Proceed:** Move to Phase 2 (Facebook OAuth2 Integration)

---

## Rollback Plan

If issues arise:
1. Drop new collections: `db.facebook_auths.drop()`, `db.facebook_posts.drop()`
2. Revert User model changes via reverse migration:
   ```typescript
   await User.updateMany({}, {
     $unset: {
       whatsappNumber: "",
       location: "",
       businessName: "",
       facebookConnected: "",
       facebookAccountType: "",
       facebookLastSyncedAt: "",
       defaultPostSchedule: "",
       autoHashtags: "",
       postingCooldown: ""
     }
   });
   ```
3. Remove encryption key from environment
4. Delete model files

---

**Status:** Ready for implementation  
**Estimated Effort:** 1-2 days  
**Risk Level:** Low (no external dependencies)
