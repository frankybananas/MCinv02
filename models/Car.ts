import mongoose from 'mongoose';

const carSchema = new mongoose.Schema({
  make: {
    type: String,
    required: true,
  },
  model: {
    type: String,
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  vin: {
    type: String,
    unique: true,
    sparse: true,
  },
  licensePlate: {
    type: String,
    unique: true,
    sparse: true,
  },
  color: String,
  mileage: Number,
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
  },
  images: [{
    type: String, // URLs to images stored in your storage solution
  }],
  // Image role indices (null if no image has that role)
  coverImageIndex: {
    type: Number,
    default: null,
    min: 0,
  },
  vinImageIndex: {
    type: Number,
    default: null,
    min: 0,
  },
  documents: [{
    name: String,
    url: String,
    type: String, // e.g., 'insurance', 'registration', 'inspection'
    expiryDate: Date,
  }],
  serviceHistory: [{
    date: Date,
    description: String,
    cost: Number,
    mileage: Number,
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
carSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.Car || mongoose.model('Car', carSchema);
