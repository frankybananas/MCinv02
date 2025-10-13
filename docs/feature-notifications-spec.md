# Notifications Feature Specification

## Overview and Purpose
The Notifications feature provides a unified notification system that alerts users to important events in the car inventory management system, including new car arrivals, delivery updates, and task reminders.

## Key Components and Architecture

### Core Components
- **Frontend Components**:
  - `dashboard.tsx` - Notification display and management
  - `client-detail.tsx` - Match display within client context
  - `car-detail.tsx` - Match display within car context

- **API Endpoints**:
  - `GET/POST /api/notifications/` - Notification aggregation and management
  - `GET/POST /api/matches/route.ts` - Match creation and updates
  - `GET/PUT/DELETE /api/matches/[id]/` - Individual match management

### Data Models

**NotificationItem Interface** (`app/types.ts`):
```typescript
interface NotificationItem {
  _id: string; // Composite ID for different notification types
  type: NotificationType;
  title: string;
  description?: string;
  createdAt: string;
  data?: {
    carId?: string;
    deliveryId?: string;
    clientId?: string;
    matchId?: string;
  };
  read?: boolean;
}
```

**NotificationType**:
- `"car_new"` - New car added to inventory
- `"car_reserved"` - Car reserved by another user
- `"car_sold"` - Car sold and removed from available inventory
- `"delivery_update"` - Delivery status changes
- `"delivery_due_soon"` - Upcoming delivery reminders
- `"delivery_completed"` - Delivery completion notifications
- `"client_match"` - AI-generated matches between requests and cars
- `"todo_reminder"` - Task reminder notifications

**MatchItem Interface** (`app/types.ts`):
```typescript
interface MatchItem {
  _id: string;
  request?: string;
  car: Car | string;
  client: string;
  createdByPhone?: string; // User isolation
  score: number; // Similarity score from vector search
  explanation?: string; // AI-generated explanation
  status: MatchStatus; // 'new' | 'notified' | 'viewed' | 'dismissed' | 'converted'
  notifiedAt?: string;
  viewedAt?: string;
  dismissedAt?: string;
  contactedAt?: string;
}
```

## User Interactions and Workflows

### Primary Workflows

#### 1. Automatic Match Generation
1. New car added → Vector embedding generated
2. System searches active client requests using similarity search
3. Matches with score ≥ 0.78 threshold created
4. AI generates explanation for each match
5. `client_match` notification created for request owner

#### 2. Request-Driven Matching
1. New client request created → Vector embedding generated
2. System searches available car inventory
3. Matching cars identified and scored
4. Match records created with explanations
5. Notifications sent to request owner

#### 3. Notification Management
1. User views notifications tab in dashboard
2. Unread notifications highlighted with badge count
3. Click notification → Navigate to relevant detail page
4. Mark as read/dismiss actions available

#### 4. Match Lifecycle Management
1. **New Match**: Created but not yet viewed
2. **Notified**: User notified of match existence
3. **Viewed**: User clicked through to view match details
4. **Dismissed**: User rejected match as not relevant
5. **Converted**: Match resulted in sale/reservation

### State Management
- **Notification State**: Centralized notification list with read/unread tracking
- **Match State**: Individual match status tracking across the system
- **Real-time Updates**: Live notification updates without page refresh

## Integration Points

### Vector Search Integration (`lib/vector-store.ts`)
- **Dual Collection Search**: Cars and requests stored in separate Qdrant collections
- **Bidirectional Matching**: Both car-to-request and request-to-car matching
- **Similarity Scoring**: Cosine similarity with configurable thresholds
- **Filter Application**: Budget, mileage, and specification constraints

### AI Explanation Generation (`lib/embeddings.ts`)
```javascript
// Example match explanation
"Perfect match! This 2020 Toyota Corolla fits your R250,000 budget and preference for automatic transmission. With only 45,000km, it's in excellent condition and matches all your specified requirements."
```

### Client Request Integration
- **Request Status Tracking**: Only active requests participate in matching
- **Filter Application**: Request filters (budget, make, model) applied during search
- **Owner Isolation**: Users only see matches for their own requests

