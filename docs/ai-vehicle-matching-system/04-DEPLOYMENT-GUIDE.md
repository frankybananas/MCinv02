# Deployment Guide

## Overview
Step-by-step guide to deploy the AI-Powered Vehicle Matching System to production on Coolify Cloud VPS.

**Platform**: Coolify  
**Environment**: Cloud VPS  
**Deployment Method**: Git-based automatic deployment

---

## Prerequisites

### 1. Environment Setup

**Required Services**:
- ✅ MongoDB Atlas (existing)
- ✅ Cloudflare R2 (existing)
- ⚠️ Redis instance (new - for BullMQ)
- ⚠️ Gemini AI API key (new)
- ✅ Email service (existing - SendGrid/SES)

### 2. Access Requirements
- Admin access to Coolify dashboard
- MongoDB Atlas admin credentials
- Cloudflare R2 API keys
- Gemini AI API key
- Email service API key

---

## Step 1: Acquire External API Keys

### 1.1 Gemini AI API Key

**Steps**:
1. Visit https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the API key (format: `AIza...`)
5. Store securely (will add to environment variables)

**Cost**: Free tier includes 60 requests/minute

### 1.2 Verify Existing Keys

**MongoDB Atlas**:
```bash
# Verify connection string works
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
```

**Cloudflare R2**:
```bash
# Verify R2 credentials
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket-name
```

**Email Service** (SendGrid example):
```bash
SENDGRID_API_KEY=SG.xxx
FROM_EMAIL=noreply@yourdomain.com
```

---

## Step 2: Set Up Redis on Coolify

### 2.1 Create Redis Instance

**In Coolify Dashboard**:
1. Navigate to **Resources** → **Databases**
2. Click **+ New Database**
3. Select **Redis 7**
4. Configure:
   - Name: `mcinv02-redis`
   - Version: `7-alpine`
   - Memory Limit: `512MB` (sufficient for job queue)
   - Persistence: **Enabled** (important for job durability)
5. Click **Create**

### 2.2 Get Redis Connection Details

**After creation**:
1. Click on `mcinv02-redis` instance
2. Note down:
   - **Internal Host**: `mcinv02-redis` (internal network)
   - **Port**: `6379`
   - **Password**: Auto-generated (copy from Coolify UI)

**Connection String Format**:
```bash
REDIS_URL=redis://:password@mcinv02-redis:6379
```

### 2.3 Test Redis Connection

```bash
# From your local machine (with redis-cli installed)
redis-cli -h your-vps-ip -p 6379 -a your-password
> PING
# Should respond: PONG
```

---

## Step 3: Configure Environment Variables in Coolify

### 3.1 Navigate to Application Settings

**In Coolify**:
1. Go to **Applications** → **mcinv02**
2. Click **Environment Variables** tab

### 3.2 Add New Environment Variables

**AI & Matching System Variables**:
```bash
# Gemini AI
GOOGLE_GEMINI_API_KEY=AIza...your-api-key

# Redis (for BullMQ)
REDIS_URL=redis://:password@mcinv02-redis:6379

# Matching Configuration
MATCH_SCORE_THRESHOLD=70
FAIR_MATCH_THRESHOLD=55
MAX_MATCHES_PER_CLIENT=50

# Notification Configuration
MAX_NOTIFICATIONS_PER_HOUR=10
MAX_EMAILS_PER_DAY=5
NOTIFICATION_BATCH_WINDOW_MINUTES=5

# AI Configuration
AI_CONFIDENCE_THRESHOLD=0.6
AI_MAX_RETRIES=3
AI_TIMEOUT_SECONDS=10

# Worker Configuration (optional - defaults work)
WORKER_CONCURRENCY=5
JOB_ATTEMPTS=3
JOB_BACKOFF_DELAY=2000
```

**Existing Variables to Verify**:
```bash
# Should already exist
MONGODB_URI=mongodb+srv://...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
SENDGRID_API_KEY=...
FROM_EMAIL=...
NODE_ENV=production
```

### 3.3 Save and Deploy

**Important**: After adding variables:
1. Click **Save**
2. Coolify will automatically trigger a **redeploy**
3. Wait for deployment to complete (~2-5 minutes)

---

## Step 4: Database Migration

### 4.1 Connect to MongoDB Atlas

