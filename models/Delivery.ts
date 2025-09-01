import mongoose from 'mongoose';

const DeliveryDocSchema = new mongoose.Schema({
  kind: { type: String, enum: [
    'id_copy',
    'proof_of_address',
    'company_docs',
    'director_id',
    'company_proof_of_address',
    'brnc_certificate'
  ], required: true },
  url: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number },
  uploadedAt: { type: Date, default: Date.now },
});

const DeliverySchema = new mongoose.Schema({
  car: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
  salesperson: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  status: { type: String, enum: ['active', 'completed', 'canceled'], default: 'active' },
  deliveryDate: { type: Date },
  financeBank: { type: String },
  reconNotes: { type: String },
  licensing: {
    done: { type: Boolean, default: false },
    notes: { type: String }
  },
  customerType: { type: String, enum: ['natural', 'company'], default: 'natural' },
  docs: [DeliveryDocSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

DeliverySchema.index({ car: 1, salesperson: 1 }, { unique: true });

DeliverySchema.pre('save', function(next) {
  (this as any).updatedAt = new Date();
  next();
});

export default mongoose.models.Delivery || mongoose.model('Delivery', DeliverySchema);
