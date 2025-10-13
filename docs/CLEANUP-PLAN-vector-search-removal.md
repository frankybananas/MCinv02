# Vector Search & AI Matching Cleanup Plan

## ⚠️ **STATUS: PHASES 1-6 COMPLETE** ⚠️

**Last Updated**: October 13, 2025  
**Cleanup Progress**: 60% Complete (6/10 phases)

## Executive Summary
This document outlines the comprehensive plan to remove the abandoned vector search and AI matching features from the MCinv02 codebase. The features were partially implemented but never completed, leaving legacy code that imports non-existent modules and unused database fields.

## Scope of Cleanup

### Abandoned Features to Remove
1. **Vector Search Integration** - Qdrant vector database integration
2. **AI Embeddings** - OpenAI embedding generation for cars and requests
3. **Match System** - AI-powered car-to-client matching functionality
4. **Request Parsing** - Natural language request parsing with AI

### Goals
- ✅ Remove all non-functional code
- ✅ Maintain existing working features (Cars, Clients, Deliveries)
- ✅ Achieve 80%+ test coverage on all modified files
- ✅ Maintain 8/10+ code quality score
- ✅ Update all documentation

---

## Phase 1: Dependency Audit ✅ COMPLETED

### Findings

#### Missing Library Files (Imported but don't exist)
- ❌ `lib/embeddings.ts` - Imported in 4 API routes
- ❌ `lib/vector-store.ts` - Imported in 3 API routes
- ❌ `lib/parse-request.ts` - Imported in 1 API route

#### Package Dependencies to Remove
- `@qdrant/js-client-rest` (^1.11.0) - Vector database client
- `openai` (^4.58.1) - Only used for vector features (verify no other usage)

#### Database Schema Fields to Remove
**Car Model (`models/Car.js`)**:
- `searchText` - Generated text for embedding
- `embeddingVector` - Stored embedding array
- `embeddingModel` - Model identifier
- `lastEmbeddedAt` - Timestamp of last embedding

**ClientRequest Model (`models/ClientRequest.ts`)**:
- `requestText` - Generated text for embedding
- `embeddingVector` - Stored embedding array
- `embeddingModel` - Model identifier
- `lastEmbeddedAt` - Timestamp of last embedding

**Match Model (`models/Match.ts`)** - ENTIRE MODEL TO BE REMOVED:
- Complete matching system between cars and client requests

#### API Routes Affected
1. `app/api/cars/route.js` - Car creation with embedding
2. `app/api/cars/[id]/route.js` - Match cleanup on car delete
3. `app/api/clients/route.js` - Client creation with auto-request parsing
4. `app/api/clients/[id]/requests/route.ts` - Request CRUD with embeddings
5. `app/api/clients/[id]/requests/[requestId]/route.ts` - Request updates
6. `app/api/clients/[id]/matches/route.ts` - Match listing
7. `app/api/matches/[id]/view/route.ts` - Match view tracking
8. `app/api/matches/[id]/dismiss/route.ts` - Match dismissal
9. `app/api/matches/[id]/contacted/route.ts` - Match contact tracking
10. `app/api/notifications/route.ts` - Match notifications

#### Type Definitions to Update
**`app/types.ts`**:
- `ClientRequest` interface - Remove embedding fields
- `MatchItem` interface - REMOVE entirely
- `NotificationItem` - Remove match-related notification types

---

## Phase 2: Package Dependency Removal

### Tasks
1. **Remove from package.json**:
   ```json
   "@qdrant/js-client-rest": "^1.11.0",
   "openai": "^4.58.1"
   ```

2. **Verify no other OpenAI usage** (e.g., chat features, other AI functionality)
   - Search codebase for any legitimate OpenAI usage outside vector features
   - If found, document and exclude from removal

3. **Run dependency cleanup**:
   ```bash
   pnpm remove @qdrant/js-client-rest openai
   pnpm install
   ```

4. **Update lockfile**:
   - Ensure `pnpm-lock.yaml` is properly updated

### Testing Strategy
- ✅ Application builds successfully after removal
- ✅ No import errors for remaining code
- ✅ Dev server starts without errors

---

## Phase 3: Model Cleanup

### Match Model Removal