```bash
# Use MongoDB Compass or mongosh
mongosh "mongodb+srv://cluster.mongodb.net/mcinv02" --username admin
```

### 4.2 Run Migration Scripts

**Create Collections** (if not exist):
```javascript
db.createCollection('matches');
db.createCollection('notifications');
```

**Update Existing Collections**:
```javascript
// Add new fields to clients collection
db.clients.updateMany(
  { lookingFor: { $exists: false } },
  {
    $set: {
      lookingFor: null,
      matchCount: 0,
      activeMatches: []
    }
  }
);

// Add matchableFields to cars collection
db.cars.find({ matchableFields: { $exists: false } }).forEach(car => {
  db.cars.updateOne(
    { _id: car._id },
    {
      $set: {
        matchableFields: {
          makeNormalized: car.make.toLowerCase().trim(),
          modelNormalized: car.model.toLowerCase().trim(),
          colorNormalized: car.color.toLowerCase().trim(),
          fullText: `${car.make} ${car.model} ${car.variant || ''} ${car.color}`.toLowerCase()
        }
      }
    }
  );
});
```

**Create Indexes**:
```javascript
// Clients indexes
db.clients.createIndex({ userId: 1, updatedAt: -1 });
db.clients.createIndex({ userId: 1, 'lookingFor.parsedCriteria.makes': 1 });
db.clients.createIndex({ userId: 1, matchCount: -1 });

// Cars indexes
db.cars.createIndex({ userId: 1, status: 1, updatedAt: -1 });
db.cars.createIndex({ 'matchableFields.makeNormalized': 1, 'matchableFields.modelNormalized': 1 });

// Matches indexes
db.matches.createIndex({ userId: 1, clientId: 1, createdAt: -1 });
db.matches.createIndex({ userId: 1, inventoryId: 1 });
db.matches.createIndex({ userId: 1, matchScore: -1 });
db.matches.createIndex({ clientId: 1, inventoryId: 1 }, { unique: true });
db.matches.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Notifications indexes
db.notifications.createIndex({ userId: 1, read: 1, createdAt: -1 });
db.notifications.createIndex({ userId: 1, type: 1, dismissed: 0 });
db.notifications.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
db.notifications.createIndex({ userId: 1, 'data.matchId': 1 }, { unique: true });
```

### 4.3 Verify Migration

```javascript
// Check collections exist
show collections
// Should include: clients, cars, matches, notifications

// Check indexes created
db.clients.getIndexes()
db.cars.getIndexes()
db.matches.getIndexes()
db.notifications.getIndexes()

// Verify data integrity
db.clients.countDocuments({ userId: { $exists: false } })
// Should be 0

db.cars.countDocuments({ userId: { $exists: false } })
// Should be 0
```

---

## Step 5: Deploy Worker Process

### 5.1 Create Worker Service in Coolify

**Option A: Separate Worker Service** (Recommended):

1. In Coolify, go to **Applications** → **+ New Application**
2. Select **Docker Compose** deployment
3. Configure:
   - Name: `mcinv02-worker`
   - Repository: Same as main app
   - Branch: `main`
   - Docker Compose file: `docker-compose.worker.yml`

**Create `docker-compose.worker.yml`**:
```yaml
version: '3.8'
services:
  worker:
    build:
      context: .
      dockerfile: Dockerfile
    command: node workers/matching-worker.js
    environment:
      - NODE_ENV=production
      - MONGODB_URI=${MONGODB_URI}
      - REDIS_URL=${REDIS_URL}
      - GOOGLE_GEMINI_API_KEY=${GOOGLE_GEMINI_API_KEY}
      - WORKER_CONCURRENCY=${WORKER_CONCURRENCY:-5}
    restart: unless-stopped
    depends_on:
      - redis
```

**Option B: Single Service with PM2** (Alternative):

**Create `ecosystem.config.js`**:
```javascript
module.exports = {
  apps: [
    {
      name: 'web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 1,
      exec_mode: 'cluster'
    },
    {
      name: 'worker',
      script: 'workers/matching-worker.js',
      instances: 1,
      exec_mode: 'fork'
    }
  ]
};
```

**Update `package.json`**:
```json
{
  "scripts": {
    "start": "pm2-runtime start ecosystem.config.js",
    "start:web": "next start",
    "start:worker": "node workers/matching-worker.js"
  }
}
```

