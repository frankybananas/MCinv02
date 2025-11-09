import mongoose from 'mongoose';

const CarSchema = new mongoose.Schema({
  // Schema definition...
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
    user: String, // Storing user identifier (e.g., phone number)
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
  this.updatedAt = Date.now();
  next();
});

// Enforce uniqueness only when licensePlate is a non-empty string
// This avoids duplicate key errors for null/undefined/empty values
CarSchema.index(
  { licensePlate: 1 },
  { unique: true, partialFilterExpression: { licensePlate: { $type: 'string', $ne: '' } } }
);

export default mongoose.models.Car || mongoose.model('Car', CarSchema);
