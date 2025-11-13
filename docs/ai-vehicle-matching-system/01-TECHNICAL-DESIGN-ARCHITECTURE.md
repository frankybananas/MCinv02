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
- **Job Processing Layer**: BullMQ + Redis for background tasks
- **External Services**: Gemini AI, Cloudflare R2, Email service

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
│  │  • Clients Page (with "Looking for" input)                   │  │
│  │  • Inventory Page (with match indicators)                    │  │
│  │  • Notifications Page (match display)                        │  │
│  │  • Toast Notifications                                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                │                                     │
│  ┌──────────────────────────────▼──────────────────────────────┐  │
│  │                    API Routes Layer                          │  │
│  │  ┌────────────────────────────────────────────────────┐     │  │
│  │  │  Authentication Middleware                         │     │  │
│  │  │  • Extract userId from session/JWT                 │     │  │
│  │  │  • Verify user is authenticated                    │     │  │
│  │  └────────────────────────────────────────────────────┘     │  │
│  │  ┌────────────────────────────────────────────────────┐     │  │
│  │  │  Authorization Middleware                          │     │  │
│  │  │  • Verify userId owns resource                     │     │  │
│  │  │  • Enforce multi-tenant isolation                  │     │  │
│  │  └────────────────────────────────────────────────────┘     │  │
│  │  ┌────────────────────────────────────────────────────┐     │  │
│  │  │  API Endpoints                                     │     │  │
│  │  │  • /api/clients/*                                  │     │  │
│  │  │  • /api/inventory/*                                │     │  │
│  │  │  • /api/matches/*                                  │     │  │
│  │  │  • /api/notifications/*                            │     │  │
│  │  └────────────────────────────────────────────────────┘     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                │                                     │
│  ┌──────────────────────────────▼──────────────────────────────┐  │
│  │                 Business Logic Layer                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │  │
│  │  │ AI Parsing   │  │  Matching    │  │  Scoring     │      │  │
│  │  │   Engine     │  │   Engine     │  │  Algorithm   │      │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌────────────────┐     ┌────────────────┐
│   MONGODB     │      │ JOB QUEUE      │     │ EXTERNAL APIs  │
│    ATLAS      │      │ (BullMQ+Redis) │     │                │
│               │      │                │     │  • Gemini AI   │
│ Collections:  │      │ Job Types:     │     │  • R2 Storage  │
│ • clients     │      │ • parse-ai     │     │  • Email Svc   │
│ • inventory   │      │ • match-client │     │                │
│ • matches     │      │ • match-inven  │     └────────────────┘
│ • notifs      │      │ • send-email   │
└───────────────┘      └────────────────┘
        │                       │
        │              ┌────────▼────────┐
        │              │  WORKER PROCESS │
        │              │                 │
        │              │  Processes jobs │
        │◄─────────────┤  from queue     │
        │              │  asynchronously │
        │              └─────────────────┘
        │
        │ (All queries filtered by userId)
        │
┌───────▼────────────────────────────────────────┐
│     MULTI-TENANT DATA ISOLATION                │
│  Every query includes: { userId: ObjectId }    │
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

#### Job Queue (BullMQ)
**Configuration**: `lib/jobs/queue-config.ts` (new)

```typescript
const jobQueue = new Queue('vehicle-matching', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100,  // Keep last 100 completed
    removeOnFail: 500       // Keep last 500 failed
  }
});
```

#### Worker Process
**File**: `workers/matching-worker.ts` (new)

**Responsibilities**:
- Process jobs from queue
- Execute matching logic
- Handle errors and retries
- Update job status

**Deployment**: Separate Node.js process on Coolify

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

#### Email Service
**Client**: Uses existing email service (SendGrid/SES)

**Usage**: Email notifications for matches

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

### Job Queue
- **Queue**: BullMQ 4
- **Storage**: Redis 7
- **Dashboard**: Bull Board (optional)

### External Services
- **AI**: Gemini AI (gemini-1.5-flash)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Email**: SendGrid / AWS SES / Resend

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
- **Worker processes**: Independent worker instances (scale to M)
- **Redis**: Redis Cluster for large queues
- **MongoDB**: Sharding by userId (future)

#### Vertical Scaling
- **Current**: Single VPS (4 CPU, 8GB RAM)
- **Next tier**: 8 CPU, 16GB RAM (handles 100+ users)

#### Database Optimization
1. **Indexes**: All critical queries use indexes
2. **Denormalization**: matchCount, vehicleSummary stored in docs
3. **Pagination**: All list endpoints paginated (20-50 per page)
4. **Connection pooling**: MongoDB connection pool (min: 10, max: 100)

#### Caching Strategy
1. **AI Parsing**: Cache parsed results indefinitely (until rawText changes)
2. **User sessions**: Redis or in-memory cache
3. **Notification counts**: Cache with 30s TTL
4. **Match results**: No caching (always fresh from DB)

#### Job Queue Optimization
1. **Priority queues**: High priority for new matches
2. **Batch processing**: Group similar jobs
3. **Rate limiting**: Prevent queue overflow
4. **Dead letter queue**: Failed jobs after max retries

### Future Scaling (1000+ users)
1. **MongoDB Sharding**: Shard by userId
2. **Redis Cluster**: Distributed job queue
3. **CDN**: Cache static assets (R2 images)
4. **Database Replicas**: Read replicas for queries
5. **Microservices**: Split matching engine into separate service
6. **Message Queue**: Replace BullMQ with RabbitMQ/Kafka

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
- Job queue length >1000
- AI parsing failures >20%
- Database slow queries >1s
- Worker process down

### Logging
- Structured JSON logs
- Log levels: ERROR, WARN, INFO, DEBUG
- Correlation IDs for request tracing
- Sensitive data filtered (PII removed)

---

**Next Document**: [Data Models](./01-TECHNICAL-DESIGN-DATA-MODELS.md)
