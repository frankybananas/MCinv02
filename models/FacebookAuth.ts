import mongoose, { Schema, Document } from 'mongoose';

export interface IFacebookAuth extends Document {
  userId: mongoose.Types.ObjectId;
  
  // OAuth Tokens
  accessToken: string;
  tokenType: string;
  expiresAt: Date;
  refreshToken?: string;
  
  // User/Page Selection
  accountType: 'personal' | 'business_page';
  facebookUserId?: string;
  facebookPageId?: string;
  facebookPageName?: string;
  facebookPageAccessToken?: string;
  
  // Permissions
  grantedPermissions: string[];
  
  // Status
  isActive: boolean;
  lastUsed?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

const FacebookAuthSchema = new Schema<IFacebookAuth>({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    unique: true,
    index: true 
  },
  
  accessToken: { 
    type: String, 
    required: true,
    select: false
  },
  tokenType: { 
    type: String, 
    default: 'Bearer' 
  },
  expiresAt: { 
    type: Date, 
    required: true,
    index: true
  },
  refreshToken: { 
    type: String,
    select: false 
  },
  
  accountType: { 
    type: String, 
    enum: ['personal', 'business_page'],
    required: true 
  },
  facebookUserId: { 
    type: String,
    index: true,
    sparse: true
  },
  facebookPageId: { 
    type: String,
    index: true,
    sparse: true
  },
  facebookPageName: String,
  facebookPageAccessToken: { 
    type: String,
    select: false 
  },
  
  grantedPermissions: [{ 
    type: String 
  }],
  
  isActive: { 
    type: Boolean, 
    default: true,
    index: true 
  },
  lastUsed: Date,
  
}, {
  timestamps: true,
  collection: 'facebook_auths'
});

// Compound indexes
FacebookAuthSchema.index({ userId: 1, isActive: 1 });

// TTL index - automatically delete expired tokens after 7 days of expiry
FacebookAuthSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 604800 });

export default mongoose.models.FacebookAuth || mongoose.model<IFacebookAuth>('FacebookAuth', FacebookAuthSchema);
