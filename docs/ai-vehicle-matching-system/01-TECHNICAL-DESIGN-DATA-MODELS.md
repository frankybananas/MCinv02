# Technical Design: Data Models

## Table of Contents
1. [Clients Collection](#clients-collection)
2. [Inventory Collection](#inventory-collection)
3. [Matches Collection](#matches-collection)
4. [Notifications Collection](#notifications-collection)
5. [Index Strategy](#index-strategy)
6. [Data Relationships](#data-relationships)
7. [Migration Plan](#migration-plan)

---

## Clients Collection

### Schema Definition

```typescript
// models/Client.ts (enhanced)

interface LookingFor {
  rawText: string;                      // Original user input
  parsedCriteria?: {
    makes: string[];                    // ["Toyota", "Honda"]
    models: string[];                   // ["Corolla Cross", "CR-V"]
    colors: {
      preferred: string[];              // ["White", "Silver"]
      exclusive: boolean;               // true if "only" keyword detected
    };
    yearMin?: number;                   // 2020
    yearMax?: number;                   // 2024
    priceMin?: number;                  // 400000
    priceMax?: number;                  // 500000
    priceFlexible: boolean;             // true if "negotiable", "around"
    mileageMax?: number;                // 100000 (km)
    transmission: string[];             // ["Manual", "Automatic"]
    fuelType: string[];                 // ["Petrol", "Diesel"]
    fuelTypePreferred: boolean;         // true if "preferred" vs required
    additionalNotes: string;            // Freeform notes
    lastParsed: Date;                   // When AI last parsed
    parsingConfidence: number;          // 0-1 score from Gemini
    ambiguities: string[];              // Unclear elements
    requiresManualReview: boolean;      // Flag for low confidence
  };
  lastUpdated: Date;
}

interface Client {
  _id: ObjectId;
  userId: ObjectId;                     // CRITICAL: Owner of this client
  clientName: string;
  contactInfo: {
    email?: string;
    phone?: string;
    preferredContact?: 'email' | 'phone' | 'whatsapp';
  };
  lookingFor?: LookingFor;              // NEW: Vehicle preferences
  matchCount: number;                   // Denormalized match count
  activeMatches: ObjectId[];            // Quick lookup of match IDs
  createdAt: Date;
  updatedAt: Date;
  createdByPhone: string;               // Existing field (for legacy)
}
```

### MongoDB Schema

```javascript
// models/Client.js (Mongoose schema)

const lookingForSchema = new mongoose.Schema({
  rawText: { type: String, required: true, maxlength: 1000 },
  parsedCriteria: {
    makes: [{ type: String }],
    models: [{ type: String }],
    colors: {
      preferred: [{ type: String }],
      exclusive: { type: Boolean, default: false }
    },
    yearMin: { type: Number, min: 1900, max: 2100 },
    yearMax: { type: Number, min: 1900, max: 2100 },
    priceMin: { type: Number, min: 0 },
    priceMax: { type: Number, min: 0 },
    priceFlexible: { type: Boolean, default: false },
    mileageMax: { type: Number, min: 0 },
    transmission: [{ type: String, enum: ['Manual', 'Automatic', 'Semi-Automatic'] }],
    fuelType: [{ type: String, enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid'] }],
    fuelTypePreferred: { type: Boolean, default: false },
    additionalNotes: { type: String, maxlength: 500 },
    lastParsed: { type: Date },
    parsingConfidence: { type: Number, min: 0, max: 1 },
    ambiguities: [{ type: String }],
    requiresManualReview: { type: Boolean, default: false }
  },
  lastUpdated: { type: Date, default: Date.now }
}, { _id: false });

const clientSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  clientName: { type: String, required: true, trim: true },
  contactInfo: {
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    preferredContact: { type: String, enum: ['email', 'phone', 'whatsapp'] }
  },
  lookingFor: lookingForSchema,
  matchCount: { type: Number, default: 0, min: 0 },
  activeMatches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Match' }],
  createdByPhone: { type: String },  // Existing field
  // ... other existing fields
}, {
  timestamps: true
});

// Indexes
clientSchema.index({ userId: 1, updatedAt: -1 });
clientSchema.index({ userId: 1, 'lookingFor.parsedCriteria.makes': 1 });
clientSchema.index({ userId: 1, matchCount: -1 });
clientSchema.index({ 'lookingFor.parsedCriteria.requiresManualReview': 1 });
```

### Field Descriptions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `rawText` | String | Original user input | "White Toyota Cross 2020+ under R480k" |
| `makes` | String[] | Manufacturer names | ["Toyota", "Honda"] |
| `models` | String[] | Vehicle models | ["Corolla Cross", "CR-V"] |
| `colors.preferred` | String[] | Preferred colors | ["White", "Silver"] |
| `colors.exclusive` | Boolean | Must match colors? | true |
| `yearMin/Max` | Number | Year range | 2020, 2024 |
| `priceMin/Max` | Number | Price range (Rands) | 400000, 500000 |
| `priceFlexible` | Boolean | Negotiable price? | true |
| `mileageMax` | Number | Max mileage (km) | 100000 |
| `transmission` | String[] | Gear types | ["Automatic"] |
| `fuelType` | String[] | Fuel types | ["Diesel"] |
| `fuelTypePreferred` | Boolean | Preferred vs required | true |
| `parsingConfidence` | Number | AI confidence 0-1 | 0.87 |
| `requiresManualReview` | Boolean | Flag for review | true if confidence <0.6 |
| `matchCount` | Number | Denormalized count | 5 |
| `activeMatches` | ObjectId[] | Match IDs | [...] |

---

## Inventory Collection

### Schema Definition

```typescript
// models/Inventory.ts (enhanced from existing Car model)

interface Inventory {
  _id: ObjectId;
  userId: ObjectId;                     // CRITICAL: Owner of this vehicle
  make: string;
  model: string;
  variant?: string;
  year: number;
  color: string;
  price: number;
  mileage: number;
  transmission: 'Manual' | 'Automatic' | 'Semi-Automatic';
  fuelType: 'Petrol' | 'Diesel' | 'Electric' | 'Hybrid';
  status: 'Coming' | 'In-Stock' | 'Reserved' | 'Sold';
  images: string[];                     // Cloudflare R2 URLs
  vin?: string;
  description?: string;
  features: string[];
  location?: string;
  doNotAdvertise?: boolean;             // Existing field
  soldAt?: Date;                        // Existing field
  statusHistory: Array<{
    status: string;
    changedAt: Date;
    changedBy: ObjectId;
  }>;
  matchableFields: {                    // NEW: Denormalized for matching
    makeNormalized: string;             // lowercase, trimmed
    modelNormalized: string;
    colorNormalized: string;
    fullText: string;                   // Combined searchable text
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### MongoDB Schema

```javascript
// models/Car.js (enhanced existing model)

const carSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  make: { type: String, required: true, trim: true },
  model: { type: String, required: true, trim: true },
  variant: { type: String, trim: true },
  year: { type: Number, required: true, min: 1900, max: 2100 },
  color: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  mileage: { type: Number, required: true, min: 0 },
  transmission: { 
    type: String, 
    required: true, 
    enum: ['Manual', 'Automatic', 'Semi-Automatic'] 
  },
  fuelType: { 
    type: String, 
    required: true, 
    enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid'] 
  },
  status: { 
    type: String, 
    required: true, 
    enum: ['Coming', 'In-Stock', 'Reserved', 'Sold'],
    index: true
  },
  images: [{ type: String }],
  vin: { type: String, trim: true, unique: true, sparse: true },
  description: { type: String, maxlength: 2000 },
  features: [{ type: String }],
  location: { type: String, trim: true },
  doNotAdvertise: { type: Boolean, default: false },
  soldAt: { type: Date },
  statusHistory: [{
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  matchableFields: {
    makeNormalized: { type: String, lowercase: true, trim: true, index: true },
    modelNormalized: { type: String, lowercase: true, trim: true, index: true },
    colorNormalized: { type: String, lowercase: true, trim: true, index: true },
    fullText: { type: String, lowercase: true }
  }
  // ... other existing fields
}, {
  timestamps: true
});

// Indexes
carSchema.index({ userId: 1, status: 1, updatedAt: -1 });
carSchema.index({ status: 1, make: 1, model: 1, year: 1 });
carSchema.index({ userId: 1, price: 1 });
carSchema.index({ userId: 1, year: 1 });
carSchema.index({ 'matchableFields.makeNormalized': 1, 'matchableFields.modelNormalized': 1 });

// Text index for full-text search
carSchema.index({
  make: 'text',
  model: 'text',
  variant: 'text',
  description: 'text'
}, {
  weights: {
    make: 10,
    model: 8,
    variant: 5,
    description: 1
  }
});

// Pre-save hook to populate matchableFields
carSchema.pre('save', function(next) {
  if (this.isModified('make') || this.isModified('model') || this.isModified('color')) {
    this.matchableFields = {
      makeNormalized: this.make.toLowerCase().trim(),
      modelNormalized: this.model.toLowerCase().trim(),
      colorNormalized: this.color.toLowerCase().trim(),
      fullText: `${this.make} ${this.model} ${this.variant || ''} ${this.color}`.toLowerCase()
    };
  }
  next();
});
```

---

## Matches Collection

### Schema Definition

```typescript
// models/Match.ts (NEW)

interface MatchBreakdown {
  makeMatch: number;                    // 0-25
  modelMatch: number;                   // 0-25
  yearMatch: number;                    // 0-15
  priceMatch: number;                   // 0-15
  colorMatch: number;                   // 0-10
  otherMatch: number;                   // 0-10
}

interface Match {
  _id: ObjectId;
  userId: ObjectId;                     // CRITICAL: Owner of both client and inventory
  clientId: ObjectId;
  inventoryId: ObjectId;
  matchScore: number;                   // 0-100
  matchQuality: 'Excellent' | 'Good' | 'Fair';
  matchBreakdown: MatchBreakdown;
  matchReason: string;                  // Human-readable explanation
  matchDetails: {                       // Snapshot at match time
    clientName: string;
    clientPreferences: string;          // Raw text snippet (first 200 chars)
    vehicleSummary: string;             // "2021 Toyota Corolla Cross - White - R450,000"
    vehicleImage?: string;              // First R2 URL
  };
  notificationSent: boolean;
  notificationId?: ObjectId;
  emailSent: boolean;
  emailSentAt?: Date;
  dismissed: boolean;
  dismissedAt?: Date;
  dismissedReason?: string;
  actionTaken: boolean;                 // User clicked "View"
  actionTakenAt?: Date;
  inventoryStatusAtMatch: string;       // Snapshot
  inventoryCurrentStatus: string;       // Updated when inventory changes
  createdAt: Date;
  expiresAt: Date;                      // TTL: 90 days from creation
}
```

### MongoDB Schema

```javascript
// models/Match.ts (Mongoose)

const matchBreakdownSchema = new mongoose.Schema({
  makeMatch: { type: Number, required: true, min: 0, max: 25 },
  modelMatch: { type: Number, required: true, min: 0, max: 25 },
  yearMatch: { type: Number, required: true, min: 0, max: 15 },
  priceMatch: { type: Number, required: true, min: 0, max: 15 },
  colorMatch: { type: Number, required: true, min: 0, max: 10 },
  otherMatch: { type: Number, required: true, min: -10, max: 10 }
}, { _id: false });

const matchDetailsSchema = new mongoose.Schema({
  clientName: { type: String, required: true },
  clientPreferences: { type: String, maxlength: 200 },
  vehicleSummary: { type: String, required: true },
  vehicleImage: { type: String }
}, { _id: false });

const matchSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Client', index: true },
  inventoryId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Car', index: true },
  matchScore: { type: Number, required: true, min: 0, max: 100 },
  matchQuality: { 
    type: String, 
    required: true, 
    enum: ['Excellent', 'Good', 'Fair'] 
  },
  matchBreakdown: { type: matchBreakdownSchema, required: true },
  matchReason: { type: String, required: true },
  matchDetails: { type: matchDetailsSchema, required: true },
  notificationSent: { type: Boolean, default: false, index: true },
  notificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification' },
  emailSent: { type: Boolean, default: false },
  emailSentAt: { type: Date },
  dismissed: { type: Boolean, default: false, index: true },
  dismissedAt: { type: Date },
  dismissedReason: { type: String, maxlength: 500 },
  actionTaken: { type: Boolean, default: false },
  actionTakenAt: { type: Date },
  inventoryStatusAtMatch: { type: String, required: true },
  inventoryCurrentStatus: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true }
}, {
  timestamps: true
});

// Indexes
matchSchema.index({ userId: 1, clientId: 1, createdAt: -1 });
matchSchema.index({ userId: 1, inventoryId: 1 });
matchSchema.index({ userId: 1, matchScore: -1 });
matchSchema.index({ userId: 1, notificationSent: 1, dismissed: 0 });
matchSchema.index({ userId: 1, matchQuality: 1 });

// TTL index - auto-delete after 90 days
matchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Prevent duplicate matches
matchSchema.index({ clientId: 1, inventoryId: 1 }, { unique: true });

// Pre-save hook to set expiresAt
matchSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    const now = new Date();
    this.expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days
  }
  next();
});
```

---

## Notifications Collection

### Schema Definition

```typescript
// models/Notification.ts (NEW)

interface NotificationData {
  matchId: ObjectId;
  clientId: ObjectId;
  clientName: string;
  inventoryId: ObjectId;
  vehicleSummary: string;               // "2021 Toyota Corolla Cross - White - R450,000"
  vehicleImage?: string;                // R2 URL for thumbnail
  matchScore: number;
  matchQuality: 'Excellent' | 'Good' | 'Fair';
  matchBreakdown: MatchBreakdown;
  matchReason: string;
}

interface Notification {
  _id: ObjectId;
  userId: ObjectId;                     // CRITICAL: Notification recipient
  type: 'client_match';                 // Extensible for future types
  title: string;
  message: string;
  data: NotificationData;
  read: boolean;
  readAt?: Date;
  dismissed: boolean;
  dismissedAt?: Date;
  actionTaken: boolean;
  actionTakenAt?: Date;
  emailSent: boolean;
  emailSentAt?: Date;
  createdAt: Date;
  expiresAt: Date;                      // TTL: 90 days
}
```

### MongoDB Schema

```javascript
// models/Notification.ts (Mongoose)

const notificationDataSchema = new mongoose.Schema({
  matchId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Match' },
  clientId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Client' },
  clientName: { type: String, required: true },
  inventoryId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Car' },
  vehicleSummary: { type: String, required: true },
  vehicleImage: { type: String },
  matchScore: { type: Number, required: true, min: 0, max: 100 },
  matchQuality: { type: String, required: true, enum: ['Excellent', 'Good', 'Fair'] },
  matchBreakdown: { type: Object },
  matchReason: { type: String }
}, { _id: false });

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  type: { type: String, required: true, enum: ['client_match'], index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: notificationDataSchema, required: true },
  read: { type: Boolean, default: false, index: true },
  readAt: { type: Date },
  dismissed: { type: Boolean, default: false, index: true },
  dismissedAt: { type: Date },
  actionTaken: { type: Boolean, default: false },
  actionTakenAt: { type: Date },
  emailSent: { type: Boolean, default: false },
  emailSentAt: { type: Date },
  expiresAt: { type: Date, required: true, index: true }
}, {
  timestamps: true
});

