# Authentication Security Audit + Hardening Plan

**Audit Date:** November 27, 2025  
**Application:** MCinv02 - Mobile Car Inventory PWA  
**Framework:** Next.js 15 with App Router  
**Auditor:** Claude Opus (AI Security Analysis)

---

## EXECUTIVE SUMMARY

### Overall Security Posture: 🟡 YELLOW (Moderate Risk)

The current authentication implementation has a solid foundation but contains several security gaps that should be addressed before enterprise deployment. The system correctly uses HttpOnly cookies for JWT storage and has basic rate limiting, but lacks several enterprise security controls.

### Top 3 Critical Risks + Immediate Fixes

| Priority | Risk | CVSS | Immediate Action |
|----------|------|------|------------------|
| 1 | **CORS Wildcard on API** | 7.5 | Restrict `Access-Control-Allow-Origin` to specific domains |
| 2 | **7-Day JWT Expiry Without Refresh Tokens** | 6.8 | Implement short-lived access tokens + refresh token rotation |
| 3 | **No Audit Logging for Auth Events** | 6.5 | Add structured JSON audit logging for all auth events |

---

## PHASE 0: AUDIT BASELINE & THREAT MODEL

### 1. Current Auth Flow Diagram

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Client    │      │  Next.js    │      │   Twilio    │      │  MongoDB    │
│  (Mobile)   │      │    API      │      │   Verify    │      │   Atlas     │
└──────┬──────┘      └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
       │                    │                    │                    │
       │ 1. POST /api/auth/otp/send              │                    │
       │    {phone: "+27..."}                    │                    │
       ├───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │ 2. Check rate limit│                    │
       │                    ├───────────────────────────────────────->│
       │                    │    RateLimit.findOneAndUpdate           │
       │                    │                    │                    │
       │                    │ 3. Verify user exists                   │
       │                    ├───────────────────────────────────────->│
       │                    │    User.findOne({phone})                │
       │                    │                    │                    │
       │                    │ 4. Send OTP via SMS│                    │
       │                    ├───────────────────>│                    │
       │                    │    verifications.create                 │
       │                    │                    │                    │
       │<───────────────────┤ 5. {success: true} │                    │
       │                    │                    │                    │
       │ 6. POST /api/auth/otp/verify            │                    │
       │    {phone, code}   │                    │                    │
       ├───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │ 7. Verify OTP      │                    │
       │                    ├───────────────────>│                    │
       │                    │   verificationChecks.create             │
       │                    │                    │                    │
       │                    │ 8. Create Session  │                    │
       │                    ├───────────────────────────────────────->│
       │                    │    Session.create({jwtId, phone, ...})  │
       │                    │                    │                    │
       │                    │ 9. Sign JWT (7d)   │                    │
       │                    │   SignJWT({phone, userId, role, lastOtpAt})
       │                    │                    │                    │
       │<───────────────────┤ 10. Set-Cookie: session_token (HttpOnly)│
       │                    │                    │                    │
