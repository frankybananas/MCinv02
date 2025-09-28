import mongoose, { Document, Schema } from 'mongoose';

export interface IWhatsAppGeneration extends Document {
  user: mongoose.Types.ObjectId;
  generatedAt: Date;
  carCount: number;
  status: 'pending' | 'completed' | 'failed';
  errorMessage?: string;
  carIds: string[];
}

const WhatsAppGenerationSchema = new Schema<IWhatsAppGeneration>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  generatedAt: { type: Date, default: Date.now },
  carCount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  errorMessage: { type: String },
  carIds: [{ type: String }],
});

// Add index for efficient querying
WhatsAppGenerationSchema.index({ user: 1, generatedAt: -1 });

const WhatsAppGeneration = mongoose.models.WhatsAppGeneration || 
  mongoose.model<IWhatsAppGeneration>('WhatsAppGeneration', WhatsAppGenerationSchema);

export default WhatsAppGeneration;