### Car Inventory Integration
- **Status Filtering**: Only available cars (in-stock, coming) included in matching
- **Dynamic Updates**: New cars immediately available for matching
- **Embedding Maintenance**: Car embeddings updated with inventory changes

## Business Logic and Validations

### Matching Algorithm

#### Similarity Calculation
```javascript
// Core matching logic
const isMatch = (car, request, similarityScore) => {
  // Vector similarity threshold
  if (similarityScore < 0.78) return false;

  // Budget compatibility (with 10% tolerance)
  if (car.price > request.maxBudgetZar * 1.1) return false;

  // Mileage compatibility (with 20% tolerance)
  if (car.kilometers > request.maxMileageKm * 1.2) return false;

  // Specification matching
  if (request.makes?.length && !request.makes.includes(car.make)) return false;
  if (request.transmissions?.length && !request.transmissions.includes(car.transmission)) return false;

  return true;
};
```

#### Scoring Factors
- **Vector Similarity**: Primary scoring mechanism (cosine similarity)
- **Recency Bonus**: Recent requests/cars get slight score boost
- **Feature Completeness**: Matches with more matching features score higher
- **Price Optimization**: Cars closer to budget maximum score higher

### Notification Aggregation
- **Deduplication**: Multiple matches for same car/request combination prevented
- **Priority Ordering**: Higher-scoring matches shown first
- **Time-based Filtering**: Recent notifications prioritized
- **User-specific**: Only notifications relevant to user's clients/cars shown

### Performance Optimizations
- **Batch Processing**: Multiple matches created in single database transaction
- **Index Optimization**: Database indexes on frequently queried fields
- **Caching Strategy**: Match results cached to reduce computation
- **Async Processing**: Non-blocking match generation for better UX

## Edge Cases and Error Handling

### Vector Search Failures
- **Graceful Degradation**: System continues to function without AI matching
- **Fallback Search**: Basic text-based search when vector search unavailable
- **Retry Logic**: Automatic retry for transient vector database failures

### High Volume Scenarios
- **Rate Limiting**: Matching frequency limited to prevent system overload
- **Queue Management**: Match generation queued during peak periods
- **Result Limiting**: Maximum number of matches per car/request enforced

### Data Consistency Issues
- **Orphaned Matches**: Cleanup process for matches with deleted cars/requests
- **Stale Embeddings**: Periodic re-embedding to handle model drift
- **Race Conditions**: Atomic operations prevent duplicate match creation

## Advanced Features

### Match Insights and Analytics
- **Match Quality Tracking**: Historical analysis of match conversion rates
- **User Feedback Integration**: Match quality improves based on user actions
- **Performance Metrics**: Success rates by car type, price range, etc.

### Smart Notification Management
- **Notification Batching**: Related notifications grouped together
- **Smart Timing**: Notifications sent during business hours
- **Preference Learning**: Notification frequency adjusted based on user engagement

### Advanced Matching Features
- **Competitor Analysis**: Identification of similar competing inventory
- **Price Comparison**: Market-based pricing insights
- **Trend Analysis**: Popular features and specifications tracking

## File References

### Core Implementation Files
- **API Routes**:
  - `app/api/notifications/` - Notification aggregation endpoints
  - `app/api/matches/route.ts` - Match management endpoints

- **Components**:
  - `app/components/dashboard.tsx` - Notification display and management
  - `app/components/client-detail.tsx` - Client-specific match display

- **Models**:
  - `models/Match.ts` - Match schema with status tracking
  - Match notifications integrated into existing notification system

- **Utilities**:
  - `lib/vector-store.ts` - Vector similarity search implementation
  - `lib/embeddings.ts` - Match explanation generation
  - `lib/user-isolation.ts` - User-specific filtering logic

### AI Integration
- **OpenAI Integration**: GPT models for match explanations
- **Qdrant Vector Database**: High-performance similarity search
- **Embedding Models**: `text-embedding-3-small` for cost-effective similarity calculation

### Supporting Infrastructure
- **Real-time Updates**: Live notification updates across user sessions
- **Background Processing**: Asynchronous match generation and notification sending
- **Analytics Tracking**: Match performance and user engagement metrics
