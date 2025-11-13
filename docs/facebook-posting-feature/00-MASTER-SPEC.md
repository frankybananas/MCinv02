# Facebook Page Posting Feature - Master Specification

**Version:** 1.0  
**Date:** November 13, 2025  
**Author:** MCinv02 Development Team  
**Status:** Draft

---

## Executive Summary

This document outlines the comprehensive specification for implementing a Facebook Page posting feature in the MCinv02 car inventory management application. The feature enables users to automatically post selected cars from the Marketing page to their Facebook accounts (personal or business pages) with AI-generated marketing content.

### Core Objectives
1. **Automated Social Media Marketing**: Streamline the process of posting vehicle inventory to Facebook
2. **AI-Powered Content**: Leverage Gemini AI to create engaging, varied marketing posts
3. **User Control**: Provide flexibility in post customization and scheduling
4. **Enterprise-Grade**: Implement robust error handling, queuing, and analytics

---

## Feature Overview

### User Journey
1. User configures Facebook credentials via OAuth2 in their Profile page
2. User navigates to Marketing page and selects cars via checkboxes
3. User clicks "FBPage" button to initiate posting
4. System generates AI-powered posts with images (excluding VIN images)
5. Posts are queued and published to Facebook with error handling
6. User can preview, track history, and view analytics

### Key Capabilities
- ✅ Facebook OAuth2 authentication (secure, token-based)
- ✅ Choice between personal profile or Facebook Business Page
- ✅ Multi-car selection with batch posting (individual posts per car)
- ✅ Gemini AI content generation (varied tone, hashtags, English)
- ✅ Image handling (auto-exclude VIN, max 10 images)
- ✅ Post scheduling and queue management
- ✅ Post preview before publishing
- ✅ Posting history and analytics
- ✅ Role-based access control (Sales + Manager only)
- ✅ Rate limiting and cooldown protection
- ✅ Automatic exclusion of "Do Not Advertise" cars

---

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                     MCinv02 Application                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   Profile   │  │   Marketing  │  │   Post History    │  │
│  │     Page    │  │     Page     │  │    & Analytics    │  │
│  └──────┬──────┘  └──────┬───────┘  └─────────┬─────────┘  │
│         │                 │                     │             │
│         │                 │                     │             │
│  ┌──────▼─────────────────▼─────────────────────▼─────────┐ │
│  │            Facebook Posting Service Layer              │ │
│  │  • OAuth2 Manager   • Post Queue   • Token Refresh    │ │
│  └──────┬────────────────┬─────────────────────┬──────────┘ │
│         │                │                      │             │
└─────────┼────────────────┼──────────────────────┼─────────────┘
          │                │                      │
          │                │                      │
    ┌─────▼─────┐   ┌──────▼──────┐      ┌──────▼──────┐
    │ Facebook  │   │   Gemini    │      │  MongoDB    │
    │ Graph API │   │     AI      │      │  Database   │
    └───────────┘   └─────────────┘      └─────────────┘
```

### Data Flow

```
User Initiates Post → Validate Auth → Select Target (Profile/Page)
                                            ↓
                      Generate AI Content ← Fetch Car Data
                                            ↓
                      Queue Posts → Process Queue → Publish to Facebook
                                            ↓
                      Update History → Send Notifications → Log Analytics