**File**: `models/Match.ts` - DELETE ENTIRELY

**Rationale**: Match model is entirely part of the abandoned feature set.

**Testing Requirements**:
- ✅ Verify no other parts of codebase import Match (except API routes to be cleaned)
- ✅ Database migration plan for existing Match data (if any exists in production)

### Car Model Updates

**File**: `models/Car.js`

**Changes**:
```javascript
// REMOVE these fields from schema:
searchText: { type: String },
embeddingVector: { type: [Number] },
embeddingModel: { type: String },
lastEmbeddedAt: { type: Date },
```

**Testing Requirements**:
- ✅ Test car creation without vector fields
- ✅ Test car updates work correctly
- ✅ Test car queries return expected data
- ✅ Coverage: 80%+ of Car model logic

### ClientRequest Model Updates

**File**: `models/ClientRequest.ts`

**Changes**:
```typescript
// REMOVE from interface:
requestText?: string;
embeddingVector?: number[];
embeddingModel?: string;
lastEmbeddedAt?: Date;

// REMOVE from schema:
requestText: { type: String },
embeddingVector: { type: [Number] },
embeddingModel: { type: String },
lastEmbeddedAt: { type: Date },
```

**Testing Requirements**:
- ✅ Test request creation without vector fields
- ✅ Test request updates work correctly
- ✅ Test request queries return expected data
- ✅ Coverage: 80%+ of ClientRequest model logic

---

## Phase 4: API Route Cleanup

### 4.1 Cars API Route

**File**: `app/api/cars/route.js`

**Changes**:
1. Remove imports:
   ```javascript
   import ClientRequest from '@/models/ClientRequest';
   import Match from '@/models/Match';
   import { buildCarSearchText, embedText, explainMatchShort } from '@/lib/embeddings';
   import { upsertCarVector, searchRequestsByVector } from '@/lib/vector-store';
   ```

2. Remove embedding and matching code (lines ~156-220):
   - Remove `buildCarSearchText()` call
   - Remove `embedText()` call
   - Remove vector field updates
   - Remove `upsertCarVector()` call
   - Remove `searchRequestsByVector()` call
   - Remove Match creation loop

**Testing Requirements**:
- ✅ Test POST /api/cars creates car successfully
- ✅ Test image upload still works
- ✅ Test audit log is created
- ✅ Test GET /api/cars returns all cars
- ✅ Coverage: 80%+

### 4.2 Car Detail API Route

**File**: `app/api/cars/[id]/route.js`

**Changes**:
1. Remove imports:
   ```javascript
   import Match from '@/models/Match.ts';
   ```

2. Remove Match cleanup code (lines ~386-392):
   ```javascript
   // Remove matches associated with this car
   try {
     await Match.deleteMany({ car: id });
   } catch (e) {
     console.error('Failed to delete Match records for car', id, e);
   }
   ```

**Testing Requirements**:
- ✅ Test DELETE /api/cars/[id] removes car
- ✅ Test PUT /api/cars/[id] updates car
- ✅ Test GET /api/cars/[id] retrieves car
- ✅ Coverage: 80%+

### 4.3 Clients API Route

**File**: `app/api/clients/route.js`

**Changes**:
1. Remove imports:
   ```javascript
   import ClientRequest from '@/models/ClientRequest';
   import Match from '@/models/Match';
   import User from '@/models/User';
   import { parseNotesToRequest } from '@/lib/parse-request';
   import { buildRequestText, embedText, explainMatchShort } from '@/lib/embeddings';
   import { upsertRequestVector, searchCarsByVector } from '@/lib/vector-store';
   ```

2. Remove auto-seed request logic (lines ~87-174):
   - Remove `parseNotesToRequest()` call
   - Remove request creation from notes
   - Remove embedding generation
   - Remove vector upsert
   - Remove matching logic

**Testing Requirements**:
- ✅ Test POST /api/clients creates client successfully
- ✅ Test client creation without notes works
- ✅ Test GET /api/clients returns user's clients (with isolation)
- ✅ Coverage: 80%+

### 4.4 Client Requests API Routes

**File**: `app/api/clients/[id]/requests/route.ts`