// Indexes
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, dismissed: 0 });
notificationSchema.index({ userId: 1, 'data.matchQuality': 1 });
notificationSchema.index({ 'data.matchId': 1 });

// TTL index
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Prevent duplicate notifications
notificationSchema.index({ userId: 1, 'data.matchId': 1 }, { unique: true });

// Pre-save hook
notificationSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    const now = new Date();
    this.expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  }
  next();
});
```

---

## Index Strategy

### Critical Indexes (Must Have)

#### Clients Collection
```javascript
db.clients.createIndex({ userId: 1, updatedAt: -1 });
db.clients.createIndex({ userId: 1, 'lookingFor.parsedCriteria.makes': 1 });
db.clients.createIndex({ userId: 1, matchCount: -1 });
db.clients.createIndex({ 'lookingFor.parsedCriteria.requiresManualReview': 1 });
```

#### Inventory (Cars) Collection
```javascript
db.cars.createIndex({ userId: 1, status: 1, updatedAt: -1 });
db.cars.createIndex({ status: 1, make: 1, model: 1, year: 1 });
db.cars.createIndex({ userId: 1, price: 1 });
db.cars.createIndex({ userId: 1, year: 1 });
db.cars.createIndex({ 'matchableFields.makeNormalized': 1, 'matchableFields.modelNormalized': 1 });
```

#### Matches Collection
```javascript
db.matches.createIndex({ userId: 1, clientId: 1, createdAt: -1 });
db.matches.createIndex({ userId: 1, inventoryId: 1 });
db.matches.createIndex({ userId: 1, matchScore: -1 });
db.matches.createIndex({ clientId: 1, inventoryId: 1 }, { unique: true });
db.matches.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

