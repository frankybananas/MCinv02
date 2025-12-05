import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClientRequest extends Document {
  client: mongoose.Types.ObjectId;
  createdByPhone: string; // owner isolation
  title?: string;
  freeText?: string; // original raw note
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
  source?: 'notes' | 'manual' | 'imported';
  priority?: number;
  aiParsing?: {
    parsedAt?: Date;
    confidence?: number;
    needsReview?: boolean;
    ambiguities?: string[];
    matchCount?: number;
    lastMatchedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ClientRequestSchema = new Schema<IClientRequest>({
  client: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
  createdByPhone: { type: String, required: true, index: true },
  title: { type: String, trim: true },
  freeText: { type: String },
  status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active', index: true },
  filters: {
    makes: [{ type: String }],
    models: [{ type: String }],
    minYear: { type: Number },
    maxYear: { type: Number },
    maxMileageKm: { type: Number },
    minBudgetZar: { type: Number },
    maxBudgetZar: { type: Number },
    seats: { type: Number },
    fuelTypes: [{ type: String }],
    transmissions: [{ type: String }],
    bodyTypes: [{ type: String }],
    colors: [{ type: String }],
    mustHave: [{ type: String }],
    niceToHave: [{ type: String }],
    excludeTerms: [{ type: String }],
  },
  aiParsing: {
    parsedAt: { type: Date },
    confidence: { type: Number, min: 0, max: 1 },
    needsReview: { type: Boolean, default: false },
    ambiguities: [{ type: String }],
    matchCount: { type: Number, default: 0 },
    lastMatchedAt: { type: Date },
  },
  source: { type: String, enum: ['notes', 'manual', 'imported'], default: 'manual' },
  priority: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ClientRequestSchema.pre('save', function (next) {
  (this as any).updatedAt = new Date();
  next();
});

const ClientRequest: Model<IClientRequest> = mongoose.models.ClientRequest || mongoose.model<IClientRequest>('ClientRequest', ClientRequestSchema);
export default ClientRequest;
