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
    required: [true, 'Please provide the license plate'],
    trim: true,
    unique: true,
  },
  vin: {
    type: String,
    trim: true,
  },
  color: {
    type: String,
    trim: true,
  },
  mileage: {
    type: Number,
  },
  status: {
    type: String,
    enum: ['In Stock', 'Coming', 'Reserved', 'Sold'],
    default: 'Coming',
    required: true,
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

export default mongoose.models.Car || mongoose.model('Car', CarSchema);