### 5.2 Verify Worker is Running

**Check logs in Coolify**:
```
[Worker] Connected to Redis
[Worker] Connected to MongoDB
[Worker] Worker started, processing jobs...
```

---

## Step 6: Smoke Testing

### 6.1 Health Check

**Test main application**:
```bash
curl https://yourdomain.com/api/health
# Expected: { "status": "ok" }
```

**Test Redis connection**:
```bash
# In application logs, look for:
[BullMQ] Connected to Redis successfully
```

### 6.2 Test AI Parsing

**Create test client** (via UI or API):
```bash
curl -X POST https://yourdomain.com/api/clients \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "clientName": "Test Client",
    "lookingFor": {
      "rawText": "White Toyota Corolla 2020+ under R400k"
    }
  }'
```

**Check job queue** (in worker logs):
```
[Worker] Processing job: parse-client-request
[Worker] AI parsing completed with confidence: 0.87
[Worker] Job completed successfully
```

### 6.3 Test Matching

**Add test inventory**:
```bash
curl -X POST https://yourdomain.com/api/inventory \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "make": "Toyota",
    "model": "Corolla",
    "year": 2021,
    "price": 380000,
    "color": "White",
    "status": "In-Stock"
  }'
```

**Check for match creation** (in worker logs):
```
[Worker] Processing job: match-inventory-to-clients
[Worker] Found 1 matching clients
[Worker] Created match with score: 85
[Worker] Notification sent
```

### 6.4 Test Notifications

**Check notifications API**:
```bash
curl https://yourdomain.com/api/notifications \
  -H "Cookie: your-session-cookie"
# Should return notifications array with new match
```

---

## Step 7: Monitoring Setup

### 7.1 Application Logs

**In Coolify**:
1. Navigate to **Applications** → **mcinv02**
2. Click **Logs** tab
3. Monitor for errors

**Key things to watch**:
- `[ERROR]` prefixed logs
- Failed job logs
- API 5xx errors
- Database connection errors

### 7.2 Job Queue Monitoring

**Install Bull Board** (optional, recommended):

**Update `workers/matching-worker.ts`**:
```typescript
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import express from 'express';

const app = express();
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(jobQueue)],
  serverAdapter
});

app.use('/admin/queues', serverAdapter.getRouter());
app.listen(3001, () => {
  console.log('Bull Board running on http://localhost:3001/admin/queues');
});
```

**Access**: `https://yourdomain.com/admin/queues` (protect with auth middleware)

### 7.3 MongoDB Atlas Monitoring

**Enable alerts in Atlas**:
1. Go to MongoDB Atlas dashboard
2. Navigate to **Alerts**
3. Enable:
   - Slow queries (>1000ms)
   - High CPU usage (>80%)
   - High connections (>100)
   - Replication lag

---

## Step 8: Post-Deployment Verification

### 8.1 Feature Checklist

- [ ] Users can create client preferences via UI
- [ ] Natural language parsing works (check parsed criteria in DB)
- [ ] Inventory addition triggers matching
- [ ] Matches appear in notifications page
- [ ] Email notifications are sent
- [ ] Match scores are calculated correctly
- [ ] Multi-tenancy enforced (users can't see each other's data)
- [ ] Worker process is running and processing jobs
- [ ] No errors in application logs
- [ ] Database queries are performant (<100ms)

### 8.2 Performance Check

**Run simple load test**:
```bash
# Using Apache Bench
ab -n 100 -c 10 https://yourdomain.com/api/clients
# Should show: Time per request < 500ms
```

---

## Step 9: Rollback Plan

**If deployment fails or critical issues found**:

### 9.1 Immediate Rollback

**In Coolify**:
1. Navigate to **Applications** → **mcinv02**
2. Click **Deployments** tab
3. Find previous successful deployment
4. Click **Redeploy**
5. Confirm rollback

**Time to rollback**: ~2-3 minutes

### 9.2 Database Rollback

**If migration needs reversal**:
```javascript
// Remove new fields from clients
db.clients.updateMany(
  {},
  { $unset: { lookingFor: '', matchCount: '', activeMatches: '' } }
);

// Drop new collections
db.matches.drop();
db.notifications.drop();

// Remove new indexes
db.clients.dropIndex('userId_1_lookingFor.parsedCriteria.makes_1');
db.cars.dropIndex('matchableFields.makeNormalized_1_matchableFields.modelNormalized_1');
```

