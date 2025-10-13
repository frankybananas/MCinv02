# Clients & Requests Feature Specification

## Overview and Purpose
The Clients & Requests feature enables sophisticated customer relationship management with AI-powered request processing. Users can manage client information and create structured "Looking For" requests that are automatically parsed from natural language notes and matched against car inventory using vector search technology.

## Key Components and Architecture

### Core Components
- **Frontend Components**:
  - `add-edit-client.tsx` - Client creation and editing form
  - `client-detail.tsx` - Comprehensive client information view
  - `client-request-editor.tsx` - Structured request creation and editing
  - `client-request-quick.tsx` - Quick request creation interface
  - `dashboard.tsx` - Client listings and filtering

- **API Endpoints**:
  - `GET/POST/PUT/DELETE /api/clients/route.js` - Client CRUD operations
  - `GET/POST/PUT/DELETE /api/clients/[id]/` - Individual client management
  - `GET/POST /api/clients/[id]/requests/` - Client request management
  - `GET/PUT/DELETE /api/clients/[id]/requests/[requestId]/` - Individual request operations

### Data Models

**Client Interface** (`app/types.ts`):
```typescript
interface Client {
  _id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  cars?: Car[];
  notes?: string;
  interactionHistory?: Interaction[];
  createdByPhone?: string; // User isolation field
  active?: boolean;
}
```

**ClientRequest Interface** (`app/types.ts`):
```typescript
interface ClientRequest {
  _id: string;
  client: string;
  createdByPhone: string; // User isolation
  title?: string;
  freeText?: string; // Original natural language input
  status: 'active' | 'paused' | 'completed';
  filters: {
    makes?: string[];
    models?: string[];
    minYear?: number;
    maxYear?: number;
    maxMileageKm?: number;
    minBudgetZar?: number;
    maxBudgetZar?: number;
    seats?: number;
    fuelTypes?: string[];
    transmissions?: string[];
    bodyTypes?: string[];
    colors?: string[];
    mustHave?: string[];
    niceToHave?: string[];
    excludeTerms?: string[];
  };
  requestText?: string; // Canonical text for embedding
  embeddingVector?: number[]; // AI embedding
  embeddingModel?: string;
  lastEmbeddedAt?: string;
  source?: 'notes' | 'manual' | 'imported';
  priority?: number;
}
```

## User Interactions and Workflows

### Primary Workflows

#### 1. Client Creation with Auto-Request Generation
1. User creates client with notes field containing natural language requirements
2. System automatically parses notes using `parseNotesToRequest()` utility
3. AI identifies buying intent and extracts structured filters (budget, make, model, etc.)
4. Generates canonical request text for vector embedding
5. Creates vector embedding using OpenAI's `text-embedding-3-small` model
6. Stores request in vector database for matching

#### 2. Manual Request Creation
1. User navigates to client detail page
2. Clicks "Add Request" → `client-request-editor.tsx` opens
3. Structured form with filter categories:
   - Vehicle specifications (make, model, year, mileage)
   - Budget constraints (min/max price)
   - Feature requirements (transmission, fuel type, seats)
   - Must-have vs nice-to-have features
4. Real-time preview of generated request text
5. Vector embedding generation and storage

#### 3. Request Management
- **Status Control**: Active, paused, completed states
- **Priority Levels**: Numerical priority for request ranking
- **Source Tracking**: Notes, manual, or imported origins

### State Management
- **Component State**: Individual forms manage validation and UI state
- **Parent-Child Communication**: Client detail component manages request list state
- **Real-time Updates**: Optimistic updates for better UX

## Integration Points

### AI-Powered Request Processing

#### Natural Language Parsing (`lib/parse-request.ts`)
- Uses OpenAI GPT models for intelligent text analysis
- Extracts structured data from unstructured notes:
  ```javascript
  // Example transformation
  Input: "Looking for a Toyota Corolla under R200k, low mileage, automatic"
  Output: {
    title: "Toyota Corolla Search",
    filters: {
      makes: ["Toyota"],
      models: ["Corolla"],
      maxBudgetZar: 200000,
      transmissions: ["automatic"]
    }
  }
  ```

