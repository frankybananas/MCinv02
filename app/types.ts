export type CarState = "in-stock" | "coming" | "reserved" | "sold";
export type CarStatus = "all" | CarState | "demo";
export type DashboardTab = CarStatus | "clients" | "delivery" | "notifications" | "todo";

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
    matchId?: string;
  };
  read?: boolean;
}

// TODO items
export interface TodoItem {
  _id: string;
  user: string; // owner (server ensures isolation)
  date: string; // ISO date (yyyy-mm-dd)
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReconTask {
  text: string;
  done: boolean;
  note?: string;
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
  vin: string
  notes: string
  description?: string
  features?: string[]
  status: CarState
  demo?: boolean
  reservedBy?: string
  createdAt: string
  auditLog: AuditLogEntry[]
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
  requestText?: string;
  embeddingVector?: number[];
  embeddingModel?: string;
  lastEmbeddedAt?: string;
  source?: 'notes' | 'manual' | 'imported';
  priority?: number;
  createdAt: string;
  updatedAt: string;
}

// Matches (frontend types)
export type MatchStatus = 'new' | 'notified' | 'viewed' | 'dismissed' | 'converted';

export interface MatchItem {
  _id: string;
  request?: string;
  car: Car | string;
  client: string;
  createdByPhone?: string;
  score: number;
  explanation?: string;
  status: MatchStatus;
  notifiedAt?: string;
  viewedAt?: string;
  dismissedAt?: string;
  contactedAt?: string;
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