#### Notifications Collection
```javascript
db.notifications.createIndex({ userId: 1, read: 1, createdAt: -1 });
db.notifications.createIndex({ userId: 1, type: 1, dismissed: 0 });
db.notifications.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
db.notifications.createIndex({ userId: 1, 'data.matchId': 1 }, { unique: true });
```

### Index Usage Analysis

| Query Pattern | Index Used | Performance |
|---------------|------------|-------------|
| Get user's clients | `{ userId: 1, updatedAt: -1 }` | O(log n) |
| Match client to inventory | `{ userId: 1, status: 1, ... }` | O(log n) |
| Get client matches | `{ userId: 1, clientId: 1, createdAt: -1 }` | O(log n) |
| Get unread notifications | `{ userId: 1, read: 1, createdAt: -1 }` | O(log n) |
| Check duplicate match | `{ clientId: 1, inventoryId: 1 }` | O(1) unique |
| TTL cleanup | `{ expiresAt: 1 }` | Background job |

---

## Data Relationships

### Entity Relationship Diagram

```
┌─────────────┐
│    User     │
│   (Tenant)  │
└──────┬──────┘
       │
       │ 1:N (owns)
       │
       ├──────────────────┬──────────────────┬───────────────────┐
       │                  │                  │                   │
       ▼                  ▼                  ▼                   ▼
┌─────────────┐    ┌─────────────┐   ┌─────────────┐   ┌──────────────┐
│   Client    │    │  Inventory  │   │    Match    │   │ Notification │
│             │    │   (Car)     │   │             │   │              │
│ • userId    │    │ • userId    │   │ • userId    │   │ • userId     │
│ • lookingFor│    │ • status    │   │ • clientId  │   │ • type       │
│ • matchCount│    │ • price     │   │ • invId     │   │ • data       │
└──────┬──────┘    └──────┬──────┘   └──────┬──────┘   └──────┬───────┘
       │                  │                  │                  │
       │                  │                  │                  │
       │    Matching      │                  │                  │
       │    Algorithm     │                  │                  │
       └──────────────────┘                  │                  │
                  │                           │                  │
                  │ Creates                   │                  │
                  └───────────────────────────┴──────────────────┘
                              │
                              │ 1:1 (linked)
                              │
                         Match ←→ Notification
```

