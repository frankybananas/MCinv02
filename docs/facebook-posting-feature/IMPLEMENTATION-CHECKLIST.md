# Facebook Posting Feature - Implementation Checklist

**Project:** MCinv02  
**Feature:** Automated Facebook Posting  
**Version:** 1.0

---

## Pre-Implementation Setup

### Environment & Dependencies

- [ ] Install new NPM packages:
  ```bash
  pnpm add @google/generative-ai
  pnpm add axios
  pnpm add date-fns
  ```

- [ ] Set environment variables in `.env`:
  ```env
  # Facebook OAuth
  FACEBOOK_APP_ID=
  FACEBOOK_APP_SECRET=
  FACEBOOK_GRAPH_API_VERSION=v18.0
  
  # Gemini AI
  GOOGLE_GEMINI_API_KEY=
  GEMINI_MODEL=gemini-1.5-flash
  
  # Security
  FACEBOOK_TOKEN_ENCRYPTION_KEY=  # Must be 32 bytes
  
  # Cron
  CRON_SECRET=
  
  # URLs
  NEXT_PUBLIC_BASE_URL=http://localhost:3000
  ```

- [ ] Generate encryption key:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- [ ] Create Facebook App in Meta Developer Portal
- [ ] Request Facebook permissions (pages_manage_posts, etc.)

---

## Phase 1: Data Models & Schema ✅

### Files to Create

- [ ] `models/FacebookAuth.ts` - OAuth token storage
- [ ] `models/FacebookPost.ts` - Post history tracking
- [ ] `lib/encryption.ts` - Token encryption utilities

### Files to Modify

- [ ] `models/User.ts` - Add contact fields (whatsappNumber, location, businessName, FB preferences)
- [ ] `app/types.ts` - Add TypeScript interfaces

### Database

- [ ] Run migration: `pnpm tsx scripts/migrations/add-facebook-fields-to-users.ts`
- [ ] Verify indexes created

### Testing

- [ ] Unit tests for models (`__tests__/models/facebook-auth.test.ts`)
- [ ] Unit tests for encryption (`__tests__/lib/encryption.test.ts`)
- [ ] Run tests: `pnpm test`

**Estimated Time:** 1-2 days

---

## Phase 2: Facebook OAuth2 Integration ✅

### Files to Create

- [ ] `app/api/facebook/auth/init/route.ts` - Start OAuth flow
- [ ] `app/api/facebook/auth/callback/route.ts` - Handle OAuth callback
- [ ] `app/api/facebook/auth/select-page/route.ts` - Page selection
- [ ] `app/api/facebook/auth/status/route.ts` - Connection status check
- [ ] `app/api/facebook/auth/disconnect/route.ts` - Disconnect Facebook
- [ ] `app/api/facebook/auth/refresh/route.ts` - Token refresh

### Testing

- [ ] OAuth flow end-to-end test
- [ ] Test personal vs business page selection
- [ ] Test token expiry handling
- [ ] Run: `pnpm test __tests__/api/facebook-oauth.test.ts`

**Estimated Time:** 2-3 days

---

## Phase 3: User Profile Enhancements ✅

### Files to Modify

- [ ] `app/profile/page.tsx` - Add Facebook connection section
- [ ] `app/profile/page.tsx` - Add contact information form
- [ ] `app/profile/page.tsx` - Add posting preferences

### Files to Create

- [ ] `app/api/profile/contact/route.ts` - Update contact info endpoint
- [ ] `app/api/profile/preferences/route.ts` - Update preferences endpoint

### Testing

- [ ] UI component tests (`__tests__/profile/facebook-section.test.tsx`)
- [ ] API endpoint tests
- [ ] Form validation tests

**Estimated Time:** 1-2 days

---

## Phase 4: Gemini AI Integration ✅

### Files to Create

- [ ] `lib/ai/gemini-service.ts` - AI post generation service
- [ ] `app/api/facebook/generate-post/route.ts` - Generate post endpoint

### Configuration

- [ ] Configure Gemini API key
- [ ] Test prompt variations
- [ ] Implement fallback templates

### Testing

- [ ] Unit tests for GeminiPostGenerator (`__tests__/lib/gemini-service.test.ts`)
- [ ] Test different car types (luxury, budget, etc.)
- [ ] Test error handling
- [ ] Verify hashtag generation

**Estimated Time:** 2-3 days

---

## Phase 5: Marketing Page UI ✅

### Files to Modify

- [ ] `app/components/marketing.tsx` - Add FBPage button
- [ ] `app/components/marketing.tsx` - Add connection status check
- [ ] `app/components/marketing.tsx` - Add click handler

### Styling

- [ ] Match button styling to existing "Generate" button
- [ ] Test mobile responsiveness
- [ ] Verify spacing and layout

### Testing

- [ ] Component tests (`__tests__/components/marketing-fbpage.test.tsx`)
- [ ] Test disabled states
- [ ] Test DNA car exclusion
- [ ] Test confirmation dialog

**Estimated Time:** 1-2 days

---

## Phase 6: Facebook Posting Engine ✅

### Files to Create

- [ ] `app/api/facebook/post/batch/route.ts` - Queue multiple posts
- [ ] `app/api/facebook/post/process/route.ts` - Process single post
- [ ] `lib/facebook/post-publisher.ts` - Facebook Graph API integration

### Features

- [ ] Single image posting
- [ ] Album posting (2-10 images)
- [ ] VIN image exclusion
- [ ] R2 image URL handling
- [ ] Cooldown enforcement