**Changes**:
1. Remove imports:
   ```javascript
   import type { IMatch } from '@/models/Match'
   import { buildRequestText, embedText, explainMatchShort } from '@/lib/embeddings'
   import { upsertRequestVector, searchCarsByVector } from '@/lib/vector-store'
   ```

2. Simplify POST handler:
   - Remove embedding generation
   - Remove vector upsert
   - Remove car search and matching
   - Keep basic request creation

**Testing Requirements**:
- ✅ Test POST /api/clients/[id]/requests creates request
- ✅ Test GET /api/clients/[id]/requests returns requests
- ✅ Test user isolation works correctly
- ✅ Coverage: 80%+

**File**: `app/api/clients/[id]/requests/[requestId]/route.ts`

**Changes**:
1. Remove imports:
   ```javascript
   import { buildRequestText, embedText } from '@/lib/embeddings'
   import { upsertRequestVector } from '@/lib/vector-store'
   ```

2. Simplify PUT handler:
   - Remove embedding logic
   - Remove vector upsert
   - Keep basic request update

**Testing Requirements**:
- ✅ Test PUT updates request successfully
- ✅ Test DELETE removes request
- ✅ Coverage: 80%+

### 4.5 Remove Matches API Endpoints

**Delete Entire Directory**: `app/api/matches/`
- `app/api/matches/[id]/view/route.ts`
- `app/api/matches/[id]/dismiss/route.ts`
- `app/api/matches/[id]/contacted/route.ts`

**Delete Entire Directory**: `app/api/clients/[id]/matches/`
- `app/api/clients/[id]/matches/route.ts`

**No tests needed** - endpoints completely removed

### 4.6 Notifications API Route

**File**: `app/api/notifications/route.ts`

**Changes**:
1. Remove Match imports and queries (lines ~301-339):
   - Remove Match model import
   - Remove match notification aggregation
   - Remove `client_match` notification type handling

**Testing Requirements**:
- ✅ Test GET /api/notifications returns notifications
- ✅ Test car/delivery notifications still work
- ✅ Test user isolation maintained
- ✅ Coverage: 80%+

---

## Phase 5: Type Definition Updates

**File**: `app/types.ts`

**Changes**:
1. Remove `MatchItem` interface entirely
2. Remove `MatchStatus` type
3. Update `ClientRequest` interface - remove vector fields
4. Update `NotificationType` - remove `"client_match"`

**Testing Requirements**:
- ✅ TypeScript compilation succeeds
- ✅ No type errors in codebase
- ✅ IDE autocomplete works correctly

---

## Phase 6: Frontend Component Updates

### Components to Check for Match References

1. **`app/components/dashboard.tsx`**
   - Check for match-related notifications display
   - Remove if present

2. **`app/components/client-detail.tsx`**
   - Check for match display section
   - Remove if present

3. **`app/components/notifications.tsx`** (if exists)
   - Remove match notification handling

**Testing Requirements**:
- ✅ Visual regression testing for affected components
- ✅ Component renders without errors
- ✅ No console errors in browser

---

## Phase 7: Test Suite Creation

### Test Files to Create/Update

#### Model Tests
1. **`__tests__/models/car.test.ts`**
   - Test car creation without vector fields
   - Test car updates
   - Test car queries
   - Target: 80%+ coverage

2. **`__tests__/models/client-request.test.ts`**
   - Test request creation without vector fields
   - Test request updates
   - Test user isolation
   - Target: 80%+ coverage

#### API Route Tests
3. **`__tests__/api/cars.test.ts`**
   - Test GET /api/cars
   - Test POST /api/cars
   - Test image upload
   - Target: 80%+ coverage

4. **`__tests__/api/cars-[id].test.ts`**
   - Test GET /api/cars/[id]
   - Test PUT /api/cars/[id]
   - Test DELETE /api/cars/[id]
   - Target: 80%+ coverage

5. **`__tests__/api/clients.test.ts`**
   - Test GET /api/clients
   - Test POST /api/clients
   - Test user isolation
   - Target: 80%+ coverage

6. **`__tests__/api/client-requests.test.ts`**
   - Test request CRUD operations
   - Test user isolation
   - Target: 80%+ coverage

