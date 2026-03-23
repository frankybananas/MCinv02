import type { EToyotaVehicle } from './types';

const VAT_MULTIPLIER = 1.15;

export interface MappedCar {
  etoyotaId: number;
  stockNumber: string;
  vin: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  price: number;
  kilometers: number;
  color: string;
  daysInStock: number | null;
  dateIntoStock: Date | null;
  etoyotaImageCount: number;
  placeholderImage: string | null;
  isToyota: boolean;
  etoyotaStatusId: number;
  trim: string | null;
  status: 'in-stock';
  syncStatus: 'new';
}

export interface MutableSyncFields {
  kilometers: number;
  daysInStock: number | null;
  price: number;
  etoyotaStatusId: number;
  etoyotaImageCount: number;
  lastSyncedAt: Date;
}

export function extractVinSuffix(stockNumber: string): string {
  if (!stockNumber || stockNumber.length < 5) return stockNumber ?? '';
  return stockNumber.slice(-5).toUpperCase();
}

export function parseDescription(description: string): { make: string; model: string } {
  const trimmed = (description ?? '').trim();
  if (!trimmed) return { make: 'UNKNOWN', model: 'UNKNOWN' };

  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) return { make: trimmed, model: trimmed };

  const make = trimmed.substring(0, spaceIdx).trim();
  const model = trimmed.substring(spaceIdx + 1).trim() || make;
  return { make, model };
}

export function computePriceInclVAT(retailPriceExclVAT: number): number {
  return Math.round(retailPriceExclVAT * VAT_MULTIPLIER * 100) / 100;
}

export function mapVehicleToNewCar(vehicle: EToyotaVehicle): MappedCar {
  const { make, model } = parseDescription(vehicle.Description ?? '');
  const vinSuffix = extractVinSuffix(vehicle.DMSStockNumber ?? '');

  return {
    etoyotaId: vehicle.Id,
    stockNumber: vehicle.DMSStockNumber ?? '',
    vin: vinSuffix,
    licensePlate: vehicle.RegistrationNumber ?? '',
    make,
    model,
    year: vehicle.ModelYear ?? 0,
    price: computePriceInclVAT(vehicle.RetailPrice ?? 0),
    kilometers: vehicle.OdoMeterReading ?? 0,
    color: vehicle.CurrentTrim ?? '',
    trim: vehicle.CurrentTrim ?? null,
    daysInStock: typeof vehicle.DaysInStock === 'number' ? vehicle.DaysInStock : null,
    dateIntoStock: vehicle.DateIntoStock ? new Date(vehicle.DateIntoStock) : null,
    etoyotaImageCount: vehicle.ImageCount ?? 0,
    placeholderImage: vehicle.FallbackBodyStyleImage || null,
    isToyota: vehicle.IsToyotaMake ?? false,
    etoyotaStatusId: vehicle.VehicleStockStatusId ?? 0,
    status: 'in-stock',
    syncStatus: 'new',
  };
}

export function mapVehicleToMutableFields(vehicle: EToyotaVehicle): MutableSyncFields {
  return {
    kilometers: vehicle.OdoMeterReading ?? 0,
    daysInStock: typeof vehicle.DaysInStock === 'number' ? vehicle.DaysInStock : null,
    price: computePriceInclVAT(vehicle.RetailPrice ?? 0),
    etoyotaStatusId: vehicle.VehicleStockStatusId ?? 0,
    etoyotaImageCount: vehicle.ImageCount ?? 0,
    lastSyncedAt: new Date(),
  };
}