### Referential Integrity

**Foreign Key Relationships**:
1. `Match.clientId` → `Client._id`
2. `Match.inventoryId` → `Car._id`
3. `Match.notificationId` → `Notification._id`
4. `Notification.data.matchId` → `Match._id`

**Cascade Rules**:
- Client deleted → Archive/soft-delete matches → Mark notifications as "client deleted"
- Inventory deleted → Update match status → Mark notifications as "vehicle deleted"
- Match dismissed → Update notification dismissed status
- Notification deleted → No cascade (matches persist)

**Orphan Prevention**:
- Unique index on `{ clientId, inventoryId }` prevents duplicate matches
- Unique index on `{ userId, 'data.matchId' }` prevents duplicate notifications
- TTL indexes auto-delete old records (90 days)

---

## Migration Plan

### Phase 1: Schema Updates (Non-Breaking)

**Clients Collection**:
```javascript
// Add new fields with defaults (backward compatible)
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
```

**Inventory Collection**:
```javascript
// Add matchableFields to existing documents
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

### Phase 2: Create New Collections

```javascript
// Run in MongoDB shell or migration script
db.createCollection('matches');
db.createCollection('notifications');
```

### Phase 3: Create Indexes

```javascript
// See "Index Strategy" section above for all index creation commands
// Run these AFTER collections are created but BEFORE heavy usage
```

### Phase 4: Data Validation

```javascript
// Verify all existing clients have userId
db.clients.countDocuments({ userId: { $exists: false } });
// Should be 0

// Verify all existing inventory has userId
db.cars.countDocuments({ userId: { $exists: false } });
// Should be 0
```

### Rollback Plan

If migration fails:
1. Drop new collections: `db.matches.drop()`, `db.notifications.drop()`
2. Remove new fields: `db.clients.updateMany({}, { $unset: { lookingFor: "", matchCount: "", activeMatches: "" } })`
3. Remove indexes: `db.clients.dropIndex("userId_1_lookingFor.parsedCriteria.makes_1")`
4. Restore from backup if needed

---

**Next Document**: [API Specifications](./01-TECHNICAL-DESIGN-API-SPECS.md)