7. **`__tests__/api/notifications.test.ts`**
   - Test notification aggregation
   - Test notification types (excluding matches)
   - Target: 80%+ coverage

### Testing Commands
```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Verify 80%+ coverage
# Check coverage/lcov-report/index.html
```

---

## Phase 8: Code Quality Checks

### Quality Metrics Target: 8/10+

#### Tools to Use
1. **ESLint** - Linting and code style
   ```bash
   pnpm lint
   ```

2. **TypeScript Compiler** - Type checking
   ```bash
   pnpm typecheck
   ```

3. **Code Complexity Analysis** - Cyclomatic complexity check
   - Use tools like `complexity-report` or `plato`
   - Target: Cyclomatic complexity < 10 per function

4. **Code Review Checklist**:
   - ✅ No unused imports
   - ✅ No dead code
   - ✅ Proper error handling
   - ✅ Consistent naming conventions
   - ✅ Adequate comments for complex logic
   - ✅ No console.log statements in production code

### Quality Scoring Criteria
- **Maintainability**: 8/10+ (low complexity, clear structure)
- **Reliability**: 8/10+ (proper error handling, edge cases covered)
- **Security**: 8/10+ (input validation, no vulnerabilities)
- **Testability**: 8/10+ (80%+ coverage, clear test cases)

---

## Phase 9: Documentation Updates

### Documentation Files to Update

1. **Delete Created Spec Files**:
   - `docs/feature-vector-search-spec.md` - DELETE
   - `docs/feature-notifications-spec.md` - REWRITE (remove match content)
   - `docs/main-integration-spec.md` - REWRITE (remove vector references)

2. **Update Remaining Specs**:
   - `docs/feature-cars-spec.md` - Remove vector integration sections
   - `docs/feature-clients-spec.md` - Remove AI parsing and matching sections
   - `docs/feature-deliveries-spec.md` - Verify no match references

3. **Update README.md** (if mentions vector features):
   - Remove AI matching features from description
   - Update architecture diagram
   - Update feature list

---

## Rollback Plan

### If Issues Arise

1. **Git Branch Strategy**:
   ```bash
   # Work in feature branch
   git checkout -b cleanup/remove-vector-search
   
   # Commit each phase separately
   git commit -m "Phase 2: Remove vector package dependencies"
   git commit -m "Phase 3: Clean up model schemas"
   # etc.
   ```

2. **Database Migration Rollback**:
   - Keep Match collection in database (mark as deprecated)
   - Don't drop vector fields immediately (mark as optional)
   - Plan full cleanup after 30 days in production

3. **Testing Checkpoints**:
   - Full test suite must pass after each phase
   - Application must build successfully
   - Dev server must run without errors

---

## Success Criteria

### Completion Checklist
- [ ] All non-existent imports removed
- [ ] All vector-related code removed from API routes
- [ ] Match model and API endpoints removed
- [ ] Type definitions updated
- [ ] 80%+ test coverage on all modified files
- [ ] 8/10+ code quality score on all modified files
- [ ] All tests passing
- [ ] Application builds successfully
- [ ] Documentation updated
- [ ] No console errors in development
- [ ] Production deployment successful (staging first)

### Performance Metrics
- Application should maintain or improve current performance
- No increase in bundle size (should decrease without vector libraries)
- No regression in existing features

---

## Estimated Timeline

- **Phase 1**: ✅ Complete (Audit)
- **Phase 2**: 1 hour (Package removal)
- **Phase 3**: 2 hours (Model cleanup + tests)
- **Phase 4**: 6 hours (API route cleanup + tests)
- **Phase 5**: 1 hour (Type updates)
- **Phase 6**: 2 hours (Frontend updates if needed)
- **Phase 7**: 8 hours (Comprehensive testing)
- **Phase 8**: 3 hours (Quality checks and fixes)
- **Phase 9**: 2 hours (Documentation updates)

**Total Estimated Time**: 25 hours

---

## Next Steps

1. Review this plan with team/stakeholders
2. Create Git branch for cleanup work
3. Begin Phase 2: Package dependency removal
4. Progress through phases sequentially
5. Create PR with comprehensive testing evidence
6. Deploy to staging for validation
7. Deploy to production after stakeholder approval
