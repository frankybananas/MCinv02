import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVehicleMatch extends Document {
  request: mongoose.Types.ObjectId;    // Reference to ClientRequest
  car: mongoose.Types.ObjectId;        // Reference to Car
  createdByPhone: string;              // CRITICAL: owner isolation (copied from request)
  
  // Scoring
  score: number;                       // 0-100 match score
  quality: 'excellent' | 'good' | 'fair';
  breakdown: {
    makeScore: number;                 // 0-25
    modelScore: number;                // 0-25
    yearScore: number;                 // 0-15
    priceScore: number;                // 0-15
    colorScore: number;                // 0-10
    otherScore: number;                // 0-10 (transmission, fuel, mileage)
  };
  explanation?: string;                // AI-generated explanation
  
  // Status tracking
  status: 'new' | 'notified' | 'viewed' | 'dismissed' | 'converted';
  notifiedAt?: Date;
  viewedAt?: Date;
  dismissedAt?: Date;
  dismissReason?: string;
  
  // Snapshot data (for historical reference)
  carSnapshot: {
    make: string;
    model: string;
    year: number;
    price: number;
    color: string;
    status: string;
    imageUrl?: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;                     // TTL: 90 days
}

const VehicleMatchSchema = new Schema<IVehicleMatch>({
  request: { type: Schema.Types.ObjectId, ref: 'ClientRequest', required: true, index: true },
  car: { type: Schema.Types.ObjectId, ref: 'Car', required: true, index: true },
  createdByPhone: { type: String, required: true, index: true },
  
  score: { type: Number, required: true, min: 0, max: 100 },
  quality: { type: String, enum: ['excellent', 'good', 'fair'], required: true },
  breakdown: {
    makeScore: { type: Number, default: 0 },
    modelScore: { type: Number, default: 0 },
    yearScore: { type: Number, default: 0 },
    priceScore: { type: Number, default: 0 },
    colorScore: { type: Number, default: 0 },
    otherScore: { type: Number, default: 0 }
  },
  explanation: { type: String },
  
  status: { 
    type: String, 
    enum: ['new', 'notified', 'viewed', 'dismissed', 'converted'], 
    default: 'new',
    index: true 
  },
  notifiedAt: { type: Date },
  viewedAt: { type: Date },
  dismissedAt: { type: Date },
  dismissReason: { type: String },
  
  carSnapshot: {
    make: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    price: { type: Number, required: true },
    color: { type: String },
    status: { type: String },
    imageUrl: { type: String }
  },
  
  expiresAt: { type: Date, required: true, index: true }
}, {
  timestamps: true
});

// Indexes
VehicleMatchSchema.index({ createdByPhone: 1, status: 1, createdAt: -1 });
VehicleMatchSchema.index({ request: 1, car: 1 }, { unique: true }); // Prevent duplicates
VehicleMatchSchema.index({ createdByPhone: 1, score: -1 });
VehicleMatchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL

// Pre-save hook
VehicleMatchSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
  }
  next();
});

const VehicleMatch: Model<IVehicleMatch> = mongoose.models.VehicleMatch || mongoose.model<IVehicleMatch>('VehicleMatch', VehicleMatchSchema);

export default VehicleMatch;
