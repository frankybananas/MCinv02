import mongoose from 'mongoose';

const CarSchema = new mongoose.Schema({
  make: {
    type: String,
    required: [true, 'Please provide the car make'],
    trim: true,
  },
  model: {
    type: String,
    required: [true, 'Please provide the car model'],
    trim: true,
  },
  year: {
    type: Number,
    required: [true, 'Please provide the car year'],
  },
  licensePlate: {
    type: String,
    trim: true,
  },
  vin: {
    type: String,
    trim: true,
  },
  color: {
    type: String,
    trim: true,
  },
  transmission: {
    type: String,
    enum: ['manual', 'automatic', 'cvt'],
    default: 'automatic',
  },
  fuelType: {
    type: String,
    enum: ['petrol', 'diesel', 'hybrid', 'electric', 'plug-in hybrid'],
    default: 'petrol',
  },
  seats: {
    type: Number,
  },
  description: {
    type: String,
    trim: true,
  },
  notes: {
    type: String,
    trim: true,
  },
  price: {
    type: Number,
    required: [true, 'Please provide the car price'],
  },
  kilometers: {
    type: Number,
  },
  status: {
    type: String,
    enum: ['in-stock', 'coming', 'reserved', 'sold'],
    default: 'coming',
    required: true,
  },
  soldAt: {
    type: Date,
    default: null,
  },
  // e-Toyota sync fields
  etoyotaId: {
    type: Number,
    default: null,
  },
  stockNumber: {
    type: String,
    trim: true,
    default: null,
  },
  syncStatus: {
    type: String,
    enum: ['synced', 'new', 'manual'],
    default: 'manual',
  },
  missingFromStock: {
    type: Boolean,
    default: false,
  },
  dateFlaggedMissing: {
    type: Date,
    default: null,
  },
  lastSyncedAt: {
    type: Date,
    default: null,
  },
  daysInStock: {
    type: Number,
    default: null,
  },
  dateIntoStock: {
    type: Date,
    default: null,
  },
  etoyotaImageCount: {
    type: Number,
    default: null,
  },
  placeholderImage: {
    type: String,
    default: null,
  },
  isToyota: {
    type: Boolean,
    default: null,
  },
  etoyotaStatusId: {
    type: Number,
    default: null,
  },
  trim: {
    type: String,
    trim: true,
    default: null,
  },
  manuallyEditedFields: {
    type: [String],
    default: [],
  },
  demo: {
    type: Boolean,
    default: false,
  },
  doNotAdvertise: {
    type: Boolean,
    default: false,
  },
  serviceHistory: [{
    date: Date,
    description: String,
    mileage: Number,
    cost: Number,
    documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  }],
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
  },
  images: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Picture',
  }],
  // Image role indices (null if no image has that role)
  coverImageIndex: {
    type: Number,
    default: null,
  },
  vinImageIndex: {
    type: Number,
    default: null,
  },
  auditLog: [{
    action: String,
    details: String,
    user: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field on save
CarSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

CarSchema.index(
  { licensePlate: 1 },
  { unique: true, partialFilterExpression: { licensePlate: { $type: 'string', $ne: '' } } }
);

CarSchema.index(
  { etoyotaId: 1 },
  { unique: true, sparse: true, partialFilterExpression: { etoyotaId: { $type: 'number' } } }
);

export default mongoose.models.Car || mongoose.model('Car', CarSchema);
