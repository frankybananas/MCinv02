# Cars Management Feature Specification

## Overview and Purpose
The Cars Management feature provides comprehensive CRUD operations for vehicle inventory in the MCinv02 car dealership management system. It serves as the central inventory management component, allowing users to add, view, edit, and manage car listings with rich metadata, image handling, and status tracking.

## Key Components and Architecture

### Core Components
- **Frontend Components**:
  - `add-edit-car.tsx` - Primary form component for creating/editing car records
  - `car-detail.tsx` - Detailed view component displaying comprehensive car information
  - `dashboard.tsx` - Main dashboard with car listings and filtering
  - `reserve-modal.tsx` - Modal for reserving cars and creating deliveries

- **API Endpoints**:
  - `GET/PUT/DELETE /api/cars/[id]/route.js` - Individual car CRUD operations
  - `GET/POST /api/cars/route.js` - Car listing and creation

### Data Models
**Car Interface** (`app/types.ts`):
```typescript
interface Car {
  _id: string;
  images: Picture[];
  year: number;
  make: string;
  model: string;
  price: number;
  kilometers: number;
  color: string;
  transmission: "manual" | "automatic" | "cvt";
  vin: string;
  notes: string;
  status: CarState; // "in-stock" | "coming" | "reserved" | "sold"
  demo?: boolean;
  reservedBy?: string;
  createdAt: string;
  auditLog: AuditLogEntry[];
}
```

**CarState Type**:
- `"in-stock"` - Available for sale
- `"coming"` - Expected to arrive
- `"reserved"` - Reserved by client
- `"sold"` - Sold and delivered
- `"demo"` - Demo vehicle (filtered status)

## User Interactions and Workflows

### Primary Workflows

#### 1. Adding a New Car
1. User clicks "Add Car" button in dashboard
2. `add-edit-car.tsx` component renders with form fields
3. Form includes: basic info (make, model, year, price), specifications, images upload
4. Image processing: automatic resizing to medium (1600px) and thumbnail (320px) variants
5. Cloud storage upload to R2/S3 with optimized compression
6. Car becomes eligible for scheduled request matching
7. Matches (if any) are surfaced via notifications and client detail views

#### 2. Viewing Car Details
1. Click on car card in dashboard → `car-detail.tsx` component
2. Displays comprehensive information including images, specifications, notes
3. Shows audit log of all changes
4. Status change options and reservation functionality

#### 3. Status Management
- Status transitions trigger business logic:
  - `"reserved"` → Auto-creates delivery record
  - Status changes logged in audit trail
  - Matching considers only available cars (in-stock/coming)

### State Management
- **Local State**: Individual components manage form state, loading states, UI interactions
- **Global State**: Redux-like pattern through React context (not explicitly visible in codebase)
- **Server State**: MongoDB persistence with Mongoose ODM

## Integration Points

### With Other Features

#### Deliveries Integration
- Status change to "reserved" automatically creates delivery record
- `reserve-modal.tsx` links car to client and initiates delivery workflow
- Delivery detail page shows associated car information

#### Matching Integration
- Cars participate in matching when status is in-stock/coming
- Scheduled cron processing evaluates active client requests against available inventory
- Creates `VehicleMatch` records for relevant client-car combinations

#### Image Management
- Images stored as `Picture` documents linked to cars
- Automatic processing pipeline with Sharp for optimization
- Cloud storage with cache headers for performance

## Business Logic and Validations

### Data Validations
- **Required Fields**: make, model, year, price, kilometers, color, transmission, VIN
- **VIN Uniqueness**: Partial unique index (excludes empty values)
- **Price/Kilometers**: Numeric validation and formatting
- **Phone Number Formatting**: Automatic conversion to +27 format for South African numbers

### Status Transition Rules
```javascript
// Simplified status transition logic
const statusTransitions = {
  'in-stock': ['coming', 'reserved', 'sold'],
  'coming': ['in-stock', 'reserved', 'sold'],
  'reserved': ['in-stock', 'sold'],
  'sold': [] // Terminal state
};
```

### Audit Logging
- All status changes and modifications logged with:
  - Action description
  - User identifier (phone/name)
  - Timestamp
  - Change details

## Edge Cases and Error Handling

### Image Upload Failures
- Graceful fallback for partial image uploads
- Retry logic for cloud storage failures
- User feedback on upload status

### Matching Failures
- Non-blocking error handling for scheduled matching jobs
- Core inventory CRUD remains functional even if matching is unavailable
- Warning logs for debugging

### Duplicate VIN Handling
- Database-level unique constraint with partial filter
- Graceful handling of legacy data with empty VINs
- User-friendly error messages for conflicts

## File References

### Core Implementation Files
- **API Routes**:
  - `app/api/cars/route.ts` - Main CRUD operations
  - `app/api/cars/[id]/route.ts` - Individual car management

- **Components**:
  - `app/components/add-edit-car.tsx` - Car creation/editing form
  - `app/components/car-detail.tsx` - Car detail view
  - `app/components/dashboard.tsx` - Car listings and filtering

- **Models**:
  - `models/Car.ts` - Mongoose schema definition
  - `models/Picture.js` - Image metadata schema

- **Utilities**:
  - `lib/s3.ts` - Cloud storage operations
  - `lib/matching/match-engine.ts` - Matching engine
  - `lib/matching/scoring.ts` - Deterministic scoring

### Supporting Infrastructure
- **Image Processing**: Sharp library for automatic resizing
- **Cloud Storage**: R2/S3 integration with optimized caching
- **Database**: MongoDB with Mongoose ODM