```

### 2. Current Implementation Analysis

#### 2.1 JWT Storage ✅ GOOD
**Location:** `app/api/auth/otp/verify/route.ts` (lines 143-149)
```typescript
response.cookies.set('session_token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
  sameSite: 'lax' // Lax allows cookie on PWA top-level navigation
});
```
- **✅ HttpOnly:** Yes - prevents XSS token theft
- **✅ Secure:** Yes in production - prevents MITM
- **✅ SameSite:** Lax - allows PWA reopening while still protecting against CSRF on mutations
- **⚠️ Issue:** 7-day expiry without rotation is excessive

#### 2.2 OTP Implementation 🟡 PARTIAL
**Location:** `app/api/auth/otp/send/route.ts` & `verify/route.ts`

| Aspect | Status | Details |
|--------|--------|---------|
| SMS OTP | ✅ | Uses Twilio Verify (industry standard) |
| Rate Limiting | ✅ | 5 sends/hour, 10 verifies/hour per phone |
| Phone Validation | ✅ | Uses libphonenumber-js with E.164 normalization |
| Replay Protection | ✅ | Twilio Verify handles OTP expiry/single-use |
| TOTP Alternative | ❌ | No TOTP/HOTP backup (SMS-only) |
| Test Account Risk | ⚠️ | Test OTPs returned in response in non-production |

#### 2.3 Role-Based Access Control 🟡 PARTIAL
**Location:** `middleware.ts` & API routes

| Component | Server-Side | Client-Side | Notes |
|-----------|-------------|-------------|-------|
| Admin Pages | ✅ | N/A | Middleware checks `role === 'admin'` |
| Recon Pages | ✅ | N/A | Middleware allows admin/manager/recon |
| API Routes | ✅ | N/A | Routes use `requireSession` + role checks |
| Write Operations | ✅ | N/A | `verifyActiveSession` for POST/PUT/DELETE |

**Roles Defined:** `admin`, `manager`, `recon`, `user`

#### 2.4 Session Management 🟡 NEEDS IMPROVEMENT
**Location:** `models/Session.ts` & `lib/auth-session.ts`

- **✅ Session Tracking:** Database records with device type, IP, user agent
- **✅ Device Limits:** 1 mobile + 1 desktop per user
- **✅ TTL Index:** Auto-cleanup of expired sessions
- **✅ Active Session Check:** `verifyActiveSession()` for write operations
- **⚠️ No Refresh Tokens:** JWT valid for 7 days without rotation
- **❌ No Revocation List:** Session invalidation relies on DB lookup

#### 2.5 MongoDB Security 🟡 PARTIAL
**Location:** `lib/mongodb.ts` & `models/*.ts`

| Aspect | Status | Details |
|--------|--------|---------|
| Connection | ⚠️ | Uses connection string from env var |
| Schema Validation | ⚠️ | Mongoose schemas but no strict validation rules |
| Phone Encryption | ❌ | Phones stored in plaintext |
| IP Allowlisting | ? | Unknown - depends on Atlas config |
| Query Injection | ✅ | Mongoose provides parameterized queries |

#### 2.6 CORS Configuration ❌ CRITICAL ISSUE
**Location:** `next.config.mjs` (lines 23-43)
```javascript
headers: [
  {
    key: 'Access-Control-Allow-Origin',
    value: '*',  // ❌ CRITICAL: Allows any origin
  },
  ...
]
```
**Risk:** Any website can make authenticated API requests to your backend if they can get the session cookie.

#### 2.7 PWA-Specific Security 🟡 PARTIAL
**Observations:**
- **✅ No localStorage tokens:** Session token in HttpOnly cookie only
- **⚠️ No Service Worker:** No SW file found - offline token handling not applicable
- **⚠️ Phone in localStorage:** `login_phone` saved for UX (low risk)

#### 2.8 Rate Limiting ✅ GOOD
**Location:** `lib/rate-limit.ts`

| Endpoint Type | Implementation | Limit |
|---------------|----------------|-------|
| OTP Send | MongoDB-backed | 5/hour/phone |
| OTP Verify | MongoDB-backed | 10/hour/phone |
| Other APIs | In-memory (basic) | Configurable |

**⚠️ Note:** In-memory rate limiter doesn't persist across serverless invocations.

#### 2.9 Audit Logging ❌ MISSING
- **Car operations:** Basic `auditLog` array in Car model
- **Auth events:** ❌ No structured logging for login/logout/failures
- **Security events:** ❌ No alerting on suspicious activity

---

## THREAT MODEL MATRIX

| Risk ID | Category | Description | CVSS | Likelihood | Impact | Phase |
|---------|----------|-------------|------|------------|--------|-------|
| AUTH-001 | CORS | Wildcard CORS allows cross-origin requests | 7.5 | High | High | 1 |
| AUTH-002 | Session | 7-day JWT without refresh token rotation | 6.8 | Medium | High | 1 |
| AUTH-003 | Audit | No structured auth event logging | 6.5 | High | Medium | 2 |
| AUTH-004 | Data | Phone numbers stored in plaintext | 5.5 | Medium | Medium | 2 |
| AUTH-005 | OTP | SMS-only auth (no TOTP backup) | 5.0 | Low | Medium | 3 |
| AUTH-006 | Test | Test OTPs exposed in non-prod responses | 4.5 | Low | Medium | 1 |
| AUTH-007 | Session | No idle timeout enforcement | 4.5 | Medium | Low | 3 |
| AUTH-008 | Rate | In-memory rate limiter not persistent | 4.0 | Medium | Low | 2 |
| AUTH-009 | Header | x-user-phone/role headers passed to routes | 3.5 | Low | Low | 2 |
| AUTH-010 | Infra | R2 bucket access configuration unknown | ? | Unknown | Unknown | 4 |

---

## OWASP TOP 10 + PWA RISKS CHECKLIST

| OWASP Category | Status | Current State | Recommendation |
|----------------|--------|---------------|----------------|
| A01:2021 Broken Access Control | 🟡 | Server-side role checks exist | Centralize RBAC middleware |
| A02:2021 Cryptographic Failures | 🟡 | JWT HS256 used, phones unencrypted | Encrypt PII at rest |
| A03:2021 Injection | ✅ | Mongoose ORM prevents NoSQL injection | Maintain current approach |
| A04:2021 Insecure Design | 🟡 | Basic threat modeling needed | Document auth flow |
| A05:2021 Security Misconfiguration | ❌ | CORS wildcard is critical | Fix immediately |
| A06:2021 Vulnerable Components | ? | Need dependency audit | Run `pnpm audit` |
| A07:2021 Auth Failures | 🟡 | Rate limiting exists, 7d expiry risky | Shorten token life |
| A08:2021 Data Integrity Failures | ✅ | JWT signed with HS256 | Consider RS256 for scale |
| A09:2021 Logging & Monitoring | ❌ | Minimal console.log only | Add structured logging |
| A10:2021 SSRF | ✅ | No external URL fetching in auth | N/A |

### PWA-Specific Risks

| Risk | Status | Notes |
|------|--------|-------|
| Service Worker Token Handling | ✅ | No SW, tokens in HttpOnly cookies |
| Offline Data Access | ⚠️ | Need to verify cached data doesn't include PII |
| Install Prompt Abuse | ✅ | Standard PWA manifest |
| Push Notification Security | N/A | Not implemented |

---

## COMPLIANCE CONSIDERATIONS (US Companies)

### CCPA/GDPR Data Requirements

| Requirement | Status | Gap |
|-------------|--------|-----|
| PII Encryption at Rest | ❌ | Phone numbers in plaintext |
| Data Minimization | ⚠️ | IP/UserAgent stored in sessions |
| Audit Trail | ❌ | 90-day retention not implemented |
| Right to Deletion | ? | No data deletion endpoint found |
| Consent Records | ? | Terms checkbox exists, logging unclear |

### NIST 800-63B (Digital Identity)

| Control | Status | Notes |
|---------|--------|-------|
| AAL1 (Single Factor) | ✅ | SMS OTP meets AAL1 |
| AAL2 (Multi-Factor) | ❌ | Requires TOTP/Authenticator |
| Session Binding | ✅ | JWT bound to phone/userId |
| Reauthentication | ⚠️ | 7-day max without re-auth |

---

## CURRENT IMPLEMENTATION QUESTIONS - ANSWERED

| Question | Answer | Evidence |
|----------|--------|----------|
| Where are JWTs stored? | HttpOnly cookies | `verify/route.ts:143-149` |
| OTP: SMS-only or TOTP? | SMS-only (Twilio Verify) | `send/route.ts:73-76` |
| Rate limited? | Yes, MongoDB-backed | `rate-limit.ts` |
| Replay protected? | Yes (Twilio handles) | Twilio Verify service |
| Role checks server-side? | Yes, middleware + API | `middleware.ts`, `admin/users/route.ts` |
| MongoDB schema validation? | Mongoose schemas only | `models/*.ts` |
| Phone encryption? | No | Plain strings in User model |
| PWA SW handles auth? | No SW found | N/A |
| R2 bucket public/signed? | Unknown | Uses `R2_PUBLIC_URL` - likely public |
| 7-day expiry refresh? | No rotation | JWT exp only, no refresh token |
| Audit logging? | Basic car auditLog only | No auth event logging |
| CORS configured? | Wildcard (*) | `next.config.mjs:30-31` |

---

## PHASED HARDENING PLAN

### Phase 1: Critical Fixes (Auth Bypass, Token Theft)
**Timeline:** 1-2 days  
**Exit Criteria:** No CVSS 7+ vulnerabilities, auth tests pass

#### 1.1 Fix CORS Wildcard (CRITICAL)
**File:** `next.config.mjs`

```diff
- value: '*',
+ value: process.env.ALLOWED_ORIGIN || 'https://your-domain.com',
```

**Or remove entirely and use Next.js default (same-origin only)**

#### 1.2 Implement Short-Lived Access Tokens + Refresh Tokens
**New files needed:**
- `app/api/auth/refresh/route.ts`
- Update `lib/auth-session.ts`

**Approach:**
1. Access token: 15-minute expiry, stored in HttpOnly cookie
2. Refresh token: 7-day expiry, stored in separate HttpOnly cookie
3. Silent refresh on 401 response

#### 1.3 Remove Test OTP from Response
**File:** `app/api/auth/otp/send/route.ts`

```diff
- return NextResponse.json({ success: true, message: 'Test OTP sent', testOtp });
+ return NextResponse.json({ success: true, message: 'Test OTP sent' });
+ // Log testOtp to server console only
```

#### 1.4 Add Basic Auth Event Logging
**New file:** `lib/audit-logger.ts`

```typescript
interface AuthEvent {
  event: 'login_attempt' | 'login_success' | 'login_failure' | 'logout' | 'otp_sent' | 'otp_verified';
  phone: string;
  ip: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  reason?: string;
}

export async function logAuthEvent(event: AuthEvent): Promise<void> {
  // Log as structured JSON for log aggregation
  console.log(JSON.stringify({ type: 'AUTH_EVENT', ...event }));
  // Future: persist to AuthLog collection
}
```

---

### Phase 2: Role-Based Access + MongoDB Hardening
**Timeline:** 2-3 days  
**Exit Criteria:** Role tests pass, Mongo queries validated

#### 2.1 Centralize RBAC Middleware
Create `lib/rbac.ts`:

```typescript
type Permission = 'cars:read' | 'cars:write' | 'users:manage' | 'admin:access';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: ['cars:read', 'cars:write', 'users:manage', 'admin:access'],
  manager: ['cars:read', 'cars:write', 'users:manage'],
  recon: ['cars:read', 'cars:write'],
  user: ['cars:read'],
};

export function hasPermission(role: string, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
```

#### 2.2 Encrypt PII in MongoDB
**Phone numbers should be encrypted at application level:**

```typescript
// lib/pii-encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.PII_ENCRYPTION_KEY!, 'hex');

export function encryptPhone(phone: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(phone, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}
```

#### 2.3 Add Input Sanitization
- Validate all phone inputs with libphonenumber-js ✅ (already done)
- Add explicit ObjectId validation for MongoDB IDs
- Sanitize any user-provided strings (make/model/etc.)

---

### Phase 3: PWA + Session Security
**Timeline:** 2-3 days  
**Exit Criteria:** PWA security tests pass, offline mode safe

#### 3.1 Implement Idle Session Timeout
Add middleware check for `lastAccessedAt`:

```typescript
// In middleware.ts
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes for compliance
const lastAccess = payload.lastAccessAt as number;
if (Date.now() - lastAccess > IDLE_TIMEOUT_MS) {
  // Force re-authentication
}
```

#### 3.2 Add CSRF Token for Mutations
Even with SameSite=Lax, consider adding CSRF token for extra protection on sensitive operations:

```typescript
// Generate: crypto.randomUUID()
// Store in session, validate on POST/PUT/DELETE
```

#### 3.3 2FA Enforcement for Admin/Manager
**Future enhancement:**
- Add TOTP option for privileged roles
- Use speakeasy or otplib for implementation

---

### Phase 4: Infrastructure + Monitoring
**Timeline:** 3-4 days  
**Exit Criteria:** Production-ready deployment checklist complete

#### 4.1 Cloudflare R2 Signed URLs
If bucket is public, switch to signed URLs:

```typescript
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// Generate short-lived signed URLs for images
```

#### 4.2 Secrets Management
- Verify all secrets in Coolify environment variables
- Add `lib/env-validation.ts` to fail fast on missing env vars
- Remove any console.log of sensitive data

#### 4.3 Structured Audit Logs + Alerting
- Create `AuditLog` MongoDB collection
- Log all auth events with structured JSON
- Set up alerts for:
  - Multiple failed logins
  - Admin role changes
  - Session anomalies

---

## SECURITY TEST PLAN

```gherkin
Feature: Secure Authentication

  Scenario: CORS restriction prevents cross-origin requests
    Given a malicious website on evil.com
    When it makes a request to /api/cars with credentials
    Then the request should be blocked by CORS policy

  Scenario: OTP rate limiting blocks brute force
    Given a valid phone number
    When 6 OTP send requests are made within 1 hour
    Then the 6th request should return 429 Too Many Requests

  Scenario: Expired JWT rejected
    Given a JWT token expired 1 minute ago
    When a request is made with this token
    Then the response should be 401 Unauthorized

  Scenario: Role escalation prevented
    Given a user with role "user"
    When they access /admin/users
    Then they should be redirected to /

  Scenario: Session invalidation on logout
    Given an active session
    When the user logs out
    Then the session should be marked inactive in DB
    And subsequent requests should fail authentication
```

---

## VERIFICATION COMMANDS

```bash
# Run security-focused linting
pnpm add -D eslint-plugin-security
# Add to .eslintrc.json: { "plugins": ["security"], "extends": ["plugin:security/recommended"] }
pnpm lint

# Check for vulnerable dependencies
pnpm audit

# Run auth-specific tests
pnpm test -- __tests__/api/auth*

# Build verification
pnpm build
```

---

## REFLECTION & SELF-CHECK

### Is there a simpler auth library/pattern?

**Considered alternatives:**
1. **NextAuth.js** - Good for OAuth providers, overkill for OTP-only
2. **Auth0** - Excellent security but adds vendor dependency + cost
3. **Supabase Auth** - Good alternative, requires migration

**Recommendation:** Current custom implementation is appropriate for OTP-only flow, but should implement refresh tokens properly.

### Any over-engineering?
- Device limit (1 mobile + 1 desktop) is good
- Session tracking in DB is appropriate for security

### Any under-engineering?
- **Yes:** Missing refresh token rotation
- **Yes:** Missing audit logging
- **Yes:** Missing PII encryption

### Trade-offs considered:
| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| Keep 7-day JWT | Simple | Token theft risk | ❌ Change to short-lived |
| Add Auth0 | Enterprise-grade | Cost, vendor lock | ❌ Not needed now |
| Encrypt all PII | Compliance | Complexity, search impact | ✅ Encrypt phones |

### Final Recommendation: PROCEED with phased fixes

The current implementation is functional but needs the Phase 1 fixes before any production deployment to a US company. The CORS wildcard is the most urgent issue.

---

## NEXT STEPS

### Immediate Actions (Before Review)
1. [ ] Review this document with stakeholders
2. [ ] Prioritize Phase 1 vs business timeline
3. [ ] Verify MongoDB Atlas IP allowlisting

### Blocking Questions
1. Is the Cloudflare R2 bucket currently public or using signed URLs?
2. What is the acceptable session length for compliance requirements?
3. Is there a security budget for tools like Auth0 or Datadog?

---

## APPENDIX: FILE REFERENCES

| File | Purpose | Security Relevance |
|------|---------|-------------------|
| `middleware.ts` | Route protection | JWT validation, role checks |
| `app/api/auth/otp/send/route.ts` | OTP initiation | Rate limiting, phone validation |
| `app/api/auth/otp/verify/route.ts` | OTP verification | Session creation, JWT signing |
| `app/api/auth/logout/route.ts` | Session termination | Session invalidation |
| `lib/auth-session.ts` | Session utilities | JWT verification, role helpers |
| `lib/rate-limit.ts` | Rate limiting | OTP abuse prevention |
| `lib/mongodb.ts` | Database connection | Connection security |
| `models/Session.ts` | Session schema | Device tracking, TTL |
| `models/User.ts` | User schema | Role storage, PII |
| `next.config.mjs` | App config | CORS headers |

---

*Document generated by security audit analysis. Review all recommendations before implementation.*
