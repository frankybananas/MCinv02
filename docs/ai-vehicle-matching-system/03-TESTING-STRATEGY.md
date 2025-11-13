# Testing Strategy

## Overview
Comprehensive testing strategy covering unit tests, integration tests, security tests, and performance tests to ensure the AI-powered vehicle matching system works reliably and securely.

**Target Coverage**: >80% statement coverage  
**Test Framework**: Jest + Supertest  
**Test Command**: `pnpm test`

---

## 1. Unit Tests

### 1.1 AI Parsing Tests

**File**: `__tests__/lib/ai/gemini-parser.test.ts`

**Test Cases** (30 tests):

```typescript
describe('Gemini Parser', () => {
  describe('parseClientPreferences', () => {
    it('should parse simple make/model preference', async () => {
      const input = "Toyota Corolla";
      const result = await parseClientPreferences(input);
      expect(result.makes).toEqual(['Toyota']);
      expect(result.models).toEqual(['Corolla']);
    });

    it('should parse color-exclusive preferences', async () => {
      const input = "White/silver only Toyota Cross";
      const result = await parseClientPreferences(input);
      expect(result.colors.preferred).toEqual(['White', 'Silver']);
      expect(result.colors.exclusive).toBe(true);
    });

    it('should parse year range correctly', async () => {
      const input = "BMW 3 series between 2015-2019";
      const result = await parseClientPreferences(input);
      expect(result.yearMin).toBe(2015);
      expect(result.yearMax).toBe(2019);
    });

    it('should parse price range with flexibility', async () => {
      const input = "Honda CR-V around R350k";
      const result = await parseClientPreferences(input);
      expect(result.priceMax).toBeCloseTo(350000, -3);
      expect(result.priceFlexible).toBe(true);
    });

    it('should handle abbreviations (Merc → Mercedes-Benz)', async () => {
      const input = "Merc C-Class";
      const result = await parseClientPreferences(input);
      expect(result.makes).toContain('Mercedes-Benz');
    });

    it('should flag low confidence parses', async () => {
      const input = "Something vague and unclear";
      const result = await parseClientPreferences(input);
      expect(result.requiresManualReview).toBe(true);
      expect(result.parsingConfidence).toBeLessThan(0.6);
    });

    it('should handle retry on AI failure', async () => {
      mockGemini AI.mockRejectedValueOnce(new Error('Rate limit'));
      const input = "Toyota Corolla";
      const result = await parseClientPreferences(input);
      expect(result).toBeDefined(); // Should retry and succeed
    });

    it('should return cached result if available', async () => {
      const input = "Toyota Corolla";
      await parseClientPreferences(input); // First call
      const spy = jest.spyOn(geminiClient, 'call');
      await parseClientPreferences(input); // Second call
      expect(spy).not.toHaveBeenCalled(); // Should use cache
    });
  });
});
```

**Expected Coverage**: >90%

---

### 1.2 Scoring Algorithm Tests

**File**: `__tests__/lib/matching/scoring.test.ts`

**Test Cases** (40 tests):

```typescript
describe('Scoring Algorithm', () => {
  describe('calculateMatchScore', () => {
    it('should score exact make/model match highly', () => {
      const inventory = {
        make: 'Toyota',
        model: 'Corolla Cross',
        year: 2021,
        price: 450000,
        color: 'White'
      };
      const criteria = {
        makes: ['Toyota'],
        models: ['Corolla Cross'],
        colors: { preferred: ['White'], exclusive: false }
      };
      const result = calculateMatchScore(inventory, criteria);
      expect(result.score).toBeGreaterThanOrEqual(85); // Excellent
      expect(result.matchQuality).toBe('Excellent');
    });

    it('should disqualify if price over budget and not flexible', () => {
      const inventory = { price: 500000 };
      const criteria = { priceMax: 450000, priceFlexible: false };
      const result = calculateMatchScore(inventory, criteria);
      expect(result.disqualified).toBe(true);
      expect(result.reason).toContain('Price over budget');
    });

    it('should allow slightly over budget if flexible', () => {
      const inventory = { price: 460000 };
      const criteria = { priceMax: 450000, priceFlexible: true };
      const result = calculateMatchScore(inventory, criteria);
      expect(result.disqualified).toBe(false);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should disqualify if wrong color and exclusive', () => {
      const inventory = { color: 'Black' };
      const criteria = { colors: { preferred: ['White'], exclusive: true } };
      const result = calculateMatchScore(inventory, criteria);
      expect(result.disqualified).toBe(true);
    });

    it('should handle fuzzy make matching', () => {
      const inventory = { make: 'Mercedes-Benz' };
      const criteria = { makes: ['Merc'] };
      const result = calculateMatchScore(inventory, criteria);
      expect(result.breakdown.makeMatch).toBeGreaterThan(0);
    });

    it('should score partial year match', () => {
      const inventory = { year: 2019 };
      const criteria = { yearMin: 2020, yearMax: 2024 };
      const result = calculateMatchScore(inventory, criteria);
      expect(result.breakdown.yearMatch).toBeGreaterThan(0);
      expect(result.breakdown.yearMatch).toBeLessThan(15);
    });
  });

  describe('Score Breakdown', () => {
    it('should provide detailed breakdown for debugging', () => {
      const result = calculateMatchScore(inventory, criteria);
      expect(result.breakdown).toHaveProperty('makeMatch');
      expect(result.breakdown).toHaveProperty('modelMatch');
      expect(result.breakdown).toHaveProperty('yearMatch');
      expect(result.breakdown).toHaveProperty('priceMatch');
      expect(result.breakdown).toHaveProperty('colorMatch');
      expect(result.breakdown).toHaveProperty('otherMatch');
    });
  });
});
```