### 9.3 Environment Variable Rollback

1. Remove new environment variables in Coolify
2. Redeploy
3. Application will run without matching feature

---

## Step 10: Production Optimization

### 10.1 Enable Caching

**Redis cache for API responses** (optional):
```typescript
// Middleware
export async function cacheMiddleware(req, res, next) {
  const key = `cache:${req.url}`;
  const cached = await redis.get(key);
  if (cached) {
    return res.json(JSON.parse(cached));
  }
  // Continue to route handler
  // Cache response in handler
}
```

### 10.2 Enable Compression

**In `next.config.mjs`**:
```javascript
export default {
  compress: true, // Enable gzip compression
  // ... other config
};
```

### 10.3 Database Connection Pooling

**Verify in MongoDB connection**:
```typescript
// lib/mongodb.ts
const options = {
  maxPoolSize: 100,
  minPoolSize: 10,
  maxIdleTimeMS: 30000,
};
```

---

## Troubleshooting

### Issue: Worker not processing jobs

**Symptoms**: Jobs stuck in "waiting" state

**Solution**:
1. Check worker logs for errors
2. Verify Redis connection: `REDIS_URL` correct?
3. Restart worker service
4. Check Redis is running: `redis-cli ping`

---

### Issue: AI parsing failures

**Symptoms**: `parsingConfidence` is 0, or errors in logs

**Solution**:
1. Verify Gemini API key is correct
2. Check API key quota: https://makersuite.google.com/app/apikey
3. Check rate limits (60 req/min on free tier)
4. Review error logs for specific error message

---

### Issue: No matches created

**Symptoms**: Inventory added, but no matches found

**Solution**:
1. Check if client has `parsedCriteria` (parse job completed?)
2. Verify inventory status is "In-Stock" or "Coming"
3. Check match threshold: Is score <70?
4. Review scoring algorithm logs
5. Manually test scoring with test data

---

### Issue: Notifications not appearing

**Symptoms**: Matches created, but UI shows no notifications

**Solution**:
1. Check notifications collection in MongoDB
2. Verify notification creation in worker logs
3. Check API endpoint: `GET /api/notifications`
4. Clear browser cache and refresh
5. Check userId matches between match and notification

---

## Environment Variables Reference

**Complete list for production**:

```bash
# Application
NODE_ENV=production
PORT=3000

# MongoDB
MONGODB_URI=mongodb+srv://...

# Redis
REDIS_URL=redis://:password@mcinv02-redis:6379

# Cloudflare R2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...

# Gemini AI
GOOGLE_GEMINI_API_KEY=AIza...

# Email
SENDGRID_API_KEY=SG...
FROM_EMAIL=noreply@yourdomain.com

# Matching Configuration
MATCH_SCORE_THRESHOLD=70
FAIR_MATCH_THRESHOLD=55
MAX_MATCHES_PER_CLIENT=50

# Notifications
MAX_NOTIFICATIONS_PER_HOUR=10
MAX_EMAILS_PER_DAY=5
NOTIFICATION_BATCH_WINDOW_MINUTES=5

# AI Configuration
AI_CONFIDENCE_THRESHOLD=0.6
AI_MAX_RETRIES=3
AI_TIMEOUT_SECONDS=10

# Worker
WORKER_CONCURRENCY=5
JOB_ATTEMPTS=3
JOB_BACKOFF_DELAY=2000

# Session (existing)
SESSION_SECRET=...
JWT_SECRET=...
```

---

## Post-Launch Monitoring

### Week 1 Checklist
- [ ] Monitor error rates daily
- [ ] Check job queue health
- [ ] Review AI parsing accuracy (manual spot checks)
- [ ] Monitor MongoDB slow queries
- [ ] Collect user feedback
- [ ] Check email delivery rates

### Week 2-4 Checklist
- [ ] Analyze match quality metrics
- [ ] Tune scoring algorithm if needed
- [ ] Optimize slow database queries
- [ ] Review and adjust rate limits
- [ ] Plan iteration 2 features

---

**Next Document**: [Appendices (Pseudocode, Examples, Templates)](./05-APPENDICES.md)
