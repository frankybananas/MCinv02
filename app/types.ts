export type CarState = "in-stock" | "coming" | "reserved" | "sold";
export type CarStatus = "all" | CarState | "demo";
export type DashboardTab = CarStatus | "clients" | "delivery";

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
