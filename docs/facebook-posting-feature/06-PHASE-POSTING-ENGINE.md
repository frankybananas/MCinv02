# Phase 6: Facebook Posting Engine

**Phase:** 6 of 8  
**Duration:** 3-4 days  
**Dependencies:** Phase 2, 4, 5  
**Status:** Ready

---

## Overview

Implement core posting engine to publish car posts to Facebook via Graph API.

---

## Architecture

```
User clicks FBPage → Queue Posts → Process Queue → Publish to Facebook
                          ↓              ↓               ↓
                    Create records  Generate AI    Upload images
                                      content      + create post
```

---

## API Endpoints

### 1. Batch Post Queueing

**Endpoint:** `POST /api/facebook/post/batch`

**Request:**
```typescript
{
  carIds: string[],
  scheduledFor?: string  // ISO date or null for immediate
}
```

**Response:**
```typescript
{
  success: true,
  queued: number,
  postIds: string[],
  excluded: {
    doNotAdvertise: string[],
    missingImages: string[]
  }
}
```

**Implementation:**
```typescript
// app/api/facebook/post/batch/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { connectDB } from '@/lib/mongodb';
import Car from '@/models/Car';
import User from '@/models/User';
import FacebookAuth from '@/models/FacebookAuth';
import FacebookPost from '@/models/FacebookPost';
import { GeminiPostGenerator } from '@/lib/ai/gemini-service';
import { addToPostQueue } from '@/lib/facebook/post-queue';

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { carIds, scheduledFor } = await request.json();
  
  if (!carIds || carIds.length === 0) {
    return NextResponse.json({ error: 'No cars selected' }, { status: 400 });
  }
  
  await connectDB();
  
  // Verify Facebook connection
  const fbAuth = await FacebookAuth.findOne({
    userId: session.userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  });
  
  if (!fbAuth) {
    return NextResponse.json({ 
      error: 'Facebook not connected or token expired' 
    }, { status: 400 });
  }
  
  // Fetch user info
  const user = await User.findById(session.userId);
  if (!user?.businessName || !user?.whatsappNumber) {
    return NextResponse.json({ 
      error: 'Please complete contact information in Profile' 
    }, { status: 400 });
  }
  
  // Fetch cars with populated images
  const cars = await Car.find({
    _id: { $in: carIds }
  }).populate('images');
  
  // Filter and validate
  const excluded = {
    doNotAdvertise: [],
    missingImages: []
  };
  
  const validCars = cars.filter(car => {
    if (car.doNotAdvertise) {
      excluded.doNotAdvertise.push(car._id.toString());
      return false;
    }
    
    // Get non-VIN images
    const validImages = car.images.filter(img => !img.isVin && img.imageUrl);
    if (validImages.length === 0) {
      excluded.missingImages.push(car._id.toString());
      return false;
    }
    
    return true;
  });
  
  if (validCars.length === 0) {
    return NextResponse.json({ 
      error: 'No valid cars to post',
      excluded 
    }, { status: 400 });
  }
  
  // Generate posts and queue
  const generator = new GeminiPostGenerator();
  const postIds = [];
  
  for (const car of validCars) {
    try {
      // Generate content
      const generated = await generator.generatePost({
        make: car.make,
        model: car.model,
        year: car.year,
        price: car.price,
        mileage: car.mileage,
        color: car.color,
        transmission: car.transmission,
        status: car.status,
        features: car.features,
        businessName: user.businessName,
        whatsappNumber: user.whatsappNumber,
        location: user.location || 'South Africa'
      });
      
      // Get image URLs (exclude VIN, max 10)
      const imageUrls = car.images
        .filter(img => !img.isVin && img.imageUrl)
        .slice(0, 10)
        .map(img => img.imageUrl);
      
      // Create FacebookPost record
      const post = await FacebookPost.create({
        userId: session.userId,
        carId: car._id,
        content: generated.content,
        hashtags: generated.hashtags,
        imageUrls,
        accountType: fbAuth.accountType,
        facebookPageId: fbAuth.facebookPageId,
        status: scheduledFor ? 'scheduled' : 'pending',
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        aiModel: 'gemini-1.5-flash',
        aiPromptVersion: 'v1.0',
        generationTime: generated.generationTime
      });
      
      postIds.push(post._id.toString());
      
      // Add to processing queue
      await addToPostQueue(post._id.toString());
      
    } catch (error) {
      console.error(`Failed to queue post for car ${car._id}:`, error);
      // Continue with other cars
    }
  }
  
  return NextResponse.json({
    success: true,
    queued: postIds.length,
    postIds,
    excluded
  });
}
```