```

---

## Technical Stack

### New Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `@google/generative-ai` | latest | Gemini AI integration |
| `facebook-graph-sdk` | ^4.0.0 | Facebook Graph API client |
| `bull` or `agenda` | latest | Job queue management |
| `date-fns` | ^2.30.0 | Date/time handling |

### API Endpoints Required
- **Facebook Graph API**: v18.0+
- **Gemini AI API**: gemini-1.5-flash or gemini-1.5-pro

### Database Collections
1. **FacebookAuth** (new): OAuth tokens, page info
2. **FacebookPost** (new): Post history, status, analytics
3. **User** (modified): Add contact fields, FB preferences
4. **Car** (no changes): Existing model sufficient

---

## Implementation Phases

### Phase 1: Foundation & Data Models
**Duration:** 1-2 days  
**Dependencies:** None  
**Deliverables:**
- MongoDB schemas (FacebookAuth, FacebookPost)
- TypeScript interfaces
- Database migrations

### Phase 2: Facebook OAuth2 Integration
**Duration:** 2-3 days  
**Dependencies:** Phase 1  
**Deliverables:**
- OAuth2 flow implementation
- Token storage and encryption
- Page selection API

### Phase 3: User Profile Enhancements
**Duration:** 1-2 days  
**Dependencies:** Phase 2  
**Deliverables:**
- Profile UI updates
- Contact fields (WhatsApp, Location)
- Business name configuration

### Phase 4: Gemini AI Post Generation
**Duration:** 2-3 days  
**Dependencies:** Phase 1  
**Deliverables:**
- AI service layer
- Prompt engineering
- Template system

### Phase 5: Marketing Page UI
**Duration:** 1-2 days  
**Dependencies:** Phase 2  
**Deliverables:**
- "FBPage" button
- Connection status indicator
- Selection UI improvements

### Phase 6: Facebook API Posting
**Duration:** 3-4 days  
**Dependencies:** Phases 2, 4  
**Deliverables:**
- Image upload to Facebook
- Post creation API
- Multi-car posting logic

### Phase 7: Queue & Error Handling
**Duration:** 2-3 days  
**Dependencies:** Phase 6  
**Deliverables:**
- Job queue system
- Retry logic
- Error notifications

### Phase 8: Preview, History & Analytics
**Duration:** 2-3 days  
**Dependencies:** Phases 6, 7  
**Deliverables:**
- Post history UI
- Analytics dashboard
- Preview modal

---

## Security & Compliance

### Authentication
- OAuth2 tokens encrypted at rest using AES-256
- Token refresh mechanism (60-day expiry)
- Secure token storage in MongoDB

### Authorization
- Role-based access: `salesperson` and `manager` roles only
- Feature flag: `marketingEnabled` per user
- API endpoint protection via middleware

### Privacy
- User consent required for Facebook posting
- No storage of Facebook passwords
- Compliance with Facebook Platform Policy

### Rate Limiting
- Facebook API limits: 200 calls/hour (adjustable)
- Cooldown: 5 minutes between batch posts
- Queue-based processing to prevent throttling

---

## Testing Strategy

### Unit Tests
- Target coverage: 85%+
- Focus areas: AI generation, OAuth flow, posting logic

### Integration Tests
- Facebook API mocking
- End-to-end posting workflow
- Error scenarios

### Manual Testing
- Cross-browser compatibility
- Mobile responsiveness
- Real Facebook account testing

---

## Monitoring & Observability

### Metrics
- Posts created per user/day
- Success/failure rates
- API latency (Facebook, Gemini)
- Queue depth and processing time

### Logging
- Structured JSON logs
- Log levels: DEBUG, INFO, WARN, ERROR
- Key events: OAuth, post creation, API errors

### Alerts
- Failed posts (consecutive failures)
- OAuth token expiry
- API quota approaching limit

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Facebook API changes | High | Medium | Version pinning, monitoring changelog |
| OAuth token expiry | Medium | High | Automatic refresh, user notifications |
| AI generation failures | Medium | Low | Fallback templates, retry logic |
| Rate limiting | Low | Medium | Queue system, cooldown enforcement |
| Image upload failures | Medium | Medium | Retry mechanism, error logging |

---

## Success Criteria

### MVP (Minimum Viable Product)
- ✅ Users can authenticate with Facebook
- ✅ Cars can be posted with AI-generated content
- ✅ Images uploaded (excluding VIN)
- ✅ Basic error handling

### V1.0 (Full Feature Set)
- ✅ Post scheduling
- ✅ History and analytics
- ✅ Preview functionality
- ✅ Template customization
- ✅ 85%+ test coverage

### Performance Targets
- OAuth login: < 3 seconds
- Post generation: < 5 seconds per car
- Queue processing: < 30 seconds per batch
- UI responsiveness: < 200ms

---

## Detailed Phase Documentation

Each phase has a dedicated specification document:

1. **[Phase 1: Data Models & Schema](./01-PHASE-DATA-MODELS.md)**
2. **[Phase 2: Facebook OAuth2](./02-PHASE-FACEBOOK-OAUTH.md)**
3. **[Phase 3: User Profile](./03-PHASE-USER-PROFILE.md)**
4. **[Phase 4: Gemini AI Integration](./04-PHASE-GEMINI-AI.md)**
5. **[Phase 5: Marketing Page UI](./05-PHASE-MARKETING-UI.md)**
6. **[Phase 6: Facebook Posting Engine](./06-PHASE-POSTING-ENGINE.md)**
7. **[Phase 7: Queue & Error Handling](./07-PHASE-QUEUE-ERRORS.md)**
8. **[Phase 8: Preview, History & Analytics](./08-PHASE-ANALYTICS.md)**

---

## Appendices

### A. Facebook API Reference
- [Graph API Documentation](https://developers.facebook.com/docs/graph-api)
- [OAuth 2.0 Guide](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow)
- [Page Publishing](https://developers.facebook.com/docs/pages/publishing)

### B. Gemini AI Reference
- [Gemini API Docs](https://ai.google.dev/docs)
- [Prompt Engineering Guide](https://ai.google.dev/docs/prompt_best_practices)

### C. Current System Integration Points
- User model: `models/User.ts`
- Car model: `models/Car.ts`
- Marketing page: `app/components/marketing.tsx`
- Profile page: `app/profile/page.tsx`
- API structure: `app/api/`

---

## Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-13 | Initial specification | Development Team |

---

## Approval & Sign-Off

- [ ] Product Owner
- [ ] Technical Lead
- [ ] Security Review
- [ ] QA Lead

---

**Next Steps:**
1. Review and approve this master specification
2. Proceed to Phase 1: Data Models & Schema
3. Set up development environment with new dependencies
4. Create feature branch: `feature/facebook-posting`
