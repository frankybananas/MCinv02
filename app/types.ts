export type CarState = "in-stock" | "coming" | "reserved" | "sold";
export type CarStatus = "all" | CarState;
export type DashboardTab = CarStatus | "clients";

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
  notes?: string;
  interactionHistory?: Interaction[];
  createdAt?: string;
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