---

### 2. Process Single Post

**Endpoint:** `POST /api/facebook/post/process`

**Purpose:** Process one queued post (called by queue worker)

**Request:**
```typescript
{
  postId: string
}
```

**Implementation:**
```typescript
// app/api/facebook/post/process/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import FacebookPost from '@/models/FacebookPost';
import FacebookAuth from '@/models/FacebookAuth';
import { FacebookPostPublisher } from '@/lib/facebook/post-publisher';
import { decryptToken } from '@/lib/encryption';

export async function POST(request: NextRequest) {
  // Verify cron secret (if using scheduled processing)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { postId } = await request.json();
  
  await connectDB();
  
  // Fetch post
  const post = await FacebookPost.findById(postId);
  if (!post || post.status !== 'pending') {
    return NextResponse.json({ error: 'Invalid post' }, { status: 400 });
  }
  
  // Update status
  post.status = 'processing';
  post.lastAttempt = new Date();
  await post.save();
  
  try {
    // Fetch auth with tokens
    const auth = await FacebookAuth.findOne({ userId: post.userId })
      .select('+accessToken +facebookPageAccessToken');
    
    if (!auth) {
      throw new Error('Facebook auth not found');
    }
    
    // Decrypt token
    const accessToken = auth.accountType === 'business_page' 
      ? decryptToken(auth.facebookPageAccessToken!)
      : decryptToken(auth.accessToken);
    
    // Publish
    const publisher = new FacebookPostPublisher(accessToken);
    const result = await publisher.publish({
      content: post.content,
      imageUrls: post.imageUrls,
      pageId: auth.facebookPageId
    });
    
    // Update post
    post.status = 'published';
    post.publishedAt = new Date();
    post.facebookPostId = result.postId;
    await post.save();
    
    // Update last used
    auth.lastUsed = new Date();
    await auth.save();
    
    return NextResponse.json({ success: true, postId: result.postId });
    
  } catch (error) {
    console.error('Post publishing error:', error);
    
    // Handle retry logic
    post.retryCount += 1;
    post.error = error.message;
    
    if (post.retryCount >= post.maxRetries) {
      post.status = 'failed';
    } else {
      post.status = 'pending';  // Retry
    }
    
    await post.save();
    
    return NextResponse.json({ 
      error: error.message,
      willRetry: post.retryCount < post.maxRetries 
    }, { status: 500 });
  }
}
```

---

## Facebook Post Publisher

**File:** `lib/facebook/post-publisher.ts`