**Expected Coverage**: >95%

---

### 1.3 Match Engine Tests

**File**: `__tests__/lib/matching/match-engine.test.ts`

**Test Cases** (25 tests):

```typescript
describe('Match Engine', () => {
  describe('matchClientToInventory', () => {
    it('should find matches above threshold', async () => {
      const clientId = 'client123';
      const matches = await matchClientToInventory(clientId);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].matchScore).toBeGreaterThanOrEqual(70);
    });

    it('should enforce multi-tenancy (userId filter)', async () => {
      const spy = jest.spyOn(db.cars, 'find');
      await matchClientToInventory('client123');
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ userId: expect.any(Object) })
      );
    });

    it('should not create duplicate matches', async () => {
      await matchClientToInventory('client123'); // First run
      await matchClientToInventory('client123'); // Second run
      const matchCount = await db.matches.countDocuments({ clientId: 'client123' });
      // Should not double-create matches
    });

    it('should only match In-Stock or Coming vehicles', async () => {
      await matchClientToInventory('client123');
      const matches = await db.matches.find({ clientId: 'client123' });
      matches.forEach(match => {
        expect(['In-Stock', 'Coming']).toContain(match.inventoryStatusAtMatch);
      });
    });
  });

  describe('matchInventoryToClients', () => {
    it('should match against all clients but only create for same userId', async () => {
      const inventoryId = 'inv123';
      const matches = await matchInventoryToClients(inventoryId);
      matches.forEach(match => {
        expect(match.userId).toBe(inventory.userId);
      });
    });
  });
});
```

**Expected Coverage**: >85%

---

## 2. Integration Tests

### 2.1 End-to-End Matching Flow

**File**: `__tests__/integration/matching-flow.test.ts`

**Test Cases** (10 scenarios):

```typescript
describe('End-to-End Matching Flow', () => {
  it('should complete full flow: client request → parse → match → notify', async () => {
    // 1. Create client with preferences
    const client = await request(app)
      .post('/api/clients')
      .send({
        clientName: 'Test Client',
        lookingFor: { rawText: 'White Toyota Cross 2020+ under R480k' }
      })
      .expect(201);

    // 2. Wait for parsing job
    await waitForJob('parse-client-request');
    
    // 3. Verify parsed criteria saved
    const updated = await db.clients.findById(client.body.data._id);
    expect(updated.lookingFor.parsedCriteria).toBeDefined();
    expect(updated.lookingFor.parsedCriteria.makes).toContain('Toyota');

    // 4. Add matching inventory
    const inventory = await request(app)
      .post('/api/inventory')
      .send({
        make: 'Toyota',
        model: 'Corolla Cross',
        year: 2021,
        price: 450000,
        color: 'White',
        status: 'In-Stock'
      })
      .expect(201);

    // 5. Wait for matching job
    await waitForJob('match-inventory-to-clients');

    // 6. Verify match created
    const matches = await db.matches.find({ clientId: client.body.data._id });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].matchScore).toBeGreaterThanOrEqual(70);

    // 7. Verify notification created
    const notifications = await db.notifications.find({ 
      userId: client.body.data.userId,
      'data.matchId': matches[0]._id 
    });
    expect(notifications.length).toBe(1);

    // 8. Verify email queued
    const emailJobs = await jobQueue.getJobs(['waiting', 'active'], 0, 10);
    const emailJob = emailJobs.find(j => j.name === 'send-email');
    expect(emailJob).toBeDefined();
  });

  it('should handle inventory update triggering re-match', async () => {
    // Create initial inventory (expensive)
    // Update to lower price
    // Verify new match created for client with lower budget
  });

  it('should not match across different users', async () => {
    // User A creates client request
    // User B adds matching inventory
    // Verify NO match created (multi-tenancy)
  });
});
```

