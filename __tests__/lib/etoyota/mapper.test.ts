import {
  extractVinSuffix,
  parseDescription,
  computePriceInclVAT,
  mapVehicleToNewCar,
  mapVehicleToMutableFields,
} from '@/lib/etoyota/mapper';
import type { EToyotaVehicle } from '@/lib/etoyota/types';

const mockVehicle: EToyotaVehicle = {
  Id: 12345,
  DMSStockNumber: '65USP39830',
  RegistrationNumber: 'HYL791K',
  Description: 'TOYOTA HILUX 2.4GD6 4X4 SR 6MT',
  ModelYear: 2023,
  OdoMeterReading: 45000,
  RetailPrice: 400000,
  DaysInStock: 30,
  DateIntoStock: '2024-01-15T00:00:00',
  ImageCount: 8,
  FallbackBodyStyleImage: 'https://example.com/hilux.svg',
  IsInStock: true,
  CurrentTrim: 'Glacier White',
  IsToyotaMake: true,
  VehicleStockStatusId: 1,
  IsNew: false,
  Deleted: false,
  Active: true,
  IsValidated: true,
  DealershipId: 113,
};

describe('extractVinSuffix', () => {
  it('returns last 5 characters of stock number', () => {
    expect(extractVinSuffix('65USP39830')).toBe('39830');
  });

  it('returns uppercased result', () => {
    expect(extractVinSuffix('65usp39830')).toBe('39830');
  });

  it('handles stock number shorter than 5 chars', () => {
    expect(extractVinSuffix('ABC')).toBe('ABC');
  });

  it('handles empty string', () => {
    expect(extractVinSuffix('')).toBe('');
  });

  it('handles exactly 5 chars', () => {
    expect(extractVinSuffix('ABCDE')).toBe('ABCDE');
  });

  it('returns last 5 of longer strings', () => {
    expect(extractVinSuffix('1234567890')).toBe('67890');
  });
});

describe('parseDescription', () => {
  it('splits first word as make and rest as model', () => {
    const result = parseDescription('TOYOTA HILUX 2.4GD6 4X4 SR 6MT');
    expect(result.make).toBe('TOYOTA');
    expect(result.model).toBe('HILUX 2.4GD6 4X4 SR 6MT');
  });

  it('handles single word description', () => {
    const result = parseDescription('TOYOTA');
    expect(result.make).toBe('TOYOTA');
    expect(result.model).toBe('TOYOTA');
  });

  it('handles empty string', () => {
    const result = parseDescription('');
    expect(result.make).toBe('UNKNOWN');
    expect(result.model).toBe('UNKNOWN');
  });

  it('trims whitespace', () => {
    const result = parseDescription('  BMW  X5 ');
    expect(result.make).toBe('BMW');
    expect(result.model).toBe('X5');
  });

  it('handles AUDI multi-word model', () => {
    const result = parseDescription('AUDI Q3 35 TFSI S TRONIC');
    expect(result.make).toBe('AUDI');
    expect(result.model).toBe('Q3 35 TFSI S TRONIC');
  });
});

describe('computePriceInclVAT', () => {
  it('multiplies by 1.15', () => {
    expect(computePriceInclVAT(100000)).toBe(115000);
  });

  it('rounds to 2 decimal places', () => {
    expect(computePriceInclVAT(99999)).toBe(114998.85);
  });

  it('handles zero', () => {
    expect(computePriceInclVAT(0)).toBe(0);
  });

  it('handles large prices', () => {
    expect(computePriceInclVAT(500000)).toBe(575000);
  });
});

describe('mapVehicleToNewCar', () => {
  it('correctly maps all fields', () => {
    const result = mapVehicleToNewCar(mockVehicle);

    expect(result.etoyotaId).toBe(12345);
    expect(result.stockNumber).toBe('65USP39830');
    expect(result.vin).toBe('39830');
    expect(result.licensePlate).toBe('HYL791K');
    expect(result.make).toBe('TOYOTA');
    expect(result.model).toBe('HILUX 2.4GD6 4X4 SR 6MT');
    expect(result.year).toBe(2023);
    expect(result.price).toBe(460000);
    expect(result.kilometers).toBe(45000);
    expect(result.color).toBe('Glacier White');
    expect(result.trim).toBe('Glacier White');
    expect(result.daysInStock).toBe(30);
    expect(result.dateIntoStock).toBeInstanceOf(Date);
    expect(result.etoyotaImageCount).toBe(8);
    expect(result.placeholderImage).toBe('https://example.com/hilux.svg');
    expect(result.isToyota).toBe(true);
    expect(result.etoyotaStatusId).toBe(1);
    expect(result.status).toBe('in-stock');
    expect(result.syncStatus).toBe('new');
  });

  it('handles missing optional fields with defaults', () => {
    const sparse: EToyotaVehicle = {
      ...mockVehicle,
      RegistrationNumber: '',
      CurrentTrim: '',
      DaysInStock: undefined as unknown as number,
      DateIntoStock: '',
      FallbackBodyStyleImage: '',
    };
    const result = mapVehicleToNewCar(sparse);
    expect(result.licensePlate).toBe('');
    expect(result.color).toBe('');
    expect(result.daysInStock).toBeNull();
    expect(result.dateIntoStock).toBeNull();
    expect(result.placeholderImage).toBeNull();
  });
});

describe('mapVehicleToMutableFields', () => {
  it('maps only mutable fields', () => {
    const result = mapVehicleToMutableFields(mockVehicle);

    expect(result.vin).toBe('39830'); // last 5 of DMSStockNumber '65USP39830'
    expect(result.kilometers).toBe(45000);
    expect(result.daysInStock).toBe(30);
    expect(result.price).toBe(460000);
    expect(result.etoyotaStatusId).toBe(1);
    expect(result.etoyotaImageCount).toBe(8);
    expect(result.lastSyncedAt).toBeInstanceOf(Date);
  });

  it('vin is last 5 chars of DMSStockNumber uppercased', () => {
    const result = mapVehicleToMutableFields({ ...mockVehicle, DMSStockNumber: 'ABCDE12345' });
    expect(result.vin).toBe('12345');
  });

  it('vin is empty string when DMSStockNumber is missing', () => {
    const result = mapVehicleToMutableFields({ ...mockVehicle, DMSStockNumber: '' });
    expect(result.vin).toBe('');
  });

  it('lastSyncedAt is close to now', () => {
    const before = Date.now();
    const result = mapVehicleToMutableFields(mockVehicle);
    const after = Date.now();
    const ts = result.lastSyncedAt.getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
