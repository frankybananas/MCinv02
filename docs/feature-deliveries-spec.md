# Deliveries & Recon Feature Specification

## Overview and Purpose
The Deliveries & Recon feature manages the complete vehicle delivery lifecycle from reservation to final delivery. It includes comprehensive tracking of vehicle preparation tasks (recon), document management, and delivery scheduling with full audit trails.

## Key Components and Architecture

### Core Components
- **Frontend Components**:
  - `delivery-detail.tsx` - Comprehensive delivery management interface
  - `reserve-modal.tsx` - Car reservation and delivery initiation
  - `dashboard.tsx` - Delivery status overview and filtering

- **API Endpoints**:
  - `GET/POST /api/deliveries/route.ts` - Delivery CRUD operations
  - `GET/PUT/DELETE /api/deliveries/[id]/` - Individual delivery management

### Data Models

**Delivery Interface** (`app/types.ts`):
```typescript
interface Delivery {
  _id: string;
  car: Car | string;
  salesperson: string; // User ID performing delivery
  client?: Client | string;
  status: DeliveryStatus; // "active" | "completed" | "canceled"
  deliveryDate?: string;
  financeBank?: string;
  reconTasks?: ReconTask[];
  licensing?: { done: boolean; notes?: string };
  customerType: "natural" | "individual";
  docs: DeliveryDoc[];
  additionalDocs?: {
    trade_in_natis?: boolean;
    source_of_funds?: boolean;
    ubo_form?: boolean;
  };
  createdAt: string;
  updatedAt: string;
  auditLog?: AuditLogEntry[];
}
```

**ReconTask Interface** (`app/types.ts`):
```typescript
interface ReconTask {
  text: string;
  done: boolean;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

**DeliveryDoc Interface** (`app/types.ts`):
```typescript
interface DeliveryDoc {
  kind: DeliveryDocKind;
  url?: string; // Cloud storage URL
  localKey?: string; // IndexedDB local storage key
  fileType: string;
  fileSize?: number;
  uploadedAt: string;
}
```

**DeliveryDocKind Type**:
- `"id_copy"` - Client ID document
- `"proof_of_address"` - Address verification
- `"company_docs"` - Business registration
- `"director_id"` - Director identification
- `"company_proof_of_address"` - Business address proof
- `"brnc_certificate"` - Business registration certificate
- `"trade_in_natis"` - Trade-in vehicle documentation
- `"source_of_funds"` - Proof of funds source
- `"ubo_form"` - Ultimate Beneficial Owner form

## User Interactions and Workflows

### Primary Workflows

#### 1. Delivery Creation (Automatic)
1. Car status changes to "reserved" → Automatic delivery record creation
2. System populates delivery with car details and salesperson
3. Initial status set to "active"
4. Audit log entry created for delivery initiation

#### 2. Manual Delivery Creation
1. User clicks "Reserve" on car → `reserve-modal.tsx` opens
2. Client selection and linking
3. Customer type specification (individual/company)
4. Initial delivery record creation
5. Automatic car status update to "reserved"

#### 3. Recon Task Management
1. Delivery detail page displays recon section
2. Add/edit/delete recon tasks (vehicle preparation items)
3. Task completion tracking with timestamps
4. Notes and status updates for each task

#### 4. Document Management
1. Upload documents through drag-and-drop interface
2. Local storage for offline capability (`localKey`)
3. Cloud storage synchronization (`url` field)
4. Document type classification using `DeliveryDocKind`

#### 5. Delivery Completion
1. All recon tasks completed
2. Required documents uploaded and verified
3. Delivery date scheduled
4. Status changed to "completed"
5. Car status updated to "sold"
6. Final audit log entry

### State Management
- **Component State**: Individual delivery forms manage task lists and document states
- **Optimistic Updates**: Immediate UI feedback for task completion
- **Offline Support**: Local document storage with sync capability

## Integration Points

### Car Management Integration
- **Status Synchronization**: Car status automatically updated based on delivery progress
- **Reservation Linking**: Delivery records linked to specific car inventory
- **Audit Trail Continuity**: Car and delivery audit logs maintained separately

### Document Storage Integration
- **Dual Storage Strategy**:
  - Local storage (`localKey`) for immediate availability
  - Cloud storage (`url`) for permanent archival
- **File Type Handling**: Support for various document formats (PDF, images, etc.)
- **Size Optimization**: Automatic compression and format conversion

### User Isolation Integration
- **Salesperson Assignment**: Deliveries tied to specific salesperson user IDs
- **Access Control**: Users only see deliveries assigned to them
- **Multi-user Coordination**: Support for multiple salespeople managing deliveries

## Business Logic and Validations

### Delivery Status Transitions
```typescript
const deliveryStatusFlow = {
  'active': ['completed', 'canceled'],
  'completed': [], // Terminal state
  'canceled': ['active'] // Allow reactivation
};
```

### Required Documentation Logic
```javascript
const requiredDocsByCustomerType = {
  'individual': ['id_copy', 'proof_of_address'],
  'company': [
    'company_docs',
    'director_id',
    'company_proof_of_address',
    'brnc_certificate'
  ]
};

const additionalDocs = [
  'trade_in_natis',
  'source_of_funds',
  'ubo_form'
];
```

### Recon Task Management
- **Task States**: Active/inactive with completion tracking
- **Progress Calculation**: Percentage completion for delivery readiness
- **Dependency Management**: Some tasks may depend on others (sequential workflow)

## Edge Cases and Error Handling

### Document Upload Failures
- **Offline Handling**: Documents stored locally until connection restored
- **Partial Upload Recovery**: Resume capability for interrupted uploads
- **Storage Quota Management**: Automatic cleanup of old local files

### Concurrent Modifications
- **Optimistic Locking**: Timestamp-based conflict resolution
- **User Feedback**: Clear indication of conflicting changes
- **Merge Strategies**: Intelligent merging of non-conflicting changes

### Large Document Handling
- **Chunked Upload**: Large files split into manageable chunks
- **Progress Tracking**: Real-time upload progress for user feedback
- **Resume Capability**: Interrupted uploads can be resumed

## Advanced Features

### Delivery Timeline Tracking
- **Scheduled Date Management**: Delivery date planning and updates
- **Reminder System**: Automatic notifications for upcoming deliveries
- **Delay Tracking**: Historical delay analysis and reporting

### Document Compliance Checking
- **Automatic Validation**: Required document verification
- **Expiry Tracking**: Document validity period monitoring
- **Compliance Reporting**: Regulatory compliance status dashboard

### Multi-language Support
- **Localized Document Types**: Support for different regulatory requirements
- **International Customer Support**: Handling of international document types

## File References

### Core Implementation Files
- **API Routes**:
  - `app/api/deliveries/route.ts` - Delivery CRUD operations
  - `app/api/deliveries/[id]/route.ts` - Individual delivery management

- **Components**:
  - `app/components/delivery-detail.tsx` - Main delivery management interface
  - `app/components/reserve-modal.tsx` - Delivery initiation modal

- **Models**:
  - `models/Delivery.ts` - Delivery schema definition
  - `models/Document.js` - Document management schema

- **Utilities**:
  - `lib/idb-docs.ts` - IndexedDB document storage for offline support
  - `lib/user-isolation.ts` - User access control utilities

### Supporting Infrastructure
- **Local Storage**: IndexedDB for offline document management
- **Cloud Storage**: R2/S3 integration for permanent document archival
- **Audit System**: Comprehensive change tracking and logging
- **Notification System**: Integration with notification features for delivery updates