**Expected Coverage**: Main flows covered

---

### 2.2 API Integration Tests

**File**: `__tests__/api/matches.test.ts`

**Test Cases** (20 tests):

```typescript
describe('Matches API', () => {
  describe('GET /api/matches', () => {
    it('should return only user's matches', async () => {
      const res = await request(app)
        .get('/api/matches')
        .set('Cookie', authCookie)
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.data.matches).toBeInstanceOf(Array);
      // Verify all matches belong to authenticated user
      res.body.data.matches.forEach(match => {
        expect(match.userId).toBe(authenticatedUserId);
      });
    });

    it('should filter by match quality', async () => {
      const res = await request(app)
        .get('/api/matches?quality=Excellent')
        .set('Cookie', authCookie)
        .expect(200);
      
      res.body.data.matches.forEach(match => {
        expect(match.matchQuality).toBe('Excellent');
      });
    });

    it('should paginate results', async () => {
      const res = await request(app)
        .get('/api/matches?limit=5&offset=0')
        .set('Cookie', authCookie)
        .expect(200);
      
      expect(res.body.data.matches.length).toBeLessThanOrEqual(5);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/matches')
        .expect(401);
    });
  });

  describe('PUT /api/matches/[id]/dismiss', () => {
    it('should dismiss match and update notification', async () => {
      const matchId = 'match123';
      const res = await request(app)
        .put(`/api/matches/${matchId}/dismiss`)
        .send({ reason: 'Not interested' })
        .set('Cookie', authCookie)
        .expect(200);
      
      expect(res.body.data.dismissed).toBe(true);
      
      // Verify notification also dismissed
      const notification = await db.notifications.findOne({ 'data.matchId': matchId });
      expect(notification.dismissed).toBe(true);
    });

    it('should not allow dismissing other user's match', async () => {
      const otherUserMatchId = 'other-match';
      await request(app)
        .put(`/api/matches/${otherUserMatchId}/dismiss`)
        .set('Cookie', authCookie)
        .expect(404); // Not found (ownership check)
    });
  });
});
```

**Expected Coverage**: >80%

---

## 3. Security Tests

### 3.1 Data Isolation Tests

**File**: `__tests__/security/data-isolation.test.ts`

**Test Cases** (15 critical tests):

```typescript
describe('Multi-Tenant Data Isolation', () => {
  let userAToken, userBToken;
  let userAClient, userBClient;
  let userAInventory, userBInventory;

  beforeEach(async () => {
    // Set up two separate users with data
    userAToken = await createAuthToken('userA');
    userBToken = await createAuthToken('userB');
    
    userAClient = await createClient('userA', { /* ... */ });
    userBClient = await createClient('userB', { /* ... */ });
    
    userAInventory = await createInventory('userA', { /* ... */ });
    userBInventory = await createInventory('userB', { /* ... */ });
  });

  it('should NOT allow User A to access User B client via API', async () => {
    await request(app)
      .get(`/api/clients/${userBClient._id}`)
      .set('Cookie', userAToken)
      .expect(404); // Not 403, to avoid info leakage
  });

  it('should NOT allow User A to update User B inventory', async () => {
    await request(app)
      .put(`/api/inventory/${userBInventory._id}`)
      .send({ price: 100000 })
      .set('Cookie', userAToken)
      .expect(404);
  });

  it('should NOT create match if client and inventory belong to different users', async () => {
    // User A has client request
    // User B adds matching inventory
    await waitForAllJobs();
    
    const matches = await db.matches.find({
      $or: [
        { clientId: userAClient._id, inventoryId: userBInventory._id },
        { clientId: userBClient._id, inventoryId: userAInventory._id }
      ]
    });
    expect(matches.length).toBe(0);
  });

  it('should NOT expose other user's data in MongoDB queries', async () => {
    // Spy on MongoDB queries
    const spy = jest.spyOn(db.clients, 'find');
    
    await request(app)
      .get('/api/clients')
      .set('Cookie', userAToken);
    
    // Verify ALL queries include userId filter
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'userA' })
    );
  });

  it('should NOT allow SQL/NoSQL injection in userId filter', async () => {
    const maliciousPayload = { $ne: null };
    // Attempt to inject
    await request(app)
      .get('/api/clients')
      .query({ userId: JSON.stringify(maliciousPayload) })
      .set('Cookie', userAToken)
      .expect(400); // Should be rejected
  });
});
```

