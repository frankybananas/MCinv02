# Phase 2: Facebook OAuth2 Integration

**Phase:** 2 of 8  
**Duration:** 2-3 days  
**Dependencies:** Phase 1 (Data Models)  
**Status:** Ready for Implementation

---

## Overview

Implement secure Facebook OAuth2 authentication flow allowing users to connect their Facebook accounts (personal or business pages) for automated posting.

---

## Objectives

1. ✅ Implement Facebook OAuth2 flow (server-side)
2. ✅ Handle token storage with encryption
3. ✅ Support personal profiles AND business pages
4. ✅ Implement token refresh mechanism
5. ✅ Create API endpoints for auth flow
6. ✅ Handle permission requests

---

## Facebook App Setup

### Required Configuration

**Developer Portal:** https://developers.facebook.com/apps

1. **Create Facebook App**
   - App Type: Business
   - Use Case: Business Integration
   - Display Name: MCinv02 Marketing

2. **Add Facebook Login Product**
   - Settings → Valid OAuth Redirect URIs:
     - Development: `http://localhost:3000/api/facebook/callback`
     - Production: `https://yourdomain.com/api/facebook/callback`

3. **Request Permissions**
   - **Basic:** `public_profile`, `email`
   - **Pages (for business):** `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`
   - **User Feed (for personal):** `publish_to_groups` (if available)

4. **App Review** (Production only)
   - Submit for `pages_manage_posts` permission
   - Provide use case documentation

---

## OAuth2 Flow Diagram

```
┌──────────┐                                    ┌──────────┐
│  User    │                                    │ Facebook │
│ Profile  │                                    │   API    │
└────┬─────┘                                    └────┬─────┘
     │                                                │
     │ 1. Click "Connect Facebook"                   │
     ├──────────────────────────────────────────────►│
     │    GET /api/facebook/auth/init                │
     │                                                │
     │◄───────────────────────────────────────────────┤
     │    Redirect to Facebook OAuth                 │
     │                                                │
     │ 2. User authorizes app                         │
     ├───────────────────────────────────────────────►│
     │    (Facebook login page)                       │
     │                                                │
     │◄───────────────────────────────────────────────┤
     │    Redirect to /api/facebook/callback          │
     │    with authorization code                     │
     │                                                │
     │ 3. Exchange code for token                     │
     ├───────────────────────────────────────────────►│
     │    POST /api/facebook/callback                 │
     │                                                │
     │◄───────────────────────────────────────────────┤
     │    Access token + permissions                  │
     │                                                │
     │ 4. Fetch user pages (if business)              │
     ├───────────────────────────────────────────────►│
     │    GET /me/accounts                            │
     │                                                │
     │◄───────────────────────────────────────────────┤
     │    List of pages                               │
     │                                                │
     │ 5. Store encrypted token                       │
     │    in FacebookAuth collection                  │
     │                                                │
     │ 6. Update User.facebookConnected = true        │
     │                                                │
     │◄───────────────────────────────────────────────┤
     │    Success → redirect to Profile               │
     │                                                │
```

---

## API Endpoints

### 1. Initialize OAuth Flow

**Endpoint:** `GET /api/facebook/auth/init`

**Purpose:** Start OAuth flow by redirecting to Facebook

**Implementation:**
```typescript
// app/api/facebook/auth/init/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getSession(request);
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Facebook OAuth parameters
    const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID!;
    const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL}/api/facebook/auth/callback`;
    const STATE = crypto.randomUUID(); // CSRF protection
    
    // Store state in session/cookie for validation
    const response = NextResponse.redirect(
      `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${FACEBOOK_APP_ID}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `state=${STATE}&` +
      `scope=${encodeURIComponent('public_profile,email,pages_show_list,pages_read_engagement,pages_manage_posts')}&` +
      `response_type=code`
    );
    
    // Set state cookie for CSRF validation
    response.cookies.set('fb_oauth_state', STATE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600 // 10 minutes
    });
    
    return response;
    
  } catch (error) {
    console.error('Facebook OAuth init error:', error);
    return NextResponse.redirect('/profile?error=oauth_init_failed');
  }
}
```

---

### 2. OAuth Callback Handler

**Endpoint:** `GET /api/facebook/auth/callback`

**Purpose:** Receive authorization code and exchange for access token

See separate file `02A-OAUTH-CALLBACK.md` for full implementation (too large for single doc).

---

### 3. Page Selection Endpoint

**Endpoint:** `POST /api/facebook/auth/select-page`

**Purpose:** Allow user to choose between personal or business page

**Request Body:**
```typescript
{
  accountType: 'personal' | 'business_page',
  pageId?: string  // Required if business_page
}
```

**Implementation:** See `02B-PAGE-SELECTION.md`

---

### 4. Token Refresh Endpoint

**Endpoint:** `POST /api/facebook/auth/refresh`

**Purpose:** Refresh expiring Facebook tokens

**Implementation:** See `02C-TOKEN-REFRESH.md`

---

### 5. Disconnect Facebook

**Endpoint:** `DELETE /api/facebook/auth/disconnect`

**Purpose:** Remove Facebook connection

**Implementation:**
```typescript
// app/api/facebook/auth/disconnect/route.ts
export async function DELETE(request: NextRequest) {
  const session = await getSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();
  
  // Delete FacebookAuth record
  await FacebookAuth.deleteOne({ userId: session.userId });
  
  // Update User
  await User.findByIdAndUpdate(session.userId, {
    $set: { facebookConnected: false },
    $unset: { facebookAccountType: '', facebookLastSyncedAt: '' }
  });

  return NextResponse.json({ success: true });
}
```

---

## Environment Variables

Add to `.env` and `.env.local`:

```env
# Facebook OAuth
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_GRAPH_API_VERSION=v18.0

# Callbacks
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # Production: https://yourdomain.com

# Security
FACEBOOK_TOKEN_ENCRYPTION_KEY=your-32-byte-encryption-key-here!!!
```

---

## Testing Requirements

### Unit Tests
**File:** `__tests__/api/facebook-oauth.test.ts`

```typescript
describe('Facebook OAuth Flow', () => {
  test('should generate valid OAuth URL', async () => {
    // Mock session
    const response = await GET(mockRequest);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('facebook.com/v18.0/dialog/oauth');
  });

  test('should reject unauthenticated users', async () => {
    const response = await GET(mockRequestWithoutSession);
    expect(response.status).toBe(401);
  });
});
```

**Target:** 85%+ coverage

---

## Security Considerations

1. **CSRF Protection:** Use state parameter and validate
2. **Token Encryption:** AES-256-CBC for all tokens
3. **HTTPS Only:** Production must use HTTPS
4. **Scope Minimization:** Request only necessary permissions
5. **Token Expiry:** Monitor and refresh proactively

---

## Acceptance Criteria

- ✅ Users can initiate OAuth flow from Profile page
- ✅ Successful authentication stores encrypted tokens
- ✅ Business pages listed and selectable
- ✅ Personal profile option available
- ✅ Token refresh works automatically
- ✅ Disconnect removes all FB data
- ✅ Error handling for common failures

---

**Next Phase:** Phase 3 (User Profile Enhancements)
