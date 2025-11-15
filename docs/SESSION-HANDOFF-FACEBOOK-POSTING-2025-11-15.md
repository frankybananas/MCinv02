# Session Handoff – Facebook Posting Feature

**Project:** MCinv02  
**Feature:** Automated Facebook Page Posting  
**Date:** 2025-11-15  

---

## 1. High-Level Status

- **Specs:** Master spec + all phase docs exist under `docs/facebook-posting-feature/` (00–08, checklist, progress tracker, phase summaries).
- **Phase 1 – Data Models:**
  - Implemented and migrated.
  - Models: `FacebookAuth`, `FacebookPost` created, `User` extended with Facebook/contact fields, `lib/encryption.ts` implemented.
  - Migration script `scripts/migrations/add-facebook-fields-to-users.ts` run; encryption key generated and set.
- **Phase 2 – Facebook OAuth:**
  - Backend endpoints implemented under `app/api/facebook/auth/*`:
    - `init`, `callback`, `status`, `disconnect`, `select-page`, `refresh`.
  - Environment and Facebook app configuration on **live** mostly complete.
  - OAuth flow currently blocked at permissions/scopes level (see section 3).
- **Phase 3+ (Profile UI, Gemini, Marketing UI, Posting Engine, Queue, Analytics):**
  - Not yet implemented in code. Only specs exist.

The user tests **only on live/staging** (`https://htg.lotlynx.app`), not on `localhost`. All manual test instructions should assume this domain.

---

## 2. Environment & Configuration

### 2.1 Domains & Base URL

- Live/staging domain: `https://htg.lotlynx.app` (used for both staging and production).
- `NEXT_PUBLIC_BASE_URL` (live): set to `https://htg.lotlynx.app` (no trailing slash).

### 2.2 Environment Variables (Live)

Configured per user:

- **Facebook OAuth**
  - `FACEBOOK_APP_ID` – set from Meta app.
  - `FACEBOOK_APP_SECRET` – set from Meta app.
  - `FACEBOOK_GRAPH_API_VERSION` – currently using a v24.x URL from Facebook UI (see notes below; code default is `v18.0`).
  - `NEXT_PUBLIC_BASE_URL=https://htg.lotlynx.app`.
- **Security**
  - `FACEBOOK_TOKEN_ENCRYPTION_KEY` – 32-byte key generated and set; used by `lib/encryption.ts`.
- **Other planned vars (not yet fully used)**
  - `GOOGLE_GEMINI_API_KEY` (Phase 4).
  - `GEMINI_MODEL` (Phase 4, default `gemini-1.5-flash`).
  - `CRON_SECRET` (Phase 7, queue processing).

### 2.3 Meta (Facebook) App

- App name: **MCinv02 Marketing**.
- App type/category: shown as "Business and pages" in the Basic settings.
- Privacy Policy URL: `https://htg.lotlynx.app/privacy`.
- Terms of Service URL: `https://htg.lotlynx.app/terms`.
- Data deletion URL: `https://htg.lotlynx.app/data-deletion`.
- Status: **Unpublished / Development mode**.

### 2.4 OAuth Redirect URIs

Configured as per spec:

- `https://htg.lotlynx.app/api/facebook/auth/callback`
- (Dev/localhost is documented but the user does not test there.)

This was previously misconfigured via `NEXT_PUBLIC_BASE_URL=https://graph.facebook.com`, which caused the redirect URI to be `https://graph.facebook.com/api/facebook/auth/callback` and led to URL-blocked errors. That has been fixed.

---

## 3. Current Blocker – Invalid Scopes

### 3.1 Symptom

When starting OAuth via:

- `https://htg.lotlynx.app/api/facebook/auth/init`

Facebook shows a dialog:

> "This content isn't available right now"  
> Invalid Scopes: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.

This appears **after** the redirect URL issue was fixed and permissions were accepted.

### 3.2 Root Cause (likely)

- The app requests scopes:
  - `public_profile`, `email`,
  - `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.
- The three `pages_*` scopes require configuration in the **App Review / Permissions & Features** section of the Facebook developer dashboard.
- In the current UI screenshot (App Settings → Basic), the user does not see the App Review / Permissions links clearly; the navigation has changed.
- Result: Facebook treats these scopes as **invalid for this app** in Development mode for developers, hence the error.

---

## 4. Code Status (Backend)

### 4.1 Implemented Endpoints

Located under `app/api/facebook/auth/`:

- `init/route.ts`
  - Uses `requireSession` and `NEXT_PUBLIC_BASE_URL`.
  - Builds redirect URL `${NEXT_PUBLIC_BASE_URL}/api/facebook/auth/callback`.
  - Requests scopes listed above.
  - Sets CSRF `fb_oauth_state` and `fb_oauth_user` cookies.

- `callback/route.ts`
  - Validates `code`, `state`, cookies.
  - Exchanges code for access token via Graph API.
  - Fetches pages, user info, and granted permissions.
  - Encrypts access token via `encryptToken` and upserts a `FacebookAuth` record.
  - Sets `user.facebookConnected`, `facebookAccountType`, `facebookLastSyncedAt`.
  - Redirects to `/profile?success=facebook_connected&pages=<n>`.

- `status/route.ts`
  - Returns JSON: `{ connected, accountType, facebookPageName, lastSynced, isExpired, expiresAt, grantedPermissions }`.

- `disconnect/route.ts`
  - Deletes `FacebookAuth` for user and resets Facebook fields on `User`.

- `select-page/route.ts`
  - Lets user select `accountType` = `personal` or `business_page` and (for pages) stores page ID/name + encrypted page token.

- `refresh/route.ts`
  - Token refresh logic (not yet tested end-to-end).

### 4.2 Frontend

- `app/profile/page.tsx` currently has **no Facebook UI** – only basic profile form.
- Phase 3 spec (`03-PHASE-USER-PROFILE.md`) defines planned UI for:
  - Facebook Connection card (Connect/Disconnect, status, page name).
  - Contact info card (WhatsApp, business name, location).
  - Posting preferences card (auto hashtags, cooldown).
- Marketing page UI (FBPage button, etc.) and posting engine are not implemented yet.

### 4.3 Tests

- Test specs exist for:
  - Models: `__tests__/models/facebook-auth.test.ts`, `facebook-post.test.ts`.
  - Encryption: `__tests__/lib/encryption.test.ts` (100% coverage).
  - API auth: `__tests__/api/facebook-auth.test.ts` (OAuth flow tests).
- Some model tests are environment-sensitive (MongoDB timeouts). Needs a stable Jest/Mongo strategy if we want CI to pass consistently.

---

## 5. Agreed Working Practices / Constraints

- **Testing environment:**
  - Manual feature testing is done **on the live/staging domain** `https://htg.lotlynx.app` with a small internal user team.
  - The user does **not** test manually on `localhost`. Local is only for development and running automated tests.

