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
- ✅ Coolify cron jobs (existing)
- ⚠️ Gemini AI API key (new - free tier available)

**No Redis Required**: This simplified architecture uses cron-based processing.

### 2. Access Requirements
- Admin access to Coolify dashboard
- MongoDB Atlas admin credentials
- Gemini AI API key

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

## Step 2: Configure Environment Variables in Coolify

### 2.1 Navigate to Application Settings

**In Coolify**:
1. Go to **Applications** → **mcinv02**
2. Click **Environment Variables** tab

### 2.2 Add New Environment Variables

**AI & Matching System Variables**:
```bash
# Gemini AI (REQUIRED)
GOOGLE_GEMINI_API_KEY=AIza...your-api-key

# Matching Configuration (optional - defaults shown)
MATCH_SCORE_THRESHOLD=70
FAIR_MATCH_THRESHOLD=55
MAX_MATCHES_PER_CLIENT=50

# AI Configuration (optional - defaults shown)
AI_CONFIDENCE_THRESHOLD=0.6
AI_MAX_RETRIES=3
AI_TIMEOUT_SECONDS=10
```

**Note**: No Redis URL needed - using cron-based processing.

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

### 2.3 Save and Deploy

**Important**: After adding variables:
1. Click **Save**
2. Coolify will automatically trigger a **redeploy**
3. Wait for deployment to complete (~2-5 minutes)

---

## Step 3: Set Up Cron Job in Coolify

### 3.1 Add Cron Job for Matching

**In Coolify Dashboard**:
1. Go to **Applications** → **mcinv02**
2. Click **Cron Jobs** tab
3. Add new cron job:
   - **Name**: `match-requests`
   - **Schedule**: `*/2 * * * *` (every 2 minutes)
   - **URL**: `https://htg.lotlynx.app/api/cron/match-requests`
   - **Method**: `POST`
   - **Headers**: `Authorization: Bearer ${CRON_SECRET}`

**Environment Variable Required**:
```bash
# Add to environment variables
CRON_SECRET=your-secure-random-string
```

**Generate CRON_SECRET**:
```bash
# Generate a secure random string
openssl rand -hex 32
```

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

## Step 5: Smoke Testing

### 5.1 Test Cron Endpoint

**Manually trigger cron job**:
```bash
curl -X POST https://htg.lotlynx.app/api/cron/match-requests \
  -H "Authorization: Bearer your-cron-secret"
# Expected: { "processed": 0, "matches": 0 } (or counts if there are requests)
```

### 5.2 Test AI Parsing

**Create a client request via UI**:
1. Go to Clients page
2. Select a client
3. Add a new request with freeText: "White Toyota Corolla 2020+ under R400k"
4. Wait 2 minutes for cron to run
5. Check request - filters should be populated

**Or verify in database**:
```javascript
db.clientrequests.findOne({
  freeText: { $exists: true },
  'aiParsing.parsedAt': { $exists: true }
})
// Should show populated filters and aiParsing metadata
```

### 5.3 Test Matching

**After adding a car that matches a request**:
1. Wait for next cron run (2 minutes)
2. Check Notifications page
3. Should see match notification

**Or verify in database**:
```javascript
db.vehiclematches.find().sort({ createdAt: -1 }).limit(5)
// Should show recent matches with scores
```

### 5.4 Test Notifications API

**Check notifications endpoint**:
```bash
curl https://htg.lotlynx.app/api/notifications \
  -H "Cookie: your-session-cookie"
# Should include match notifications
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

## Step 6: Production Optimization

### 6.1 Enable Compression

**In `next.config.mjs`**:
```javascript
export default {
  compress: true, // Enable gzip compression
  // ... other config
};
```

### 6.2 Database Connection Pooling

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

### Issue: Cron job not running

**Symptoms**: Requests not being parsed, no matches created

**Solution**:
1. Check Coolify cron job is enabled
2. Verify CRON_SECRET matches in environment and cron configuration
3. Manually trigger: `curl -X POST https://htg.lotlynx.app/api/cron/match-requests -H "Authorization: Bearer $CRON_SECRET"`
4. Check application logs for cron errors

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
1. Check if ClientRequest has `aiParsing.parsedAt` (parse completed?)
2. Check if ClientRequest.filters is populated
3. Verify car status is "in-stock" or "coming"
4. Check match threshold: Is score <70?
5. Review application logs during cron run
6. Test manually in database:
```javascript
db.clientrequests.find({ 'filters.makes': { $exists: true, $ne: [] } })
db.vehiclematches.find().sort({ createdAt: -1 }).limit(5)
```

---

### Issue: Notifications not appearing

**Symptoms**: Matches created, but UI shows no notifications

**Solution**:
1. Check vehiclematches collection in MongoDB
2. Check existing /api/notifications aggregation includes match type
3. Clear browser cache and refresh
4. Check createdByPhone matches between request and user

---

## Environment Variables Reference

**Complete list for production**:

```bash
# Application (existing)
NODE_ENV=production
PORT=3000

# MongoDB (existing)
MONGODB_URI=mongodb+srv://...

# Cloudflare R2 (existing)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...

# Session (existing)
SESSION_SECRET=...
JWT_SECRET=...

# ===== NEW FOR AI MATCHING =====

# Gemini AI (REQUIRED)
GOOGLE_GEMINI_API_KEY=AIza...

# Cron Job (REQUIRED)
CRON_SECRET=your-secure-random-string

# Matching Configuration (optional - defaults shown)
MATCH_SCORE_THRESHOLD=70
FAIR_MATCH_THRESHOLD=55
MAX_MATCHES_PER_CLIENT=50

# AI Configuration (optional - defaults shown)
AI_CONFIDENCE_THRESHOLD=0.6
AI_MAX_RETRIES=3
AI_TIMEOUT_SECONDS=10
```

**Note**: No Redis URL required - using cron-based processing.

---

## Post-Launch Monitoring

### Week 1 Checklist
- [ ] Monitor error rates daily
- [ ] Verify cron job is running (check logs)
- [ ] Review AI parsing accuracy (manual spot checks)
- [ ] Monitor MongoDB slow queries
- [ ] Collect user feedback

### Week 2-4 Checklist
- [ ] Analyze match quality metrics
- [ ] Tune scoring algorithm if needed
- [ ] Optimize slow database queries
- [ ] Plan Phase 2: Email notifications

---

**Next Document**: [Appendices (Pseudocode, Examples, Templates)](./05-APPENDICES.md)
