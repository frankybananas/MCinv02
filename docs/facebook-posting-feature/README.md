# Facebook Posting Feature - Documentation

**Version:** 1.0  
**Status:** Specification Complete - Ready for Implementation  
**Project:** MCinv02 Car Inventory Management System

---

## 📋 Overview

This folder contains comprehensive specifications for implementing automated Facebook posting functionality in the MCinv02 application. The feature enables users to post selected cars from the Marketing page directly to their Facebook profiles or business pages with AI-generated content.

---

## 📂 Documentation Structure

### Master Specification
- **[00-MASTER-SPEC.md](./00-MASTER-SPEC.md)** - High-level overview, architecture, and feature summary

### Implementation Phases (Sequential)

1. **[01-PHASE-DATA-MODELS.md](./01-PHASE-DATA-MODELS.md)** (1-2 days)
   - Database schemas (FacebookAuth, FacebookPost)
   - User model extensions
   - TypeScript interfaces
   - Encryption utilities

2. **[02-PHASE-FACEBOOK-OAUTH.md](./02-PHASE-FACEBOOK-OAUTH.md)** (2-3 days)
   - Facebook OAuth2 flow
   - Token storage and encryption
   - Page selection (personal vs business)
   - Token refresh mechanism

3. **[03-PHASE-USER-PROFILE.md](./03-PHASE-USER-PROFILE.md)** (1-2 days)
   - Profile page UI updates
   - Contact information form (WhatsApp, location, business name)
   - Facebook connection management
   - Posting preferences

4. **[04-PHASE-GEMINI-AI.md](./04-PHASE-GEMINI-AI.md)** (2-3 days)
   - Gemini AI integration
   - Post content generation
   - Prompt engineering
   - Tone variations (luxury, budget, professional, enthusiastic)

5. **[05-PHASE-MARKETING-UI.md](./05-PHASE-MARKETING-UI.md)** (1-2 days)
   - "FBPage" button addition
   - Connection status validation
   - Button styling and layout
   - Mobile responsiveness

6. **[06-PHASE-POSTING-ENGINE.md](./06-PHASE-POSTING-ENGINE.md)** (3-4 days)
   - Facebook Graph API integration
   - Image upload (single & albums)
   - VIN image exclusion
   - Cooldown enforcement

7. **[07-PHASE-QUEUE-ERRORS.md](./07-PHASE-QUEUE-ERRORS.md)** (2-3 days)
   - Job queue system
   - Retry logic with exponential backoff
   - Error handling and notifications
   - Cron job setup (Coolify)

8. **[08-PHASE-ANALYTICS.md](./08-PHASE-ANALYTICS.md)** (2-3 days)
   - Post history page
   - Analytics dashboard
   - Performance metrics
   - Retry failed posts

### Implementation Guide
- **[IMPLEMENTATION-CHECKLIST.md](./IMPLEMENTATION-CHECKLIST.md)** - Step-by-step checklist with tasks, testing, and deployment

---

## 🎯 Key Features

### Core Functionality
✅ Facebook OAuth2 authentication (secure, token-based)  
✅ Personal profile OR business page posting  
✅ AI-generated marketing content (Gemini 1.5 Flash)  
✅ Multi-car batch posting (separate posts per car)  
✅ Image handling (exclude VIN, max 10 images)  
✅ Scheduled posting support  
✅ Post queue with retry logic  

### User Experience
✅ Profile page Facebook connection  
✅ Marketing page integration  
✅ Post preview (optional)  
✅ Post history tracking  
✅ Analytics dashboard  
✅ Success/failure notifications  

### Technical
✅ Token encryption (AES-256-CBC)  
✅ Rate limiting and cooldown  
✅ Error handling with retries  
✅ Comprehensive testing (85%+ coverage)  
✅ Role-based access (Sales + Manager)  

---

## ⏱️ Estimated Timeline

| Phase | Duration | Type |
|-------|----------|------|
| Phase 1 | 1-2 days | Foundation |
| Phase 2 | 2-3 days | Integration |
| Phase 3 | 1-2 days | UI |
| Phase 4 | 2-3 days | AI |
| Phase 5 | 1-2 days | UI |
| Phase 6 | 3-4 days | Core Engine |
| Phase 7 | 2-3 days | Infrastructure |
| Phase 8 | 2-3 days | Polish |
| **Total** | **15-22 days** | **3-4 weeks** |

---

## 🛠️ Technology Stack

### New Dependencies
```json
{
  "@google/generative-ai": "latest",
  "axios": "^1.6.0",
  "date-fns": "^2.30.0"
}
```

### APIs
- **Facebook Graph API** v18.0
- **Google Gemini AI** (gemini-1.5-flash)

### Infrastructure
- MongoDB (existing)
- Cloudflare R2 (existing)
- Coolify (cron jobs)