- **Security & Cost:**
  - Tokens stored encrypted with AES-256-CBC.
  - Gemini model planned is `gemini-1.5-flash` for cost-effectiveness.

---

## 6. Next Steps (For Next Dev Session)

### 6.1 Finish Phase 2 – OAuth Flow

1. **Confirm Facebook App Permissions UI**
   - In Facebook Developer Dashboard, locate the section for **App Review / Permissions and Features** (UI has changed; may be under "Review" or similar in the left sidebar).
   - Ensure the app has **advanced access / requested permissions** for:
     - `pages_show_list`
     - `pages_read_engagement`
     - `pages_manage_posts`
   - If these are not visible, check:
     - App type is correct (Business-focused app).
     - Facebook Login is added as a Product.

2. **Retry OAuth on live**
   - From `https://htg.lotlynx.app`, while logged into MCinv02, visit:
     - `/api/facebook/auth/init`
   - Expectation:
     - No "Invalid Scopes" dialog.
     - After accept, redirect to `/profile?success=facebook_connected&pages=<n>`.

3. **Verify backend state**
   - Call `/api/facebook/auth/status` while logged in.
   - Expected response:
     - `connected: true`
     - `accountType: 'personal'` or `'business_page'`
     - `grantedPermissions` includes the requested pages scopes.
   - Optionally inspect MongoDB:
     - `FacebookAuth` document exists for user and `user.facebookConnected === true`.

4. **Stabilise OAuth tests**
   - Run locally: `pnpm test __tests__/api/facebook-auth.test.ts`.
   - Fix any mocking or environment issues to reach ≥ 80–85% coverage for the OAuth module.

### 6.2 Phase 3 – Profile UI (After Phase 2 is stable)

Once Phase 2 is confirmed working:

1. **Extend `app/profile/page.tsx`:**
   - Add "Facebook Connection" card per `03-PHASE-USER-PROFILE.md`.
   - Wire buttons:
     - `Connect Facebook` → `window.location.href = '/api/facebook/auth/init'`.
     - On load, fetch `/api/facebook/auth/status` to show current status.
     - `Disconnect` → `DELETE /api/facebook/auth/disconnect` then refetch status.

2. **Add Contact & Preferences sections:**
   - Implement PATCH endpoints:
     - `/api/profile/contact` and `/api/profile/preferences`.
   - Bind UI fields for WhatsApp, location, business name, auto hashtags, and cooldown.

3. **Tests:**
   - Implement `__tests__/profile/facebook-section.test.tsx` to cover:
     - Connect/disconnect flows.
     - Display of connected vs disconnected state.
     - Error handling and form validation.

### 6.3 Later Phases (4–8)

After Profile UI:

- Phase 4 – Gemini AI:
  - Implement `lib/ai/gemini-service.ts` and `app/api/facebook/generate-post/route.ts`.
- Phase 5 – Marketing UI:
  - Add FBPage button and connection status indicator on Marketing page.
- Phase 6 – Posting Engine:
  - Batch posting, images, VIN exclusion.
- Phase 7 – Queue & Errors:
  - Cron endpoints, queue processor, retry logic, `CRON_SECRET`.
- Phase 8 – History & Analytics:
  - History page, analytics dashboard, retry UI.

---

## 7. Open Questions / Things to Clarify

1. **Facebook App Permissions UI path**
   - The new developer dashboard UI differs from the docs. Next dev should confirm the exact path to enable `pages_*` scopes and update documentation.

2. **App type & long-term compliance**
   - Confirm whether the current app type fully supports all the required page permissions for long-term use.

3. **CI Expectations**
   - Clarify required Jest test suite behaviour in CI (especially for MongoDB model tests) to avoid flaky runs.

---

## 8. Quick Status Summary

- **Phase 1:** Complete (models, encryption, migration).
- **Phase 2:** Backend endpoints + env + redirect configured; **blocked on Facebook page permissions (invalid scopes)**.
- **Phase 3+:** Specs only; no UI/engine/queue/analytics implemented yet.
- **Next action:** Fix page permissions in Facebook app, complete OAuth flow on live, confirm `connected: true` via `/api/facebook/auth/status`, then move on to Profile UI work (Phase 3).
