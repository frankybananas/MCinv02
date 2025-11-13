# Phase 7: Post Queue & Error Handling

**Phase:** 7 of 8  
**Duration:** 2-3 days  
**Dependencies:** Phase 6  
**Status:** Ready

---

## Overview

Implement robust job queue system for processing Facebook posts with retry logic, error handling, and user notifications.

---

## Queue System Architecture

### Option A: Simple Cron-Based Queue (Recommended)

**Pros:**
- No additional dependencies
- Simple to implement
- Works with existing Coolify infrastructure

**Cons:**
- Less real-time (processes every minute)
- No built-in job prioritization

**Implementation:**
```typescript
// lib/facebook/post-queue.ts

import { connectDB } from '@/lib/mongodb';
import FacebookPost from '@/models/FacebookPost';

export async function addToPostQueue(postId: string): Promise<void> {
  // Post is already created with status='pending'
  // Queue processor will pick it up
  console.log(`Post ${postId} added to queue`);
}

export async function processQueue(): Promise<void> {
  await connectDB();
  
  // Find pending posts (not scheduled or scheduled time has passed)
  const now = new Date();
  const posts = await FacebookPost.find({
    status: 'pending',
    $or: [
      { scheduledFor: null },
      { scheduledFor: { $lte: now } }
    ],
    retryCount: { $lt: 3 }  // Don't retry failed posts indefinitely
  })
  .sort({ createdAt: 1 })  // FIFO
  .limit(5);  // Process max 5 at a time
  
  for (const post of posts) {
    try {
      // Call processing endpoint
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/facebook/post/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`
        },
        body: JSON.stringify({ postId: post._id.toString() })
      });
      
      console.log(`Processed post ${post._id}`);
      
      // Wait 1 second between posts (rate limiting)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Failed to process post ${post._id}:`, error);
    }
  }
}
```

---

### Option B: Bull Queue (Advanced)

**Use if:** Need real-time processing, job prioritization, or handling >100 posts/day

**Setup:**
```bash
pnpm add bull @types/bull
pnpm add ioredis @types/ioredis
```

**Implementation:** (See separate doc if needed)

---

## Cron Job Setup

### Coolify Scheduled Task

1. Navigate to your Coolify application
2. Go to "Scheduled Tasks"
3. Add new task:
   - **Name:** Facebook Post Queue Processor
   - **Command:** `curl -X POST https://yourdomain.com/api/cron/process-facebook-queue -H "Authorization: Bearer ${CRON_SECRET}"`
   - **Schedule:** `* * * * *` (every minute)
   - **Enabled:** Yes

---

### Cron Endpoint

**Endpoint:** `POST /api/cron/process-facebook-queue`

**Purpose:** Entry point for cron job to process queue

**Implementation:**
```typescript
// app/api/cron/process-facebook-queue/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { processQueue } from '@/lib/facebook/post-queue';

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    await processQueue();
    return NextResponse.json({ success: true, processedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Queue processing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Prevent build-time execution
export const dynamic = 'force-dynamic';
```

---

## Retry Logic

### Exponential Backoff

```typescript
const calculateRetryDelay = (retryCount: number): number => {
  // 1 min, 5 min, 15 min
  const delays = [60000, 300000, 900000];
  return delays[retryCount] || delays[delays.length - 1];
};

// In process endpoint
if (post.retryCount < post.maxRetries && post.status === 'pending') {
  const retryDelay = calculateRetryDelay(post.retryCount);
  const retryAt = new Date(Date.now() + retryDelay);
  
  post.scheduledFor = retryAt;  // Delay next attempt
  await post.save();
}
```

---

### Retry Decision Matrix

| Error Type | Action | Retry? |
|------------|--------|--------|
| Invalid token | Set status='failed', notify user | ❌ |
| Rate limit (368) | Schedule +30min | ✅ |
| Network timeout | Immediate retry | ✅ |
| Invalid image URL | Set status='failed' | ❌ |
| Permission denied | Set status='failed', notify | ❌ |
| Server error (500) | Retry with backoff | ✅ |

**Implementation:**
```typescript
const shouldRetry = (error: any): boolean => {
  const nonRetryableCodes = [190, 200, 100];  // Token, permission, invalid param
  
  if (error.code && nonRetryableCodes.includes(error.code)) {
    return false;
  }
  
  if (error.code === 368) {  // Rate limit
    return true;
  }
  
  // Network errors, timeouts
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return true;
  }
  
  return true;  // Default: retry
};
```

---

## Error Notifications

### User Notification Creation

```typescript
// When post fails permanently
import Notification from '@/models/Notification';

const notifyPostFailure = async (post: IFacebookPost, error: string) => {
  const car = await Car.findById(post.carId);
  
  await Notification.create({
    userId: post.userId,
    type: 'facebook_post_failed',
    title: 'Facebook Post Failed',
    message: `Failed to post ${car.year} ${car.make} ${car.model} to Facebook: ${error}`,
    relatedId: post.carId,
    relatedModel: 'Car',
    priority: 'medium',
    read: false
  });
};
```

