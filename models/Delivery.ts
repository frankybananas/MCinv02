import mongoose from 'mongoose';

const DeliveryDocSchema = new mongoose.Schema({
  kind: { type: String, enum: [
    'id_copy',
    'proof_of_address',
    'company_docs',
    'director_id',
    'company_proof_of_address',
    'brnc_certificate',
    'trade_in_natis',
    'source_of_funds',
    'ubo_form'
  ], required: true },
  url: { type: String },
  localKey: { type: String },
  fileType: { type: String, required: true },
  fileSize: { type: Number },
  uploadedAt: { type: Date, default: Date.now },
});

const ReconTaskSchema = new mongoose.Schema({
  text: { type: String, required: true },
  done: { type: Boolean, default: false },
  note: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const DeliverySchema = new mongoose.Schema({
  car: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
  salesperson: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  status: { type: String, enum: ['active', 'completed', 'canceled'], default: 'active' },
  deliveryDate: { type: Date },
  financeBank: { type: String },
  reconNotes: { type: String },
  reconTasks: { type: [ReconTaskSchema], default: [] },
  licensing: {
    done: { type: Boolean, default: false },
    notes: { type: String }
  },
  customerType: { type: String, enum: ['natural', 'company'], default: 'natural' },
  docs: [DeliveryDocSchema],
  additionalDocs: {
    trade_in_natis: { type: Boolean, default: false },
    source_of_funds: { type: Boolean, default: false },
    ubo_form: { type: Boolean, default: false },
  },
  auditLog: [
    new mongoose.Schema({
      action: { type: String, required: true },
      user: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      details: { type: String },
    }, { _id: false })
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

DeliverySchema.index({ car: 1, salesperson: 1 }, { unique: true });

DeliverySchema.pre('save', function(next) {
  (this as any).updatedAt = new Date();
  next();
});

export default mongoose.models.Delivery || mongoose.model('Delivery', DeliverySchema);