### Testing

- [ ] Test single image post
- [ ] Test album post
- [ ] Test error scenarios
- [ ] Mock Facebook API responses
- [ ] Run: `pnpm test __tests__/lib/facebook-publisher.test.ts`

**Estimated Time:** 3-4 days

---

## Phase 7: Queue & Error Handling ✅

### Files to Create

- [ ] `lib/facebook/post-queue.ts` - Queue processing logic
- [ ] `app/api/cron/process-facebook-queue/route.ts` - Cron endpoint
- [ ] `app/api/cron/cleanup-facebook-posts/route.ts` - Cleanup job

### Coolify Configuration

- [ ] Set up cron job in Coolify:
  - Name: Facebook Post Queue Processor
  - Schedule: `* * * * *` (every minute)
  - Command: `curl -X POST https://yourdomain.com/api/cron/process-facebook-queue -H "Authorization: Bearer $CRON_SECRET"`

- [ ] Set up cleanup job:
  - Name: Cleanup Old Facebook Posts
  - Schedule: `0 2 * * 0` (Sundays at 2 AM)
  - Command: `curl -X POST https://yourdomain.com/api/cron/cleanup-facebook-posts -H "Authorization: Bearer $CRON_SECRET"`

### Features

- [ ] Retry logic with exponential backoff
- [ ] User notifications on success/failure
- [ ] Queue status monitoring
- [ ] Structured logging

### Testing

- [ ] Queue processing tests (`__tests__/lib/post-queue.test.ts`)
- [ ] Retry limit tests
- [ ] Scheduled post tests

**Estimated Time:** 2-3 days

---

## Phase 8: Preview, History & Analytics ✅

### Files to Create

- [ ] `app/components/facebook-post-preview.tsx` - Preview modal (optional)
- [ ] `app/facebook-history/page.tsx` - Post history page
- [ ] `app/facebook-analytics/page.tsx` - Analytics dashboard
- [ ] `app/api/facebook/post/history/route.ts` - History API
- [ ] `app/api/facebook/post/retry/route.ts` - Retry endpoint
- [ ] `app/api/facebook/analytics/route.ts` - Analytics API

### Navigation

- [ ] Add "Facebook History" link to main nav
- [ ] Add "Facebook Analytics" link to main nav (or admin panel)

### Testing

- [ ] History page tests
- [ ] Analytics calculations
- [ ] Retry functionality
- [ ] Pagination tests

**Estimated Time:** 2-3 days

---

## Post-Implementation Tasks

### Documentation

- [ ] Create user guide (`docs/USER-GUIDE-FACEBOOK.md`)
- [ ] Update README with new feature
- [ ] Document troubleshooting steps

### Testing

- [ ] Run full test suite: `pnpm test`
- [ ] Verify 85%+ coverage
- [ ] Manual testing on development
- [ ] Test with real Facebook account

### Deployment

- [ ] Deploy to staging
- [ ] Test OAuth flow in staging
- [ ] Verify cron jobs running
- [ ] Monitor logs for errors
- [ ] Deploy to production
- [ ] Announce feature to users

---

## Success Metrics

**Week 1:**
- [ ] 10+ posts successfully published
- [ ] 0 token expiry issues
- [ ] <5% failure rate

**Month 1:**
- [ ] 100+ posts published
- [ ] 95%+ success rate
- [ ] User feedback collected

---

## Rollback Plan

If critical issues arise:

1. **Disable Feature:**
   ```bash
   # Set in environment
   FACEBOOK_FEATURE_ENABLED=false
   ```

2. **Stop Cron Jobs:**
   - Pause scheduled tasks in Coolify

3. **Database Cleanup:**
   ```typescript
   // If needed
   await FacebookAuth.deleteMany({});
   await FacebookPost.deleteMany({});
   ```

4. **Revert Code:**
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

---

## Support & Maintenance

### Monitoring

- [ ] Set up alerts for failed posts (>10% failure rate)
- [ ] Monitor Facebook API quota usage
- [ ] Track Gemini AI costs

### Regular Tasks

- **Daily:** Check error logs
- **Weekly:** Review analytics, adjust prompts if needed
- **Monthly:** Review Facebook API changes, update if needed

### Facebook API Updates

- Subscribe to Meta Developer changelog
- Test app when new API versions released
- Update FACEBOOK_GRAPH_API_VERSION as needed

---

## Estimated Total Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 1. Data Models | 1-2 days | None |
| 2. OAuth | 2-3 days | Phase 1 |
| 3. Profile | 1-2 days | Phase 2 |
| 4. Gemini AI | 2-3 days | Phase 1, 3 |
| 5. Marketing UI | 1-2 days | Phase 2, 3 |
| 6. Posting Engine | 3-4 days | Phase 2, 4, 5 |
| 7. Queue | 2-3 days | Phase 6 |
| 8. Analytics | 2-3 days | Phase 6, 7 |
| **Total** | **15-22 days** | Sequential |

**Recommended:** 3-4 weeks for production-ready implementation

---

## Questions or Issues?

Refer to individual phase documents for detailed implementation guidance:
- Phase 1: Data Models
- Phase 2: Facebook OAuth
- Phase 3: User Profile
- Phase 4: Gemini AI
- Phase 5: Marketing UI
- Phase 6: Posting Engine
- Phase 7: Queue & Errors
- Phase 8: Analytics

---

**Ready to start? Begin with Phase 1!** 🚀
