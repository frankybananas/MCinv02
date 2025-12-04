# Technical Design: System Architecture

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Component Breakdown](#component-breakdown)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Technology Stack](#technology-stack)
6. [Scalability Considerations](#scalability-considerations)

---

## System Overview

The AI-Powered Vehicle Matching System is built as an integrated module within the existing Next.js MCinv02 application. It follows a **microservices-inspired architecture** with clear separation of concerns:

- **Frontend Layer**: Next.js React components with TypeScript
- **API Layer**: Next.js API routes with authentication middleware
- **Business Logic Layer**: Matching engine, scoring algorithm, AI parsing
- **Data Layer**: MongoDB Atlas with multi-tenant isolation
- **Job Processing Layer**: Cron-based background tasks (via Coolify)
- **External Services**: Gemini AI, Cloudflare R2

### Design Principles

1. **Multi-Tenancy First**: Every operation enforces userId-based isolation
2. **Async by Default**: Heavy operations run in background jobs
3. **Fail Gracefully**: Comprehensive error handling with retries
4. **Cache Aggressively**: Minimize external API calls
5. **Scale Horizontally**: Stateless design for easy scaling

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                            │
│                     Next.js React Application                        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                │ HTTPS
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│                      NEXT.JS APPLICATION                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Frontend Components                        │  │
│  │  • Client Detail (with ClientRequest list)                   │  │
│  │  • Dashboard/Cars (with match indicators)                    │  │
│  │  • Notifications Page (match display - existing)             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                │                                     │
│  ┌──────────────────────────────▼──────────────────────────────┐  │
│  │                    API Routes Layer                          │  │
│  │  ┌────────────────────────────────────────────────────┐     │  │
│  │  │  Authentication + Authorization (existing)         │     │  │
│  │  │  • Extract userId from session/JWT                 │     │  │
│  │  │  • createdByPhone isolation for clients            │     │  │
│  │  └────────────────────────────────────────────────────┘     │  │
│  │  ┌────────────────────────────────────────────────────┐     │  │
│  │  │  API Endpoints                                     │     │  │
│  │  │  • /api/clients/[id]/requests/* (existing CRUD)    │     │  │
│  │  │  • /api/matches/* (new)                            │     │  │
│  │  │  • /api/ai/parse (new - Gemini integration)        │     │  │
│  │  │  • /api/cron/match-requests (new - cron trigger)   │     │  │
│  │  └────────────────────────────────────────────────────┘     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                │                                     │
│  ┌──────────────────────────────▼──────────────────────────────┐  │
│  │                 Business Logic Layer                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │  │
│  │  │ AI Parsing   │  │  Matching    │  │  Scoring     │      │  │
│  │  │  (Gemini)    │  │   Engine     │  │  Algorithm   │      │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌────────────────┐     ┌────────────────┐
│   MONGODB     │      │  CRON JOBS     │     │ EXTERNAL APIs  │
│    ATLAS      │      │  (Coolify)     │     │                │
│               │      │                │     │  • Gemini AI   │
│ Collections:  │      │ Triggers:      │     │  • R2 Storage  │
│ • clients     │      │ • match-reqs   │     │                │
│ • clientreqs  │      │   (every 2min) │     └────────────────┘
│ • cars        │      │                │
│ • vehmatches  │      └────────────────┘
│ • notifs      │
└───────────────┘
        │
        │ (All queries filtered by createdByPhone/userId)
        │
┌───────▼────────────────────────────────────────┐
│     MULTI-TENANT DATA ISOLATION                │
│  Clients/Requests: { createdByPhone }          │
│  Matches: { createdByPhone }                   │
└────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Frontend Components

#### Clients Page Enhancement
**Location**: `app/components/client-detail.tsx` (existing)

**New Elements**:
```typescript
interface LookingForSection {
  rawText: string;              // User input
  matchCount: number;           // Badge counter
  lastUpdated: Date;            // Timestamp
  isLoading: boolean;           // Save state
  parseStatus: 'pending' | 'parsed' | 'failed';
}
```

**Features**:
- Multi-line textbox (500-1000 char limit)
- Auto-save with debounce (2 seconds)
- Character counter
- Match count badge
- "View matches" button
- Parse status indicator

#### Inventory Page Enhancement
**Location**: `app/components/dashboard.tsx` (existing, Cars tab)

**New Elements**:
- Match count badge on each car card
- "View matches" link
- Visual indicator for high-quality matches (≥85 score)

#### Notifications Page (New)
**Location**: `app/notifications/page.tsx` (new)

**Features**:
- List view with pagination (20 per page)
- Filter bar: All / Unread / Match Quality
- Sort dropdown: Date / Match Score
- Bulk actions: Mark all read, Dismiss multiple
- Notification cards with:
  - Client name
  - Vehicle thumbnail (from R2)
  - Match score and quality badge
  - Match details
  - Action buttons (View Match, View Client, View Vehicle)

#### Toast Notifications
**Location**: `app/components/toast-notification.tsx` (new)

**Trigger**: New match created while user is active

**Implementation**: React Context + polling mechanism

---

### 2. API Routes Layer

#### Authentication Middleware
**File**: `lib/middleware/auth.ts` (new)

```typescript
export async function requireAuth(req: NextApiRequest) {
  const session = await getSession(req);
  if (!session?.userId) {
    throw new UnauthorizedError();
  }
  return session.userId;
}
```

#### Authorization Middleware
**File**: `lib/middleware/ownership.ts` (new)

```typescript
export async function verifyClientOwnership(
  clientId: string,
  userId: string
) {
  const client = await db.clients.findOne({
    _id: new ObjectId(clientId),
    userId: new ObjectId(userId)
  });
  if (!client) throw new NotFoundError('Client not found');
  return client;
}
```

#### API Endpoint Structure
All endpoints follow this pattern:
1. Extract userId from session
2. Verify ownership if accessing specific resource
3. Execute business logic
4. Return standardized response

---

### 3. Business Logic Layer

#### AI Parsing Engine
**File**: `lib/ai/gemini-parser.ts` (new)

**Responsibilities**:
- Send natural language text to Gemini AI
- Validate and structure JSON response
- Cache results in MongoDB
- Handle errors and retry logic
- Flag low-confidence parses

**Key Functions**:
- `parseClientPreferences(rawText: string): Promise<ParsedCriteria>`
- `validateParsedOutput(output: any): ParsedCriteria`
- `getCachedParse(rawText: string): ParsedCriteria | null`
- `flagForManualReview(clientId: string, reason: string): void`

#### Matching Engine
**File**: `lib/matching/match-engine.ts` (new)

**Responsibilities**:
- Execute matching queries against MongoDB
- Filter results by userId (multi-tenancy)
- Run scoring algorithm
- Create match documents
- Trigger notifications

**Key Functions**:
- `matchClientToInventory(clientId: string): Promise<Match[]>`
- `matchInventoryToClients(inventoryId: string): Promise<Match[]>`
- `buildMatchQuery(parsedCriteria: ParsedCriteria): object`
- `createMatch(clientId, inventoryId, score): Promise<Match>`

#### Scoring Algorithm
**File**: `lib/matching/scoring.ts` (new)

**Responsibilities**:
- Calculate 0-100 match score
- Provide score breakdown
- Apply disqualification rules
- Determine match quality tier

**Key Functions**:
- `calculateMatchScore(inventory, criteria): ScoreResult`
- `exactMatch(value, options): boolean`
- `fuzzyMatch(value, options): boolean`
- `familyMatch(model, options): boolean`

---

### 4. Data Layer

#### MongoDB Collections
See `01-TECHNICAL-DESIGN-DATA-MODELS.md` for detailed schemas.

**Collections**:
1. `clients` - Enhanced with lookingFor field
2. `inventory` - Enhanced with matchableFields
3. `matches` - New collection
4. `notifications` - New collection

**Indexes**: All collections have userId compound indexes for multi-tenancy performance.

---

### 5. Job Processing Layer

#### Cron-Based Processing
**Endpoint**: `app/api/cron/match-requests/route.ts` (new)

**How It Works**:
1. Coolify triggers cron job every 2 minutes
2. API route processes all pending/unmatched ClientRequests
3. For each request: parse with Gemini → match against cars → create notifications
4. Mark requests as processed

**Configuration**:
```typescript
// Cron endpoint with CRON_SECRET authentication
export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Process pending requests
  const pendingRequests = await ClientRequest.find({
    status: 'active',
    parsedCriteria: null  // Not yet parsed
  }).limit(50);
  
  for (const request of pendingRequests) {
    await parseAndMatch(request);
  }
}
```

**Coolify Cron Setup**:
- Schedule: `*/2 * * * *` (every 2 minutes)
- URL: `POST /api/cron/match-requests`
- Headers: `Authorization: Bearer {CRON_SECRET}`

---

### 6. External Services Integration

#### Gemini AI
**Client**: `lib/ai/gemini-client.ts` (new)

**Configuration**:
- Model: `gemini-1.5-flash`
- Temperature: 0.1 (deterministic)
- Max tokens: 2048
- Timeout: 10 seconds

#### Cloudflare R2
**Client**: Uses existing R2 configuration

**Usage**: Vehicle image storage and retrieval

#### Email Service (Phase 2 - Future)
**Client**: Will use existing email service (SendGrid/SES)

**Note**: Initial release focuses on in-app notifications only. Email notifications planned for Phase 2.

---

## Data Flow Diagrams

### Flow 1: Client Request Creation

```
┌──────────┐
│  User    │
│  Types   │
│  Prefs   │
└────┬─────┘
     │
     ▼
┌────────────────────┐
│  Frontend          │
│  Auto-saves after  │
│  2s debounce       │
└────┬───────────────┘
     │
     │ POST /api/clients/[id]
     │ { lookingFor: { rawText: "..." } }
     ▼
┌────────────────────┐
│  API Route         │
│  1. Verify auth    │
│  2. Update client  │
│  3. Queue job      │
└────┬───────────────┘
     │
     │ Returns 200 OK immediately
     │
     ├────────────────────────────┐
     │                            │
     ▼                            ▼
┌─────────────┐            ┌──────────────┐
│ Job Queue   │            │  Frontend    │
│ Adds:       │            │  Shows:      │
│ parse-ai    │            │  "Saved ✓"   │
└────┬────────┘            └──────────────┘
     │
     │ Worker picks up job
     ▼
┌─────────────────────┐
│  Worker Process     │
│  1. Call Gemini AI  │
│  2. Parse response  │
│  3. Save to DB      │
│  4. Queue matching  │
└────┬────────────────┘
     │
     ├─────────────────────────┐
     │                         │
     ▼                         ▼
┌──────────────┐      ┌────────────────┐
│ MongoDB      │      │  Job Queue     │
│ Update:      │      │  Adds:         │
│ parsedCrit.. │      │  match-client  │
└──────────────┘      └────┬───────────┘
                           │
                           │ Worker picks up job
                           ▼
                    ┌──────────────────┐
                    │  Worker Process  │
                    │  1. Query inven  │
                    │  2. Score each   │
                    │  3. Create match │
                    │  4. Create notif │
                    └────┬─────────────┘
                         │
                         ▼
                    ┌──────────────┐
                    │  MongoDB     │
                    │  Creates:    │
                    │  • matches   │
                    │  • notifs    │
                    └────┬─────────┘
                         │
                         │ Queue email job
                         ▼
                    ┌──────────────┐
                    │  Email sent  │
                    │  to user     │
                    └──────────────┘
```

### Flow 2: New Inventory Item

```
┌──────────┐
│  User    │
│  Adds    │
│  Vehicle │
└────┬─────┘
     │
     ▼
┌────────────────────┐
│  Frontend          │
│  Submit form       │
└────┬───────────────┘
     │
     │ POST /api/inventory
     │ { make, model, price, ... }
     ▼
┌────────────────────┐
│  API Route         │
│  1. Verify auth    │
│  2. Save inventory │
│  3. Queue job      │
└────┬───────────────┘
     │
     │ Returns 201 Created
     │
     ├────────────────────────────┐
     │                            │
     ▼                            ▼
┌─────────────┐            ┌──────────────┐
│ Job Queue   │            │  Frontend    │
│ Adds:       │            │  Shows new   │
│ match-inv   │            │  vehicle     │
└────┬────────┘            └──────────────┘
     │
     │ Worker picks up job
     ▼
┌─────────────────────┐
│  Worker Process     │
│  1. Get ALL clients │
│     (all users)     │
│  2. Filter by       │
│     userId match    │
│  3. Score each      │
│  4. Create matches  │
└────┬────────────────┘
     │
     │ For each match where
     │ client.userId === inventory.userId
     ▼
┌──────────────────┐
│  MongoDB         │
│  Creates:        │
│  • match doc     │
│  • notification  │
└────┬─────────────┘
     │
     │ Batch by userId
     ▼
┌──────────────────┐
│  Send emails     │
│  (batched)       │
└──────────────────┘
```

---

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **UI Library**: React 18
- **Styling**: TailwindCSS
- **State Management**: React Context API
- **Forms**: React Hook Form
- **HTTP Client**: Fetch API (native)

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Next.js API Routes
- **Language**: TypeScript 5
- **Validation**: Zod
- **Authentication**: Existing session management

### Database
- **Primary**: MongoDB Atlas 7.0+
- **ODM**: Mongoose 8
- **Indexes**: Compound indexes on userId
- **TTL**: Auto-expiry for old matches/notifications

### Background Processing
- **Scheduling**: Coolify Cron Jobs
- **Frequency**: Every 2 minutes
- **No Redis Required**: Simpler infrastructure

### External Services
- **AI**: Gemini AI (gemini-1.5-flash) via @google/generative-ai
- **Storage**: Cloudflare R2 (S3-compatible)
- **Email**: (Phase 2) SendGrid / AWS SES / Resend

### DevOps
- **Deployment**: Coolify on Cloud VPS
- **Monitoring**: Application logs + MongoDB Atlas monitoring
- **Testing**: Jest + Supertest
- **CI/CD**: Git-based deployment via Coolify

---

## Scalability Considerations

### Current Scale (Target)
- **Users**: 10-30 concurrent
- **Inventory per user**: 30-180 vehicles
- **Total inventory**: ~900-5,400 vehicles
- **Client requests per user**: 20-100
- **Matches per day**: 50-200

### Performance Targets
| Operation | Target | Notes |
|-----------|--------|-------|
| API Response (p95) | <500ms | Excluding background jobs |
| AI Parsing | <10s | Background job |
| Client→Inventory matching | <30s | Background job |
| Inventory→Clients matching | <60s | Background job |
| Notification delivery | <5min | Including email |
| Database queries (p95) | <100ms | With proper indexes |

### Scaling Strategy

#### Horizontal Scaling
- **Web servers**: Stateless Next.js instances (scale to N)
- **Cron jobs**: Single cron endpoint (sufficient for 10-30 users)
- **MongoDB**: Sharding by userId (future, if needed)

#### Vertical Scaling
- **Current**: Single VPS (4 CPU, 8GB RAM)
- **Next tier**: 8 CPU, 16GB RAM (handles 100+ users)

#### Database Optimization
1. **Indexes**: All critical queries use indexes
2. **Denormalization**: matchCount, vehicleSummary stored in docs
3. **Pagination**: All list endpoints paginated (20-50 per page)
4. **Connection pooling**: MongoDB connection pool (min: 10, max: 100)

#### Caching Strategy
1. **AI Parsing**: Cache parsed results in MongoDB (until rawText changes)
2. **User sessions**: Existing session management
3. **Match results**: No caching (always fresh from DB)

#### Cron Job Optimization
1. **Batch processing**: Process up to 50 requests per run
2. **Rate limiting**: Gemini AI has 60 req/min on free tier
3. **Error tracking**: Log failures for manual review

### Future Scaling (1000+ users)
1. **MongoDB Sharding**: Shard by userId
2. **BullMQ + Redis**: Add job queue if cron becomes insufficient
3. **CDN**: Cache static assets (R2 images)
4. **Database Replicas**: Read replicas for queries
5. **Microservices**: Split matching engine into separate service

---

## Security Architecture

See `01-TECHNICAL-DESIGN-SECURITY.md` for comprehensive security details.

**Key Principles**:
1. Multi-tenant isolation enforced at every layer
2. All API routes require authentication
3. Resource ownership verified before operations
4. Input validation and sanitization
5. No sensitive data in client-side code

---

## Monitoring & Observability

### Application Metrics
- API response times (p50, p95, p99)
- Error rates by endpoint
- Job queue length and processing time
- AI parsing success/failure rate
- Match creation rate

### Business Metrics
- Active users using feature
- Matches generated per user
- Notification click-through rate
- AI parsing accuracy (manual validation)

### Alerts
- Error rate >5%
- Cron job failures
- AI parsing failures >20%
- Database slow queries >1s

### Logging
- Structured JSON logs
- Log levels: ERROR, WARN, INFO, DEBUG
- Correlation IDs for request tracing
- Sensitive data filtered (PII removed)

---

**Next Document**: [Data Models](./01-TECHNICAL-DESIGN-DATA-MODELS.md)
