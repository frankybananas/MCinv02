import mongoose, { Schema, Document } from 'mongoose';

export interface IFacebookPost extends Document {
  // User & Car Reference
  userId: mongoose.Types.ObjectId;
  carId: mongoose.Types.ObjectId;
  
  // Post Content
  content: string;
  hashtags: string[];
  imageUrls: string[];
  
  // Facebook Data
  facebookPostId?: string;
  facebookPageId?: string;
  accountType: 'personal' | 'business_page';
  
  // Status Tracking
  status: 'pending' | 'processing' | 'published' | 'failed' | 'scheduled';
  scheduledFor?: Date;
  publishedAt?: Date;
  
  // Error Handling
  error?: string;
  retryCount: number;
  maxRetries: number;
  lastAttempt?: Date;
  
  // Analytics
  analytics?: {
    likes?: number;
    comments?: number;
    shares?: number;
    reach?: number;
    engagement?: number;
    lastSynced?: Date;
  };
  
  // AI Generation Metadata
  aiModel: string;
  aiPromptVersion: string;
  generationTime?: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const FacebookPostSchema = new Schema<IFacebookPost>({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  carId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Car', 
    required: true,
    index: true 
  },
  
  content: { 
    type: String, 
    required: true 
  },
  hashtags: [String],
  imageUrls: [String],
  
  facebookPostId: { 
    type: String,
    unique: true,
    sparse: true,
    index: true 
  },
  facebookPageId: String,
  accountType: { 
    type: String, 
    enum: ['personal', 'business_page'] 
  },
  
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'published', 'failed', 'scheduled'],
    default: 'pending',
    required: true,
    index: true 
  },
  scheduledFor: Date,
  publishedAt: { 
    type: Date,
    index: true 
  },
  
  error: String,
  retryCount: { 
    type: Number, 
    default: 0 
  },
  maxRetries: { 
    type: Number, 
    default: 3 
  },
  lastAttempt: Date,
  
  analytics: {
    likes: Number,
    comments: Number,
    shares: Number,
    reach: Number,
    engagement: Number,
    lastSynced: Date
  },
  
  aiModel: { 
    type: String, 
    default: 'gemini-1.5-flash' 
  },
  aiPromptVersion: { 
    type: String, 
    default: 'v1.0' 
  },
  generationTime: Number,
  
}, {
  timestamps: true,
  collection: 'facebook_posts'
});

// Compound indexes for common queries
FacebookPostSchema.index({ userId: 1, status: 1 });
FacebookPostSchema.index({ userId: 1, createdAt: -1 });
FacebookPostSchema.index({ carId: 1, status: 1 });
FacebookPostSchema.index({ status: 1, scheduledFor: 1 });

export default mongoose.models.FacebookPost || mongoose.model<IFacebookPost>('FacebookPost', FacebookPostSchema);
