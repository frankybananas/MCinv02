# Phase 8: Preview, History & Analytics

**Phase:** 8 of 8  
**Duration:** 2-3 days  
**Dependencies:** Phase 6, 7  
**Status:** Ready

---

## Overview

Build user-facing interfaces for post preview, history tracking, and performance analytics.

---

## Components

### 1. Post Preview Modal (Optional - Simplified)

**Location:** Marketing page

**Trigger:** "Preview" button before posting

**Implementation:**
```typescript
// app/components/facebook-post-preview.tsx

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PostPreviewProps {
  car: Car;
  user: User;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FacebookPostPreview({ car, user, onConfirm, onCancel }: PostPreviewProps) {
  const [preview, setPreview] = useState<{ content: string; hashtags: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const generatePreview = async () => {
      try {
        const res = await fetch('/api/facebook/generate-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ carId: car._id })
        });
        
        const data = await res.json();
        setPreview(data.post);
      } catch (error) {
        toast.error('Failed to generate preview');
      } finally {
        setLoading(false);
      }
    };
    
    generatePreview();
  }, [car._id]);
  
  const nonVinImages = car.images.filter(img => !img.isVin).slice(0, 10);
  
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview Facebook Post</DialogTitle>
        </DialogHeader>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mock Facebook UI */}
            <div className="border rounded-lg p-4 bg-white">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  {user.name?.charAt(0) || 'U'}
                </div>
                <div>
                  <p className="font-semibold">{user.businessName || user.name}</p>
                  <p className="text-xs text-gray-500">Just now · 🌍</p>
                </div>
              </div>
              
              <p className="whitespace-pre-wrap mb-3">{preview?.content}</p>
              
              <div className="text-blue-600 text-sm mb-3">
                {preview?.hashtags.join(' ')}
              </div>
              
              {/* Images */}
              <div className="grid grid-cols-2 gap-1">
                {nonVinImages.slice(0, 4).map((img, idx) => (
                  <img 
                    key={idx}
                    src={img.imageUrl} 
                    alt={`Car ${idx + 1}`}
                    className="w-full h-48 object-cover rounded"
                  />
                ))}
              </div>
              
              {nonVinImages.length > 4 && (
                <p className="text-sm text-gray-500 mt-2">
                  +{nonVinImages.length - 4} more image(s)
                </p>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700">
                Confirm & Post
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Note:** For batch posts (multiple cars), skip preview to avoid UX complexity. Only show for single-car posts.

---

### 2. Post History Page

**Location:** New page `/facebook-history`

**Route:** `app/facebook-history/page.tsx`

**Features:**
- List all posts with status
- Filter by status (all, published, failed, pending)
- Search by car
- View post details
- Link to Facebook post (if published)
- Retry failed posts

**Implementation:**
```typescript
// app/facebook-history/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ExternalLink, RefreshCw, Clock, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface PostHistoryItem {
  _id: string;
  car: {
    make: string;
    model: string;
    year: number;
  };
  status: string;
  publishedAt?: string;
  facebookPostId?: string;
  error?: string;
  createdAt: string;
}

