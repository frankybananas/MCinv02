import mongoose, { Schema, Document, Model } from 'mongoose';

export type MatchStatus = 'new' | 'notified' | 'viewed' | 'dismissed' | 'converted';

export interface IMatch extends Document {
  request: mongoose.Types.ObjectId;
  car: mongoose.Types.ObjectId;
  client: mongoose.Types.ObjectId;
  createdByPhone: string; // owner (salesperson) isolation
  score: number;
  explanation?: string;
  status: MatchStatus;
  notifiedAt?: Date;
  viewedAt?: Date;
  dismissedAt?: Date;
  contactedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MatchSchema = new Schema<IMatch>({
  request: { type: Schema.Types.ObjectId, ref: 'ClientRequest', required: true, index: true },
  car: { type: Schema.Types.ObjectId, ref: 'Car', required: true, index: true },
  client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  createdByPhone: { type: String, required: true, index: true },
  score: { type: Number, required: true, index: true },
  explanation: { type: String },
  status: { type: String, enum: ['new', 'notified', 'viewed', 'dismissed', 'converted'], default: 'new', index: true },
  notifiedAt: { type: Date },
  viewedAt: { type: Date },
  dismissedAt: { type: Date },
  contactedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

MatchSchema.index({ request: 1, car: 1 }, { unique: true });

MatchSchema.pre('save', function (next) {
  (this as any).updatedAt = new Date();
  next();
});

const Match: Model<IMatch> = mongoose.models.Match || mongoose.model<IMatch>('Match', MatchSchema);
export default Match;
