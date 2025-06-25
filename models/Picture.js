import mongoose from 'mongoose';

const PictureSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a picture title'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  imageUrl: {
    type: String,
    required: [true, 'Please provide an image URL'],
  },
  thumbnailUrl: {
    type: String,
  },
  altText: {
    type: String,
    trim: true,
  },
  car: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Car',
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
  },
  tags: [String],
  metadata: {
    width: Number,
    height: Number,
    format: String,
    size: Number,
  },
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
PictureSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.models.Picture || mongoose.model('Picture', PictureSchema);
