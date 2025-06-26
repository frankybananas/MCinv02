export type CarStatus = "all" | "in-stock" | "coming" | "reserved" | "sold"

export interface Car {
  id: string
  images: string[]
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
  status: CarStatus
  reservedBy?: string
  createdAt: string
  auditLog: AuditLogEntry[]
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface AuditLogEntry {
  action: string
  user: string
  timestamp: string
  details: string
}

export interface AppState {
  isAuthenticated: boolean
  currentScreen: "login" | "otp" | "dashboard" | "car-detail" | "add-car" | "edit-car" | "add-client" | "edit-client"
  phoneNumber: string
  selectedCar: Car | null
  cars: Car[]
  showReserveModal: boolean
  editingCar: Car | null
  clients: Client[]
  editingClient: Client | null
  activeTabId?: CarStatus | "clients"
}