#### Vector Embedding Integration (`lib/vector-store.ts`)
- Requests stored in Qdrant vector database as `RequestPayload` objects
- Real-time matching against car inventory
- Similarity scoring with configurable thresholds (default: 0.78)

### Vector Search Integration
- **Request-to-Car Matching**: Finds cars matching client requirements
- **Car-to-Request Matching**: Finds clients for new car inventory
- **Bidirectional Updates**: Changes trigger re-matching across collections

### Notification System Integration
- New matches generate `client_match` notifications
- Matches appear in unified notifications dashboard
- Status tracking: new → notified → viewed → dismissed → converted

## Business Logic and Validations

### Request Parsing Intelligence
- **Intent Detection**: Identifies buying vs selling vs informational queries
- **Entity Extraction**: Makes, models, price ranges, specifications
- **Context Understanding**: Handles variations in terminology and formatting
- **Confidence Scoring**: Only processes high-confidence matches

### Filter Application Logic
```javascript
// Matching algorithm considerations
const matchingCriteria = {
  // Exact matches for categorical filters
  make: request.makes?.includes(car.make),
  model: request.models?.includes(car.model),

  // Range-based filters with tolerance
  price: car.price <= (request.maxBudgetZar * 1.1), // 10% tolerance
  mileage: car.kilometers <= (request.maxMileageKm * 1.2), // 20% tolerance

  // Feature matching
  transmission: !request.transmissions?.length ||
               request.transmissions.includes(car.transmission)
};
```

### User Isolation
- **Ownership Tracking**: `createdByPhone` field ensures data segregation
- **Access Control**: Users only see clients/requests they created
- **Cross-User Matching**: System matches across all active requests regardless of creator

## Edge Cases and Error Handling

### Parsing Failures
- **Fallback Behavior**: Manual request creation when AI parsing fails
- **Partial Success**: Uses successfully extracted filters even if some parsing fails
- **User Feedback**: Clear indication when auto-parsing succeeds/fails

### Vector Search Limitations
- **Cold Start**: No matches possible without sufficient car/request data
- **Embedding Drift**: Periodic re-embedding to handle model updates
- **Performance**: Query result limiting (default: top 10 matches)

### Data Consistency
- **Atomic Operations**: Request creation with vector storage in single transaction
- **Rollback Handling**: Cleanup of partial vector data on failures
- **Duplicate Prevention**: Upsert logic prevents duplicate matches

## Advanced Features

### Request Templates
- **Reusable Filters**: Common filter combinations can be saved as templates
- **Bulk Operations**: Apply filters to multiple clients
- **Historical Tracking**: Maintain request history for analytics

### Matching Intelligence
- **Score Weighting**: Different filter types have different importance weights
- **Temporal Decay**: Recent requests prioritized over older ones
- **User Feedback Loop**: Matching quality improves based on user interactions

## File References

### Core Implementation Files
- **API Routes**:
  - `app/api/clients/route.js` - Client CRUD operations
  - `app/api/clients/[id]/requests/` - Request management endpoints

- **Components**:
  - `app/components/add-edit-client.tsx` - Client management
  - `app/components/client-detail.tsx` - Client information display
  - `app/components/client-request-editor.tsx` - Request creation interface

- **Models**:
  - `models/Client.js` - Client schema definition
  - `models/ClientRequest.ts` - Request schema with embedding support

- **Utilities**:
  - `lib/parse-request.ts` - AI-powered text parsing
  - `lib/embeddings.ts` - Text generation and embedding
  - `lib/vector-store.ts` - Vector database operations

### AI Integration
- **OpenAI Integration**: GPT models for text parsing and analysis
- **Qdrant Vector DB**: High-performance similarity search
- **Embedding Models**: `text-embedding-3-small` for cost-effective processing