---

### Success Notification

```typescript
const notifyPostSuccess = async (post: IFacebookPost) => {
  const car = await Car.findById(post.carId);
  
  await Notification.create({
    userId: post.userId,
    type: 'facebook_post_success',
    title: 'Posted to Facebook',
    message: `${car.year} ${car.make} ${car.model} successfully posted`,
    relatedId: post.carId,
    relatedModel: 'Car',
    priority: 'low',
    read: false
  });
};
```

---

## Status Monitoring

### Queue Status Endpoint

**Endpoint:** `GET /api/facebook/post/queue-status`

**Purpose:** Show queue stats for admin/user

**Response:**
```typescript
{
  pending: 12,
  processing: 2,
  published: 453,
  failed: 8,
  scheduled: 5,
  averageProcessingTime: 3.2  // seconds
}
```

**Implementation:**
```typescript
// app/api/facebook/post/queue-status/route.ts

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();
  
  const stats = await FacebookPost.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(session.userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const statusMap = stats.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});
  
  return NextResponse.json({
    pending: statusMap.pending || 0,
    processing: statusMap.processing || 0,
    published: statusMap.published || 0,
    failed: statusMap.failed || 0,
    scheduled: statusMap.scheduled || 0
  });
}
```

---

## Cleanup Jobs

### Delete Old Posts

**Cron:** Weekly (Sundays at 2 AM)

**Implementation:**
```typescript
// app/api/cron/cleanup-facebook-posts/route.ts

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();
  
  // Delete posts older than 90 days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  
  const result = await FacebookPost.deleteMany({
    createdAt: { $lt: cutoffDate },
    status: { $in: ['published', 'failed'] }
  });
  
  console.log(`Deleted ${result.deletedCount} old Facebook posts`);
  
  return NextResponse.json({ 
    success: true, 
    deleted: result.deletedCount 
  });
}
```

---

## Logging

### Structured Logging

```typescript
const logPostProcessing = (post: IFacebookPost, event: string, details?: any) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: `facebook_post_${event}`,
    postId: post._id.toString(),
    userId: post.userId.toString(),
    carId: post.carId.toString(),
    status: post.status,
    retryCount: post.retryCount,
    ...details
  }));
};

// Usage
logPostProcessing(post, 'processing_started');
logPostProcessing(post, 'published', { facebookPostId: result.postId });
logPostProcessing(post, 'failed', { error: error.message });
```

---

## Testing

**File:** `__tests__/lib/post-queue.test.ts`

```typescript
describe('Post Queue Processing', () => {
  test('should process pending posts', async () => {
    const post = await FacebookPost.create({
      userId: mockUserId,
      carId: mockCarId,
      content: 'Test',
      imageUrls: ['https://example.com/1.jpg'],
      status: 'pending'
    });
    
    await processQueue();
    
    const updated = await FacebookPost.findById(post._id);
    expect(updated.status).toBe('published');
  });
  
  test('should respect retry limits', async () => {
    const post = await FacebookPost.create({
      ...mockPostData,
      status: 'pending',
      retryCount: 3,
      maxRetries: 3
    });
    
    await processQueue();
    
    const updated = await FacebookPost.findById(post._id);
    expect(updated.status).toBe('failed');
  });
  
  test('should skip scheduled posts', async () => {
    const post = await FacebookPost.create({
      ...mockPostData,
      status: 'pending',
      scheduledFor: new Date(Date.now() + 3600000)  // 1 hour future
    });
    
    await processQueue();
    
    const updated = await FacebookPost.findById(post._id);
    expect(updated.status).toBe('pending');  // Not processed yet
  });
});
```

---

## Environment Variables

```env
# Queue Processing
CRON_SECRET=your-cron-secret-here
FACEBOOK_POST_PROCESSING_LIMIT=5  # Max posts per run
FACEBOOK_RETRY_MAX=3
```

---

## Monitoring Dashboard

### Key Metrics to Track

1. **Queue Depth:** Number of pending posts
2. **Processing Rate:** Posts/hour
3. **Success Rate:** Published / Total
4. **Average Time:** Seconds per post
5. **Error Rate:** Failed / Total

Can be visualized in Phase 8 (Analytics).

---

## Acceptance Criteria

- ✅ Cron job processes queue every minute
- ✅ Retry logic with exponential backoff
- ✅ Max 3 retries before permanent failure
- ✅ User notifications on success/failure
- ✅ Queue status endpoint functional
- ✅ Old posts cleaned up automatically
- ✅ Structured logging implemented

---

**Next Phase:** Phase 8 (Preview, History & Analytics)
