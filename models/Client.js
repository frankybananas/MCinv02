import mongoose from 'mongoose';

const ClientSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'Please provide the client\'s first name'],
    trim: true,
  },
  lastName: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address'],
    // Email is optional, but if provided, it must be unique.
    // To enforce this, we can use a sparse index.
    sparse: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  // Phone number of the user who created/owns this client
  createdByPhone: {
    type: String,
    index: true,
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },
  cars: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Car',
  }],
  documents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
  }],
  notes: String,
  interactionHistory: [{
    note: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
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
ClientSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.models.Client || mongoose.model('Client', ClientSchema);
