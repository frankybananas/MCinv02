jest.mock('@/lib/mongodb', () => ({
  connectToDatabase: jest.fn(async () => ({})),
}));

jest.mock('@/models/ClientRequest', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock('@/models/Car', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  },
}));

jest.mock('@/models/VehicleMatch', () => ({
  __esModule: true,
  default: {
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
  },
}));

import { calculateMatchScore } from '@/lib/matching/scoring';
import { matchClientToInventory } from '@/lib/matching/match-engine';
import type { Car as CarType } from '@/app/types';
import ClientRequest from '@/models/ClientRequest';
import CarModel from '@/models/Car';
import VehicleMatch from '@/models/VehicleMatch';

describe('AI Vehicle Matching - Scoring + Engine', () => {
  describe('calculateMatchScore (scoring engine)', () => {
    it('should produce a high match when conditions are met', () => {
      const criteria = {
        makes: ['Toyota'],
        models: ['Corolla'],
        minYear: 2020,
        maxYear: 2022,
        minBudgetZar: 400000,
        maxBudgetZar: 500000,
        colors: ['White'],
        transmissions: ['Automatic'],
        fuelTypes: ['Petrol'],
        maxMileageKm: 60000,
        mustHave: ['Sport Pack'],
      };

      const car: Partial<CarType> = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2021,
        price: 450000,
        color: 'White',
        transmission: 'automatic',
        fuelType: 'Petrol',
        kilometers: 50000,
        notes: 'This one has the Sport Pack',
      };

      const result = calculateMatchScore(car, criteria);
      expect(result.totalScore).toBe(100);
      expect(result.quality).toBe('excellent');
      expect(result.breakdown).toEqual({
        makeScore: 25,
        modelScore: 25,
        yearScore: 15,
        priceScore: 15,
        colorScore: 10,
        otherScore: 10,
      });
    });

    it('should treat year and price boundaries as inclusive matches', () => {
      const criteria = {
        makes: ['Toyota'],
        models: ['Corolla'],
        minYear: 2020,
        maxYear: 2020,
        minBudgetZar: 450000,
        maxBudgetZar: 450000,
      };

      const car: Partial<CarType> = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 450000,
      };

      const result = calculateMatchScore(car, criteria);
      expect(result.breakdown.yearScore).toBe(15);
      expect(result.breakdown.priceScore).toBe(15);
      expect(result.totalScore).toBe(100);
    });

    it('should produce a low/zero match when conditions are not met', () => {
      const criteria = {
        makes: ['Toyota'],
        models: ['Corolla'],
        minYear: 2020,
        maxYear: 2022,
        minBudgetZar: 400000,
        maxBudgetZar: 500000,
        colors: ['White'],
        transmissions: ['Automatic'],
        fuelTypes: ['Petrol'],
        maxMileageKm: 60000,
        mustHave: ['Sport Pack'],
      };

      const car: Partial<CarType> = {
        make: 'Ford',
        model: 'Fiesta',
        year: 2010,
        price: 900000,
        color: 'Blue',
        transmission: 'manual',
        fuelType: 'Diesel',
        kilometers: 200000,
        notes: '',
      };

      const result = calculateMatchScore(car, criteria);
      expect(result.totalScore).toBe(0);
      expect(result.quality).toBe('fair');
      expect(result.breakdown).toEqual({
        makeScore: 0,
        modelScore: 0,
        yearScore: 0,
        priceScore: 0,
        colorScore: 0,
        otherScore: 0,
      });
    });

    it('should handle missing car fields (penalize criteria that cannot be verified)', () => {
      const criteria = {
        makes: ['Toyota'],
        models: ['Corolla'],
        minYear: 2020,
        maxBudgetZar: 500000,
        colors: ['White'],
      };

      const car: Partial<CarType> = {
        make: 'Toyota',
        model: 'Corolla',
        color: 'White',
      };

      const result = calculateMatchScore(car, criteria);
      expect(result.breakdown.makeScore).toBe(25);
      expect(result.breakdown.modelScore).toBe(25);
      expect(result.breakdown.colorScore).toBe(10);
      expect(result.breakdown.yearScore).toBe(0);
      expect(result.breakdown.priceScore).toBe(0);
      expect(result.breakdown.otherScore).toBe(10);
      expect(result.totalScore).toBe(70);
    });

    it('should match mustHave terms with punctuation-insensitive text normalization', () => {
      const criteria = {
        mustHave: ['4MATIC'],
      };

      const car: Partial<CarType> = {
        make: 'Mercedes-Benz',
        model: 'GLC',
        year: 2019,
        price: 600000,
        notes: '4-MATIC AWD',
      };

      const result = calculateMatchScore(car, criteria);
      expect(result.breakdown.otherScore).toBe(10);
      expect(result.totalScore).toBe(100);
    });

    it('should proportionally score OTHER criteria and round to 1 decimal', () => {
      const criteria = {
        transmissions: ['Automatic'],
        fuelTypes: ['Diesel'],
      };

      const car: Partial<CarType> = {
        make: 'Toyota',
        model: 'Hilux',
        year: 2022,
        price: 650000,
        transmission: 'automatic',
        fuelType: 'Petrol',
      };

      const result = calculateMatchScore(car, criteria);
      expect(result.breakdown.otherScore).toBe(5);
      expect(result.totalScore).toBe(95);
    });
  });

  describe('matchClientToInventory (engine threshold + edge handling)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create matches only for cars scoring >= 70', async () => {
      const requestDoc: any = {
        _id: 'req1',
        status: 'active',
        createdByPhone: '123',
        filters: {
          makes: ['Toyota'],
          models: ['Corolla'],
          minYear: 2020,
          maxYear: 2022,
          minBudgetZar: 400000,
          maxBudgetZar: 500000,
          colors: ['White'],
          transmissions: ['Automatic'],
          fuelTypes: ['Petrol'],
          maxMileageKm: 60000,
        },
        aiParsing: {},
        save: jest.fn(async () => requestDoc),
      };

      (ClientRequest.findById as jest.Mock).mockResolvedValue(requestDoc);

      const goodCar = {
        _id: 'car1',
        make: 'Toyota',
        model: 'Corolla',
        year: 2021,
        price: 450000,
        color: 'White',
        transmission: 'automatic',
        fuelType: 'Petrol',
        mileage: 50000,
        status: 'in-stock',
        images: [{ imageUrl: 'https://example.com/car1.jpg' }],
      };

      const badCar = {
        _id: 'car2',
        make: 'Ford',
        model: 'Fiesta',
        year: 2010,
        price: 900000,
        color: 'Blue',
        transmission: 'manual',
        fuelType: 'Diesel',
        kilometers: 200000,
        status: 'in-stock',
        images: ['https://example.com/car2.jpg'],
      };

      const mockFindChain = {
        populate: jest.fn().mockResolvedValue([goodCar, badCar]),
      };
      (CarModel.find as jest.Mock).mockReturnValue(mockFindChain);

      (VehicleMatch.findOneAndUpdate as jest.Mock).mockImplementation(async (_filter: any, update: any) => {
        return { _id: 'match1', ...update };
      });

      const matches = await matchClientToInventory('req1');

      expect(matches).toHaveLength(1);
      expect(CarModel.find).toHaveBeenCalledWith({
        status: { $in: ['in-stock', 'coming', 'In-Stock', 'Coming'] },
      });

      expect(VehicleMatch.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect((VehicleMatch.findOneAndUpdate as jest.Mock).mock.calls[0][0]).toEqual({
        request: 'req1',
        car: 'car1',
      });

      const updatePayload = (VehicleMatch.findOneAndUpdate as jest.Mock).mock.calls[0][1];
      expect(updatePayload.createdByPhone).toBe('123');
      expect(updatePayload.score).toBe(100);
      expect(updatePayload.carSnapshot.imageUrl).toBe('https://example.com/car1.jpg');

      expect(requestDoc.save).toHaveBeenCalledTimes(1);
      expect(requestDoc.aiParsing.matchCount).toBe(1);
      expect(requestDoc.aiParsing.lastMatchedAt).toBeInstanceOf(Date);
    });

    it('should map mileage to kilometers for scoring', async () => {
      const requestDoc: any = {
        _id: 'req2',
        status: 'active',
        createdByPhone: '123',
        filters: {
          makes: ['Toyota'],
          maxMileageKm: 60000,
        },
        aiParsing: {},
        save: jest.fn(async () => requestDoc),
      };

      (ClientRequest.findById as jest.Mock).mockResolvedValue(requestDoc);

      const carWithMileage = {
        _id: 'car3',
        make: 'Toyota',
        model: 'Corolla',
        year: 2021,
        price: 450000,
        color: 'White',
        transmission: 'automatic',
        fuelType: 'Petrol',
        mileage: 50000,
        status: 'in-stock',
        images: [],
      };

      const mockFindChain = {
        populate: jest.fn().mockResolvedValue([carWithMileage]),
      };
      (CarModel.find as jest.Mock).mockReturnValue(mockFindChain);

      (VehicleMatch.findOneAndUpdate as jest.Mock).mockResolvedValue({ _id: 'match2' });

      const matches = await matchClientToInventory('req2');

      expect(matches).toHaveLength(1);
      const updatePayload = (VehicleMatch.findOneAndUpdate as jest.Mock).mock.calls[0][1];
      expect(updatePayload.score).toBeGreaterThanOrEqual(70);
    });
  });
});
