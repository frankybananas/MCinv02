/**
 * @jest-environment node
 */
import { runSync } from '@/lib/etoyota/sync-engine';

// Mock all external dependencies
jest.mock('@/lib/mongodb', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/cron-metadata', () => ({
  markCronRunning: jest.fn().mockResolvedValue(undefined),
  markCronSuccess: jest.fn().mockResolvedValue(undefined),
  markCronError: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/etoyota/stock', () => ({
  fetchUsedStock: jest.fn(),
}));

jest.mock('@/models/SyncLog', () => {
  const mockLog = { _id: 'log-id-1' };
  return {
    __esModule: true,
    default: {
      create: jest.fn().mockResolvedValue(mockLog),
      updateOne: jest.fn().mockResolvedValue({}),
    },
  };
});

// Mock Car model
const mockCarFind = jest.fn();
const mockCarCreate = jest.fn();
const mockCarUpdateOne = jest.fn();

jest.mock('@/models/Car', () => ({
  __esModule: true,
  default: {
    find: jest.fn(() => ({ lean: mockCarFind })),
    create: mockCarCreate,
    updateOne: mockCarUpdateOne,
  },
}));

const { fetchUsedStock } = require('@/lib/etoyota/stock');

const baseApiVehicle = {
  Id: 1001,
  DMSStockNumber: '65USP39830',
  RegistrationNumber: 'HYL791K',
  Description: 'TOYOTA HILUX 2.4GD6 4X4 SR',
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

describe('runSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCarFind.mockResolvedValue([]);
    mockCarCreate.mockResolvedValue({});
    mockCarUpdateOne.mockResolvedValue({});
  });

  describe('new vehicles', () => {
    it('creates placeholder cars for vehicles not in DB', async () => {
      fetchUsedStock.mockResolvedValue({
        vehicles: [baseApiVehicle],
        totalCount: 1,
        pages: 0,
      });
      mockCarFind.mockResolvedValue([]);

      const result = await runSync('cron');

      expect(result.vehiclesAdded).toBe(1);
      expect(result.vehiclesUpdated).toBe(0);
      expect(result.vehiclesFlagged).toBe(0);
      expect(mockCarCreate).toHaveBeenCalledTimes(1);

      const createdData = mockCarCreate.mock.calls[0][0];
      expect(createdData.etoyotaId).toBe(1001);
      expect(createdData.syncStatus).toBe('new');
      expect(createdData.status).toBe('in-stock');
      expect(createdData.vin).toBe('39830'); // last 5 of DMSStockNumber
    });

    it('stores price as incl. VAT (x1.15)', async () => {
      fetchUsedStock.mockResolvedValue({
        vehicles: [{ ...baseApiVehicle, RetailPrice: 400000 }],
        totalCount: 1,
        pages: 0,
      });

      await runSync('cron');

      const createdData = mockCarCreate.mock.calls[0][0];
      expect(createdData.price).toBe(460000); // 400000 * 1.15
    });
  });

  describe('existing vehicles — primary match by etoyotaId', () => {
    it('updates mutable fields on existing synced car', async () => {
      fetchUsedStock.mockResolvedValue({
        vehicles: [{ ...baseApiVehicle, OdoMeterReading: 50000 }],
        totalCount: 1,
        pages: 0,
      });
      mockCarFind.mockResolvedValue([
        {
          _id: 'car-mongo-id',
          etoyotaId: 1001,
          vin: '39830',
          syncStatus: 'synced',
          missingFromStock: false,
          manuallyEditedFields: [],
        },
      ]);

      const result = await runSync('cron');

      expect(result.vehiclesUpdated).toBe(1);
      expect(result.vehiclesAdded).toBe(0);
      expect(mockCarUpdateOne).toHaveBeenCalledWith(
        { _id: 'car-mongo-id' },
        expect.objectContaining({
          $set: expect.objectContaining({
            kilometers: 50000,
            etoyotaId: 1001,
            missingFromStock: false,
          }),
        })
      );
    });

    it('does not overwrite manually edited fields', async () => {
      fetchUsedStock.mockResolvedValue({
        vehicles: [{ ...baseApiVehicle, OdoMeterReading: 55000, RetailPrice: 450000 }],
        totalCount: 1,
        pages: 0,
      });
      mockCarFind.mockResolvedValue([
        {
          _id: 'car-id',
          etoyotaId: 1001,
          vin: '39830',
          syncStatus: 'synced',
          missingFromStock: false,
          manuallyEditedFields: ['kilometers', 'price'],
        },
      ]);

      await runSync('cron');

      const updateCall = mockCarUpdateOne.mock.calls[0][1].$set;
      // These fields are manually edited — should NOT be in the update
      expect(updateCall).not.toHaveProperty('kilometers');
      expect(updateCall).not.toHaveProperty('price');
      // These should still be updated
      expect(updateCall).toHaveProperty('etoyotaStatusId');
    });

    it('promotes syncStatus from new to synced on update', async () => {
      fetchUsedStock.mockResolvedValue({
        vehicles: [baseApiVehicle],
        totalCount: 1,
        pages: 0,
      });
      mockCarFind.mockResolvedValue([
        {
          _id: 'car-id',
          etoyotaId: 1001,
          vin: '39830',
          syncStatus: 'new',
          missingFromStock: false,
          manuallyEditedFields: [],
        },
      ]);

      await runSync('cron');

      const updateCall = mockCarUpdateOne.mock.calls[0][1].$set;
      expect(updateCall.syncStatus).toBe('synced');
    });

    it('clears missingFromStock when car returns to stock', async () => {
      fetchUsedStock.mockResolvedValue({
        vehicles: [baseApiVehicle],
        totalCount: 1,
        pages: 0,
      });
      mockCarFind.mockResolvedValue([
        {
          _id: 'car-id',
          etoyotaId: 1001,
          vin: '39830',
          syncStatus: 'synced',
          missingFromStock: true,
          dateFlaggedMissing: new Date('2024-01-01'),
          manuallyEditedFields: [],
        },
      ]);

      await runSync('cron');

      const updateCall = mockCarUpdateOne.mock.calls[0][1].$set;
      expect(updateCall.missingFromStock).toBe(false);
      expect(updateCall.dateFlaggedMissing).toBeNull();
    });
  });

  describe('fallback match by VIN suffix', () => {
    it('matches existing manually-entered car by last 5 digits of stock number', async () => {
      fetchUsedStock.mockResolvedValue({
        vehicles: [baseApiVehicle],
        totalCount: 1,
        pages: 0,
      });
      // Car has no etoyotaId but VIN matches last 5 of DMSStockNumber (39830)
      mockCarFind.mockResolvedValue([
        {
          _id: 'manual-car-id',
          etoyotaId: null,
          vin: '39830', // matches extractVinSuffix('65USP39830')
          syncStatus: 'manual',
          missingFromStock: false,
          manuallyEditedFields: [],
        },
      ]);

      const result = await runSync('cron');

      expect(result.vehiclesAdded).toBe(0);
      expect(result.vehiclesUpdated).toBe(1);
      // Should set etoyotaId on the car
      const updateCall = mockCarUpdateOne.mock.calls[0][1].$set;
      expect(updateCall.etoyotaId).toBe(1001);
    });
  });

  describe('missing vehicles', () => {
    it('flags cars as missing when not in API response', async () => {
      fetchUsedStock.mockResolvedValue({
        vehicles: [],
        totalCount: 0,
        pages: 0,
      });
      mockCarFind.mockResolvedValue([
        {
          _id: 'car-id',
          etoyotaId: 1001,
          vin: '39830',
          syncStatus: 'synced',
          missingFromStock: false,
          manuallyEditedFields: [],
        },
      ]);

      const result = await runSync('cron');

      expect(result.vehiclesFlagged).toBe(1);
      expect(result.vehiclesAdded).toBe(0);
      expect(result.vehiclesUpdated).toBe(0);

      const updateCall = mockCarUpdateOne.mock.calls[0][1].$set;
      expect(updateCall.missingFromStock).toBe(true);
      expect(updateCall.dateFlaggedMissing).toBeInstanceOf(Date);
    });

    it('does not re-flag already flagged missing cars', async () => {
      fetchUsedStock.mockResolvedValue({
        vehicles: [],
        totalCount: 0,
        pages: 0,
      });
      mockCarFind.mockResolvedValue([
        {
          _id: 'car-id',
          etoyotaId: 1001,
          vin: '39830',
          syncStatus: 'synced',
          missingFromStock: true, // already flagged
          dateFlaggedMissing: new Date('2024-01-01'),
          manuallyEditedFields: [],
        },
      ]);

      const result = await runSync('cron');

      expect(result.vehiclesFlagged).toBe(0);
      expect(mockCarUpdateOne).not.toHaveBeenCalled();
    });

    it('does not flag manual cars (no etoyotaId)', async () => {
      fetchUsedStock.mockResolvedValue({
        vehicles: [],
        totalCount: 0,
        pages: 0,
      });
      mockCarFind.mockResolvedValue([
        {
          _id: 'manual-car',
          etoyotaId: null,
          vin: 'XYZ99',
          syncStatus: 'manual',
          missingFromStock: false,
          manuallyEditedFields: [],
        },
      ]);

      const result = await runSync('cron');

      expect(result.vehiclesFlagged).toBe(0);
      expect(mockCarUpdateOne).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('returns error when fetchUsedStock throws', async () => {
      fetchUsedStock.mockRejectedValue(new Error('API timeout'));

      await expect(runSync('cron')).rejects.toThrow('API timeout');
    });

    it('continues processing other vehicles when one create fails', async () => {
      fetchUsedStock.mockResolvedValue({
        vehicles: [
          { ...baseApiVehicle, Id: 1001 },
          { ...baseApiVehicle, Id: 1002, DMSStockNumber: '65USP99999' },
        ],
        totalCount: 2,
        pages: 0,
      });
      mockCarFind.mockResolvedValue([]);

      // First create fails, second succeeds
      mockCarCreate
        .mockRejectedValueOnce(new Error('DB write error'))
        .mockResolvedValueOnce({});

      const result = await runSync('cron');

      expect(result.vehiclesAdded).toBe(1);
      expect(result.syncErrors).toHaveLength(1);
      expect(result.syncErrors[0]).toContain('Create failed');
    });
  });

  describe('triggeredBy modes', () => {
    it('accepts manual trigger type', async () => {
      fetchUsedStock.mockResolvedValue({ vehicles: [], totalCount: 0, pages: 0 });
      mockCarFind.mockResolvedValue([]);

      const result = await runSync('manual');
      expect(result).toBeDefined();
      expect(typeof result.durationMs).toBe('number');
    });
  });
});