**Expected Coverage**: 100% of critical paths

---

## 4. Performance Tests

### 4.1 Load Testing

**File**: `scripts/load-test.js`

**Scenarios** (5 tests):

```javascript
// Using artillery or k6 for load testing

export const options = {
  stages: [
    { duration: '1m', target: 10 },  // Ramp up to 10 users
    { duration: '3m', target: 30 },  // Hold at 30 users
    { duration: '1m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.05'],   // Error rate <5%
  },
};

export default function() {
  // Scenario 1: Create client with preferences
  http.post('/api/clients', JSON.stringify({
    clientName: `Client ${__VU}`,
    lookingFor: { rawText: 'Toyota Corolla 2020+' }
  }));
  sleep(1);

  // Scenario 2: Add inventory
  http.post('/api/inventory', JSON.stringify({
    make: 'Toyota',
    model: 'Corolla',
    year: 2021,
    price: 350000,
    status: 'In-Stock'
  }));
  sleep(1);

  // Scenario 3: Check notifications
  http.get('/api/notifications');
  sleep(2);

  // Scenario 4: View matches
  http.get('/api/matches');
  sleep(1);
}
```

**Performance Targets**:
- API Response Time (p95): <500ms
- Throughput: >100 requests/second
- Error Rate: <5%
- Concurrent Users: 30 without degradation

---

### 4.2 Database Query Performance

**Test**: Measure query execution time with `explain()`.

```typescript
describe('Database Performance', () => {
  it('should use index for client lookup', async () => {
    const explain = await db.clients
      .find({ userId: new ObjectId(userId) })
      .explain('executionStats');
    
    expect(explain.executionStats.executionTimeMillis).toBeLessThan(10);
    expect(explain.queryPlanner.winningPlan.inputStage.stage).toBe('IXSCAN');
  });

  it('should complete matching query in <100ms', async () => {
    const start = Date.now();
    await matchClientToInventory('client123');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });
});
```

---

## 5. Test Execution Plan

### Development
```bash
# Run all tests
pnpm test

# Run specific suite
pnpm test --testPathPattern=scoring

# Run with coverage
pnpm test --coverage

# Watch mode
pnpm test --watch
```

### CI/CD Pipeline
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test --coverage
      - run: pnpm run lint
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 6. Test Coverage Goals

| Component | Target Coverage | Priority |
|-----------|----------------|----------|
| AI Parsing | >90% | Critical |
| Scoring Algorithm | >95% | Critical |
| Match Engine | >85% | Critical |
| API Routes | >80% | High |
| Frontend Components | >70% | Medium |
| Utilities | >80% | Medium |

**Overall Target**: >80% statement coverage

---

## 7. Testing Checklist

Before marking phase complete:

**Phase 2 (AI Integration)**:
- [ ] 30 parsing test cases passing
- [ ] Cache test cases passing
- [ ] Retry logic tested
- [ ] Error handling tested

**Phase 3 (Matching)**:
- [ ] 40 scoring test cases passing
- [ ] 25 match engine tests passing
- [ ] Both matching scenarios tested
- [ ] Duplicate prevention tested

**Phase 4 (Notifications)**:
- [ ] Notification creation tested
- [ ] Email sending tested
- [ ] Batching tested
- [ ] Rate limiting tested

**Phase 5 (Frontend)**:
- [ ] Component rendering tests
- [ ] User interaction tests
- [ ] API integration tests
- [ ] Mobile responsiveness tested

**Phase 6 (Full System)**:
- [ ] 10 end-to-end scenarios passing
- [ ] 15 security tests passing
- [ ] Load tests meeting targets
- [ ] No critical bugs found

---

**Next Document**: [Deployment Guide](./04-DEPLOYMENT-GUIDE.md)