```typescript
import axios from 'axios';

const GRAPH_API_VERSION = 'v18.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface PublishOptions {
  content: string;
  imageUrls: string[];
  pageId?: string;  // Required for page posts
}

interface PublishResult {
  postId: string;
}

export class FacebookPostPublisher {
  private accessToken: string;
  
  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }
  
  async publish(options: PublishOptions): Promise<PublishResult> {
    const { content, imageUrls, pageId } = options;
    
    // Determine target
    const target = pageId || 'me';
    
    if (imageUrls.length === 0) {
      throw new Error('At least one image required');
    }
    
    if (imageUrls.length === 1) {
      // Single image post
      return await this.publishSingleImage(target, content, imageUrls[0]);
    } else {
      // Multiple images (album)
      return await this.publishAlbum(target, content, imageUrls);
    }
  }
  
  private async publishSingleImage(
    target: string, 
    message: string, 
    imageUrl: string
  ): Promise<PublishResult> {
    try {
      const response = await axios.post(
        `${GRAPH_API_BASE}/${target}/photos`,
        {
          url: imageUrl,
          message: message,
          access_token: this.accessToken
        }
      );
      
      return { postId: response.data.id || response.data.post_id };
      
    } catch (error) {
      console.error('Facebook API error:', error.response?.data);
      throw new Error(error.response?.data?.error?.message || 'Failed to publish photo');
    }
  }
  
  private async publishAlbum(
    target: string,
    message: string,
    imageUrls: string[]
  ): Promise<PublishResult> {
    try {
      // Step 1: Upload photos without publishing
      const photoIds = [];
      
      for (const imageUrl of imageUrls.slice(0, 10)) {  // Max 10
        const response = await axios.post(
          `${GRAPH_API_BASE}/${target}/photos`,
          {
            url: imageUrl,
            published: false,  // Don't publish yet
            access_token: this.accessToken
          }
        );
        
        photoIds.push({ media_fbid: response.data.id });
      }
      
      // Step 2: Create album post with all photos
      const response = await axios.post(
        `${GRAPH_API_BASE}/${target}/feed`,
        {
          message: message,
          attached_media: photoIds,
          access_token: this.accessToken
        }
      );
      
      return { postId: response.data.id };
      
    } catch (error) {
      console.error('Facebook album error:', error.response?.data);
      throw new Error(error.response?.data?.error?.message || 'Failed to publish album');
    }
  }
}
```

---

## Image Handling

### R2 Image Access

Images stored in Cloudflare R2 must be publicly accessible:

```typescript
// Verify image URLs are public
const verifyImageAccess = async (imageUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};
```

### Image Optimization

Facebook accepts:
- **Formats:** JPG, PNG, GIF
- **Max size:** 4MB per image
- **Resolution:** Up to 2048x2048px recommended

Current R2 images should be compatible (already optimized).

---

## Rate Limiting

### Cooldown Enforcement

```typescript
// Check last post time
const lastPost = await FacebookPost.findOne({
  userId: session.userId,
  status: 'published'
}).sort({ publishedAt: -1 });

if (lastPost) {
  const cooldownMs = user.postingCooldown * 60 * 1000;  // Convert to ms
  const timeSince = Date.now() - lastPost.publishedAt.getTime();
  
  if (timeSince < cooldownMs) {
    const waitMinutes = Math.ceil((cooldownMs - timeSince) / 60000);
    return NextResponse.json({
      error: `Please wait ${waitMinutes} more minute(s) before posting again`
    }, { status: 429 });
  }
}
```

---

## Error Codes

### Facebook API Errors

| Code | Meaning | Action |
|------|---------|--------|
| 190 | Invalid token | Prompt reconnect |
| 200 | Permission denied | Request permissions |
| 368 | Rate limit | Queue for later |
| 100 | Invalid parameter | Log and skip |

---

## Testing

**File:** `__tests__/lib/facebook-publisher.test.ts`

```typescript
describe('FacebookPostPublisher', () => {
  test('should publish single image post', async () => {
    const publisher = new FacebookPostPublisher(mockToken);
    const result = await publisher.publish({
      content: 'Test post',
      imageUrls: ['https://example.com/image.jpg']
    });
    
    expect(result.postId).toBeTruthy();
  });
  
  test('should publish album with multiple images', async () => {
    const publisher = new FacebookPostPublisher(mockToken);
    const result = await publisher.publish({
      content: 'Test album',
      imageUrls: ['https://example.com/1.jpg', 'https://example.com/2.jpg']
    });
    
    expect(result.postId).toBeTruthy();
  });
  
  test('should handle Facebook API errors', async () => {
    // Mock API failure
    await expect(publisher.publish(invalidOptions)).rejects.toThrow();
  });
});
```

---

## Acceptance Criteria

- ✅ Batch queueing endpoint functional
- ✅ Single image posts work
- ✅ Album posts (2-10 images) work
- ✅ VIN images excluded
- ✅ DNA cars excluded
- ✅ Cooldown enforced
- ✅ Error handling and retries
- ✅ Token decryption secure

---

**Next Phase:** Phase 7 (Queue & Error Handling)
