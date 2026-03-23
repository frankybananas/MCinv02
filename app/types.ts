export type CarState = "in-stock" | "coming" | "reserved" | "sold";
export type CarStatus = "all" | CarState | "demo";
export type DashboardTab = CarStatus | "clients" | "delivery" | "notifications" | "todo" | "marketing" | "recon" | "admin";

export interface Picture {
  _id?: string;
  id?: string;
  title: string;
  description?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  altText?: string;
  car?: string;
  client?: string;
  tags?: string[];
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
    size?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export type DeliveryStatus = "active" | "completed" | "canceled";

export type DeliveryDocKind =
  | "id_copy"
  | "proof_of_address"
  | "company_docs"
  | "director_id"
  | "company_proof_of_address"
  | "brnc_certificate"
  | "trade_in_natis"
  | "source_of_funds"
  | "ubo_form";

export interface DeliveryDoc {
  kind: DeliveryDocKind;
  url?: string; // present when uploaded to server/cloud; absent when stored locally only
  localKey?: string; // IndexedDB key when stored locally on device
  fileType: string;
  fileSize?: number;
  uploadedAt: string;
}

export interface Delivery {
  _id: string;
  car: Car | string;
  salesperson: string;
  client?: Client | string;
  status: DeliveryStatus;
  deliveryDate?: string;
  financeBank?: string;
  reconTasks?: ReconTask[];
  reconReady?: boolean;
  licensing?: { done: boolean; notes?: string };
  customerType: "natural" | "company";
  docs: DeliveryDoc[];
  additionalDocs?: {
    trade_in_natis?: boolean;
    source_of_funds?: boolean;
    ubo_form?: boolean;
  };
  createdAt: string;
  updatedAt: string;
  auditLog?: AuditLogEntry[];
}

// Notifications
export type NotificationType =
  | "car_new"
  | "car_reserved"
  | "car_sold"
  | "delivery_update"
  | "delivery_due_soon"
  | "delivery_completed"
  | "todo_reminder"
  | "client_match";

export interface NotificationItem {
  _id: string; // unique per item (can be a composite)
  type: NotificationType;
  title: string;
  description?: string;
  createdAt: string; // ISO
  // Optional linkage data for navigation
  data?: {
    carId?: string;
    deliveryId?: string;
    imageUrl?: string;
    clientId?: string;
    todoId?: string;
  };
  read?: boolean;
}

// TODO items
export interface TodoItem {
  _id: string;
  user: string; // owner (server ensures isolation)
  date: string; // ISO date (yyyy-mm-dd)
  title: string;
  time?: string;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReconTask {
  text: string;
  done: boolean;
  note?: string;
  assignee?: string; // userId of recon user
  dueDate?: string; // ISO date
  blocked?: boolean;
  blockedReason?: string;
  attachments?: Array<{
    url: string;
    key?: string;
    fileType?: string;
    fileSize?: number;
    uploadedAt: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Car {
  _id: string;
  id?: string;
  images: Picture[]
  year: number
  make: string
  model: string
  price: number
  kilometers: number
  color: string
  transmission: "manual" | "automatic" | "cvt"
  fuelType?: "Petrol" | "Diesel" | "Electric" | "Hybrid"
  vin: string
  notes: string
  description?: string
  features?: string[]
  status: CarState
  demo?: boolean
  doNotAdvertise?: boolean
  reservedBy?: string
  createdAt: string
  auditLog: AuditLogEntry[]
  // Image role indices for persistent ordering
  coverImageIndex?: number | null
  vinImageIndex?: number | null
  // Timestamp when car was marked as sold
  soldAt?: string | null
  // e-Toyota sync fields
  etoyotaId?: number | null
  stockNumber?: string | null
  syncStatus?: 'synced' | 'new' | 'manual'
  missingFromStock?: boolean
  dateFlaggedMissing?: string | null
  lastSyncedAt?: string | null
  daysInStock?: number | null
  dateIntoStock?: string | null
  etoyotaImageCount?: number | null
  placeholderImage?: string | null
  isToyota?: boolean | null
  etoyotaStatusId?: number | null
  trim?: string | null
  manuallyEditedFields?: string[]
}

export interface Interaction {
  note: string;
  timestamp: string;
  _id?: string;
}

export interface Client {
  _id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  cars?: Car[];
  notes?: string;
  interactionHistory?: Interaction[];
  createdAt?: string;
  // Phone number of the user who created/owns this client
  createdByPhone?: string;
  // Whether the client is currently active (default true on server)
  active?: boolean;
}

export interface ClientRequest {
  _id: string;
  client: string;
  createdByPhone: string;
  title?: string;
  freeText?: string;
  requestText?: string; // Legacy field for backward compatibility
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
    parsedAt?: string; // Date via JSON is string
    confidence?: number;
    needsReview?: boolean;
    ambiguities?: string[];
    matchCount?: number;
    lastMatchedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Match result from AI vehicle matching
export interface MatchItem {
  _id: string;
  request: string; // ClientRequest ID
  car: string; // Car ID
  score: number; // Similarity score 0-1
  explanation?: string; // AI-generated explanation
  status: 'new' | 'notified' | 'viewed' | 'dismissed' | 'converted';
  carData?: Car; // Populated car data
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  action: string
  user: string
  timestamp: string
  details: string
}

export interface AppState {
  isAuthenticated: boolean
  currentScreen: "dashboard" | "car-detail" | "add-car" | "edit-car" | "add-client" | "edit-client"
  selectedCar: Car | null
  cars: Car[]
  showReserveModal: boolean
  editingCar: Car | null
  clients: Client[]
  editingClient: Client | null
  activeTabId?: CarStatus | "clients"
}

// Facebook Auth Types
export interface FacebookAuthData {
  userId: string;
  accountType: 'personal' | 'business_page';
  facebookUserId?: string;
  facebookPageId?: string;
  facebookPageName?: string;
  isActive: boolean;
  expiresAt: string;
  lastUsed?: string;
  grantedPermissions: string[];
}

export interface FacebookOAuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  userId?: string;
  pages?: FacebookPage[];
}

export interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
  category: string;
  tasks: string[];
}

// Facebook Post Types
export interface FacebookPostData {
  id: string;
  userId: string;
  carId: string;
  content: string;
  hashtags: string[];
  imageUrls: string[];
  status: 'pending' | 'processing' | 'published' | 'failed' | 'scheduled';
  scheduledFor?: string;
  publishedAt?: string;
  facebookPostId?: string;
  error?: string;
  analytics?: FacebookPostAnalytics;
  createdAt: string;
}

export interface FacebookPostAnalytics {
  likes?: number;
  comments?: number;
  shares?: number;
  reach?: number;
  engagement?: number;
  lastSynced?: string;
}

export interface CreatePostRequest {
  carIds: string[];
  scheduledFor?: string;
  customMessage?: string;
}

export interface GeneratedPost {
  carId: string;
  content: string;
  hashtags: string[];
  imageUrls: string[];
}

// User Profile Extensions
export interface UserContactInfo {
  whatsappNumber?: string;
  location?: string;
  businessName?: string;
}

export interface UserFacebookPreferences {
  defaultPostSchedule?: string;
  autoHashtags: boolean;
  postingCooldown: number;
}
