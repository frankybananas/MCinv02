export interface EToyotaAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface EToyotaVehicle {
  Id: number;
  DMSStockNumber: string;
  RegistrationNumber: string;
  Description: string;
  ModelYear: number;
  OdoMeterReading: number;
  RetailPrice: number;
  DaysInStock: number;
  DateIntoStock: string;
  ImageCount: number;
  FallbackBodyStyleImage: string;
  IsInStock: boolean;
  CurrentTrim: string;
  IsToyotaMake: boolean;
  VehicleStockStatusId: number;
  IsNew: boolean;
  Deleted: boolean;
  Active: boolean;
  IsValidated: boolean;
  DealershipId: number;
  VehicleStockColour?: EToyotaColour[];
  VehicleStockStatus?: EToyotaStatus;
}

export interface EToyotaColour {
  Id: number;
  Name: string;
  Code?: string;
}

export interface EToyotaStatus {
  Id: number;
  Name: string;
  Description?: string;
}

export interface EToyotaStockResponse {
  vehicles: EToyotaVehicle[];
  totalCount: number;
  pages: number;
}

export interface EToyotaSession {
  accessToken: string;
  expiresAt: number;
  cookies: string;
}