---

## 📝 Prerequisites

### Facebook App Setup
1. Create Facebook App in Meta Developer Portal
2. Add Facebook Login product
3. Request permissions:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
4. Set OAuth redirect URIs

### Environment Variables
```env
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_GRAPH_API_VERSION=v18.0
GOOGLE_GEMINI_API_KEY=
FACEBOOK_TOKEN_ENCRYPTION_KEY=  # 32 bytes
CRON_SECRET=
NEXT_PUBLIC_BASE_URL=
```

### Gemini AI API Key
- Sign up at https://ai.google.dev/
- Generate API key
- Enable Gemini 1.5 Flash model

---

## 🚀 Getting Started

### Step 1: Review Documentation
1. Read **00-MASTER-SPEC.md** for high-level understanding
2. Review each phase document sequentially
3. Understand dependencies between phases

### Step 2: Environment Setup
1. Install new npm packages: `pnpm add @google/generative-ai axios date-fns`
2. Create Facebook App in Meta Developer Portal
3. Generate encryption key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
4. Set all environment variables

### Step 3: Implementation
1. Start with **Phase 1** (Data Models)
2. Complete testing before moving to next phase
3. Follow **IMPLEMENTATION-CHECKLIST.md**

### Step 4: Testing
- Run tests after each phase: `pnpm test`
- Target: 85%+ coverage
- Manual testing with real Facebook account

### Step 5: Deployment
1. Deploy to staging
2. Test OAuth flow end-to-end
3. Set up cron jobs in Coolify
4. Monitor logs
5. Deploy to production

---

## 📊 Success Criteria

### MVP (Minimum Viable Product)
- Users can authenticate with Facebook ✅
- Cars can be posted with AI-generated content ✅
- Images uploaded (excluding VIN) ✅
- Basic error handling ✅

### V1.0 (Full Feature Set)
- Post scheduling ✅
- History and analytics ✅
- Preview functionality ✅
- Template customization ✅
- 85%+ test coverage ✅

### Performance Targets
- OAuth login: < 3 seconds
- Post generation: < 5 seconds per car
- Queue processing: < 30 seconds per batch
- UI responsiveness: < 200ms

---

## 🔒 Security Considerations

1. **OAuth2 Security:**
   - CSRF protection via state parameter
   - Token encryption at rest (AES-256-CBC)
   - HTTPS-only in production

2. **Token Management:**
   - Automatic refresh before expiry
   - Secure storage (encrypted in MongoDB)
   - No password storage

3. **Access Control:**
   - Role-based (Sales + Manager only)
   - User isolation (own posts only)
   - API endpoint authentication

4. **Rate Limiting:**
   - Cooldown between posts (default: 5 minutes)
   - Facebook API rate limits respected
   - Queue-based processing

---

## 📈 Cost Analysis

### Gemini AI Costs
- **Model:** gemini-1.5-flash (cost-effective)
- **Cost per post:** ~$0.0001
- **Monthly estimate (1000 posts):** ~$0.10
- ✅ Very affordable!

### Facebook API
- Free for standard posting
- No per-post charges

---

## 🐛 Troubleshooting

### Common Issues

**"Invalid OAuth token"**
- Token expired → User must reconnect in Profile
- Solution: Implement token refresh (Phase 2)

**"Permission denied"**
- Missing Facebook permissions
- Solution: Re-request permissions in Facebook App settings

**"Failed to upload image"**
- Image URL not publicly accessible
- Solution: Verify R2 image URLs are public

**"Rate limit exceeded"**
- Too many posts in short time
- Solution: Queue system handles this (Phase 7)

---

## 📞 Support

### During Implementation
- Refer to individual phase documents for detailed guidance
- Check IMPLEMENTATION-CHECKLIST.md for task-by-task breakdown
- Review code examples and test cases

### After Deployment
- Monitor error logs daily
- Review analytics weekly
- Check Facebook API changelog monthly

---

## 🔄 Future Enhancements (Post-V1.0)

1. **Facebook Insights Integration**
   - Sync likes, comments, shares
   - Track reach and engagement
   - Performance reports

2. **Scheduled Posting UI**
   - Calendar view
   - Drag-and-drop rescheduling

3. **Template Library**
   - Save custom templates
   - Reuse successful styles

4. **A/B Testing**
   - Compare post performance
   - Optimize content strategy

5. **Instagram Cross-Posting**
   - Post to Instagram simultaneously
   - Leverage Facebook Business Suite

---

## 📄 License

This documentation is proprietary to the MCinv02 project.

---

## ✅ Approval Status

- [ ] Product Owner Review
- [ ] Technical Lead Approval
- [ ] Security Review Complete
- [ ] Ready for Implementation

---

**Questions? Start with the Master Spec or refer to the Implementation Checklist!**

Happy coding! 🚀
