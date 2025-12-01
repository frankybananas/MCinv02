import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ISoldCar extends Document {
  originalCarId: string;
  make: string;
  carModel: string; // Renamed from 'model' to avoid conflict with Document.model()
  year: number;
  price: number;
  kilometers?: number;
  color?: string;
  soldDate: Date;
  soldByUser: string; // Phone number of user who marked as sold
  soldByUserName?: string; // User's name
  deliveryDate?: Date;
  finalPrice?: number; // In case price changed at sale
  customerName?: string;
  notes?: string;
  // Preserved images from archive (Cover + VIN only)
  coverImageUrl?: string;
  coverThumbnailUrl?: string;
  vinImageUrl?: string;
  vinThumbnailUrl?: string;
  archivedAt: Date;
  createdAt: Date;
}

const SoldCarSchema = new Schema<ISoldCar>({
  originalCarId: { type: String, required: true, index: true },
  make: { type: String, required: true, trim: true },
  carModel: { type: String, required: true, trim: true },
  year: { type: Number, required: true },
  price: { type: Number, required: true },
  kilometers: { type: Number },
  color: { type: String, trim: true },
  soldDate: { type: Date, required: true, index: true },
  soldByUser: { type: String, required: true, index: true },
  soldByUserName: { type: String, trim: true },
  deliveryDate: { type: Date },
  finalPrice: { type: Number },
  customerName: { type: String, trim: true },
  notes: { type: String, trim: true },
  // Preserved images from archive (Cover + VIN only)
  coverImageUrl: { type: String },
  coverThumbnailUrl: { type: String },
  vinImageUrl: { type: String },
  vinThumbnailUrl: { type: String },
  archivedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

// Index for efficient queries
SoldCarSchema.index({ soldDate: -1 });
SoldCarSchema.index({ soldByUser: 1, soldDate: -1 });

const SoldCar: Model<ISoldCar> = mongoose.models.SoldCar || mongoose.model<ISoldCar>('SoldCar', SoldCarSchema);
export default SoldCar;