export default function FacebookHistoryPage() {
  const [posts, setPosts] = useState<PostHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'published' | 'failed' | 'pending'>('all');
  const [search, setSearch] = useState('');
  
  useEffect(() => {
    fetchHistory();
  }, [filter]);
  
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/facebook/post/history?status=${filter}`);
      const data = await res.json();
      setPosts(data.posts);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRetry = async (postId: string) => {
    try {
      await fetch(`/api/facebook/post/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId })
      });
      
      toast.success('Post queued for retry');
      fetchHistory();
    } catch (error) {
      toast.error('Failed to retry post');
    }
  };
  
  const getStatusBadge = (status: string) => {
    const variants = {
      published: 'default',
      failed: 'destructive',
      pending: 'secondary',
      processing: 'secondary',
      scheduled: 'outline'
    };
    
    return <Badge variant={variants[status] as any}>{status}</Badge>;
  };
  
  const filteredPosts = posts.filter(post => {
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        post.car.make.toLowerCase().includes(searchLower) ||
        post.car.model.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });
  
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Facebook Post History</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input
              placeholder="Search by car..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            
            <div className="flex gap-2">
              <Button 
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
                size="sm"
              >
                All
              </Button>
              <Button 
                variant={filter === 'published' ? 'default' : 'outline'}
                onClick={() => setFilter('published')}
                size="sm"
              >
                Published
              </Button>
              <Button 
                variant={filter === 'failed' ? 'default' : 'outline'}
                onClick={() => setFilter('failed')}
                size="sm"
              >
                Failed
              </Button>
              <Button 
                variant={filter === 'pending' ? 'default' : 'outline'}
                onClick={() => setFilter('pending')}
                size="sm"
              >
                Pending
              </Button>
            </div>
          </div>
          
          {/* Posts List */}
          {loading ? (
            <div className="flex justify-center py-8">Loading...</div>
          ) : filteredPosts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No posts found</p>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map(post => (
                <div key={post._id} className="border rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">
                        {post.car.year} {post.car.make} {post.car.model}
                      </p>
                      {getStatusBadge(post.status)}
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      {post.status === 'published' && post.publishedAt
                        ? `Posted ${format(new Date(post.publishedAt), 'PPp')}`
                        : `Created ${format(new Date(post.createdAt), 'PPp')}`
                      }
                    </p>
                    
                    {post.error && (
                      <p className="text-sm text-red-600 mt-1">Error: {post.error}</p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {post.status === 'published' && post.facebookPostId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`https://facebook.com/${post.facebookPostId}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    
                    {post.status === 'failed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetry(post._id)}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### 3. Analytics Dashboard

**Location:** `/facebook-analytics` or within Admin panel

**Metrics:**
- Total posts published
- Success rate (%)
- Average posts per week
- Most posted car makes
- Peak posting times

**Implementation:**
```typescript
// app/facebook-analytics/page.tsx

export default function FacebookAnalytics() {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    fetchStats();
  }, []);
  
  const fetchStats = async () => {
    const res = await fetch('/api/facebook/analytics');
    const data = await res.json();
    setStats(data);
  };
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Facebook Analytics</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.totalPosts || 0}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{stats?.published || 0}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{stats?.failed || 0}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {stats ? Math.round((stats.published / stats.totalPosts) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* More charts can be added here */}
    </div>
  );
}
```

---

## API Endpoints

### Post History

**Endpoint:** `GET /api/facebook/post/history`

**Query Params:**
- `status`: Filter by status
- `limit`: Max results (default: 50)
- `offset`: Pagination offset

**Response:**
```typescript
{
  posts: PostHistoryItem[],
  total: number,
  hasMore: boolean
}
```

---

### Retry Failed Post

**Endpoint:** `POST /api/facebook/post/retry`

**Request:**
```typescript
{
  postId: string
}
```

**Implementation:**
```typescript
// Reset retry count and status
await FacebookPost.findByIdAndUpdate(postId, {
  $set: {
    status: 'pending',
    retryCount: 0,
    error: null,
    lastAttempt: null
  }
});
```

---

### Analytics Stats

**Endpoint:** `GET /api/facebook/analytics`

**Response:**
```typescript
{
  totalPosts: number,
  published: number,
  failed: number,
  pending: number,
  avgPostsPerWeek: number,
  topMakes: { make: string; count: number }[],
  recentActivity: { date: string; count: number }[]
}
```

**Implementation:**
```typescript
// app/api/facebook/analytics/route.ts

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();
  
  // Status counts
  const statusCounts = await FacebookPost.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(session.userId) } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  
  const stats = statusCounts.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});
  
  // Top makes
  const topMakes = await FacebookPost.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(session.userId), status: 'published' } },
    { $lookup: { from: 'cars', localField: 'carId', foreignField: '_id', as: 'car' } },
    { $unwind: '$car' },
    { $group: { _id: '$car.make', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ]);
  
  return NextResponse.json({
    totalPosts: Object.values(stats).reduce((a: number, b: number) => a + b, 0),
    published: stats.published || 0,
    failed: stats.failed || 0,
    pending: stats.pending || 0,
    topMakes: topMakes.map(item => ({ make: item._id, count: item.count }))
  });
}
```

---

## Navigation Updates

Add to main navigation:
```typescript
// app/components/dashboard.tsx or navigation

<NavItem href="/facebook-history" icon={History}>
  Facebook History
</NavItem>

<NavItem href="/facebook-analytics" icon={BarChart}>
  Facebook Analytics
</NavItem>
```

---

## Testing

**File:** `__tests__/pages/facebook-history.test.tsx`

- Test history list rendering
- Test status filtering
- Test search functionality
- Test retry button
- Test pagination

**File:** `__tests__/api/facebook-analytics.test.ts`

- Test stats calculation
- Test aggregation queries
- Test authorization

**Coverage:** 85%+

---

## Acceptance Criteria

- ✅ Post history page displays all posts
- ✅ Filter by status works
- ✅ Retry failed posts functional
- ✅ Analytics dashboard shows key metrics
- ✅ Link to Facebook post works
- ✅ Mobile responsive
- ✅ Pagination for large datasets

---

## Future Enhancements (Post-V1.0)

1. **Facebook Insights Integration:**
   - Sync likes, comments, shares from Facebook
   - Track reach and engagement
   - Performance reports

2. **Scheduled Posting UI:**
   - Calendar view for scheduled posts
   - Drag-and-drop rescheduling

3. **Template Library:**
   - Save custom post templates
   - Reuse successful post styles

4. **A/B Testing:**
   - Compare post performance
   - Optimize content strategy

---

## Final Documentation

**README for users:** Create user guide in `docs/USER-GUIDE-FACEBOOK.md`

**Topics to cover:**
1. How to connect Facebook
2. How to post cars
3. Understanding post status
4. Viewing history
5. Troubleshooting

---

**Implementation Complete!** 🎉

All 8 phases documented. Ready for sequential development.
