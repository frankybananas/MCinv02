/**
 * ClientRequest Model Test Suite
 * 
 * Tests the ClientRequest model after removal of vector search fields.
 * Ensures model validation, creation, status management work correctly.
 * Target Coverage: 80%+
 */

import mongoose from 'mongoose';

// Mock MongoDB connection
jest.mock('@/lib/mongodb', () => ({
  connectToDatabase: jest.fn(async () => ({ connection: { readyState: 1 } })),
  connect: jest.fn(async () => ({ connection: { readyState: 1 } })),
}));

// Import ClientRequest model
let ClientRequest: any;

describe('ClientRequest Model', () => {
  const mockClientId = new mongoose.Types.ObjectId();

  beforeAll(() => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
  });

  beforeEach(async () => {
    jest.resetModules();
    ClientRequest = (await import('@/models/ClientRequest')).default;
    
    if (ClientRequest.collection) {
      await ClientRequest.deleteMany({});
    }
  });

  afterEach(async () => {
    if (ClientRequest.collection) {
      await ClientRequest.deleteMany({});
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  describe('Schema Validation', () => {
    test('should create a valid client request with required fields', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        title: 'Looking for Toyota',
        freeText: 'Need a reliable family car',
        status: 'active',
        filters: {
          makes: ['Toyota'],
          maxBudgetZar: 300000,
        },
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest._id).toBeDefined();
      expect(savedRequest.client.toString()).toBe(mockClientId.toString());
      expect(savedRequest.createdByPhone).toBe('+27123456789');
      expect(savedRequest.title).toBe('Looking for Toyota');
      expect(savedRequest.status).toBe('active');
      expect(savedRequest.filters.makes).toEqual(['Toyota']);
      expect(savedRequest.filters.maxBudgetZar).toBe(300000);
    });

    test('should fail validation without required client field', async () => {
      const requestData = {
        createdByPhone: '+27123456789',
        filters: {},
      };

      const request = new ClientRequest(requestData);
      
      await expect(request.save()).rejects.toThrow();
    });

    test('should fail validation without required createdByPhone field', async () => {
      const requestData = {
        client: mockClientId,
        filters: {},
      };

      const request = new ClientRequest(requestData);
      
      await expect(request.save()).rejects.toThrow();
    });

    test('should default status to "active"', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.status).toBe('active');
    });

    test('should default source to "manual"', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.source).toBe('manual');
    });

    test('should default priority to 0', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.priority).toBe(0);
    });
  });

  describe('Status Management', () => {
    test('should accept valid status "active"', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        status: 'active',
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.status).toBe('active');
    });

    test('should accept valid status "paused"', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        status: 'paused',
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.status).toBe('paused');
    });

    test('should accept valid status "completed"', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        status: 'completed',
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.status).toBe('completed');
    });

    test('should allow status updates', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.status).toBe('active');

      savedRequest.status = 'paused';
      const updatedRequest = await savedRequest.save();

      expect(updatedRequest.status).toBe('paused');
    });
  });

  describe('Source Tracking', () => {
    test('should accept source "notes"', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        source: 'notes',
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.source).toBe('notes');
    });

    test('should accept source "manual"', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        source: 'manual',
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.source).toBe('manual');
    });

    test('should accept source "imported"', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        source: 'imported',
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.source).toBe('imported');
    });
  });

  describe('Filter Fields', () => {
    test('should handle makes filter', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {
          makes: ['Toyota', 'Honda', 'Ford'],
        },
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.filters.makes).toEqual(['Toyota', 'Honda', 'Ford']);
    });

    test('should handle models filter', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {
          models: ['Corolla', 'Civic'],
        },
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.filters.models).toEqual(['Corolla', 'Civic']);
    });

    test('should handle year range filters', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {
          minYear: 2018,
          maxYear: 2023,
        },
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.filters.minYear).toBe(2018);
      expect(savedRequest.filters.maxYear).toBe(2023);
    });

    test('should handle budget range filters', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {
          minBudgetZar: 200000,
          maxBudgetZar: 350000,
        },
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.filters.minBudgetZar).toBe(200000);
      expect(savedRequest.filters.maxBudgetZar).toBe(350000);
    });

    test('should handle mileage filter', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {
          maxMileageKm: 80000,
        },
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.filters.maxMileageKm).toBe(80000);
    });

    test('should handle seats filter', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {
          seats: 7,
        },
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.filters.seats).toBe(7);
    });

    test('should handle transmissions filter', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {
          transmissions: ['automatic', 'cvt'],
        },
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.filters.transmissions).toEqual(['automatic', 'cvt']);
    });

    test('should handle colors filter', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {
          colors: ['white', 'silver', 'black'],
        },
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.filters.colors).toEqual(['white', 'silver', 'black']);
    });

    test('should handle mustHave features', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {
          mustHave: ['bluetooth', 'reverse camera', 'cruise control'],
        },
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.filters.mustHave).toEqual(['bluetooth', 'reverse camera', 'cruise control']);
    });

    test('should handle niceToHave features', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {
          niceToHave: ['leather seats', 'sunroof'],
        },
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.filters.niceToHave).toEqual(['leather seats', 'sunroof']);
    });

    test('should handle excludeTerms', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {
          excludeTerms: ['accident', 'damaged'],
        },
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.filters.excludeTerms).toEqual(['accident', 'damaged']);
    });
  });

  describe('Vector Search Fields Removal', () => {
    test('should NOT have requestText field in schema', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        requestText: 'Should be ignored', // Attempting to set removed field
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      // Field should not exist
      expect((savedRequest as any).requestText).toBeUndefined();
    });

    test('should NOT have embeddingVector field in schema', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        embeddingVector: [0.1, 0.2, 0.3], // Attempting to set removed field
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      // Field should not exist
      expect((savedRequest as any).embeddingVector).toBeUndefined();
    });

    test('should NOT have embeddingModel field in schema', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        embeddingModel: 'text-embedding-3-small', // Attempting to set removed field
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      // Field should not exist
      expect((savedRequest as any).embeddingModel).toBeUndefined();
    });

    test('should NOT have lastEmbeddedAt field in schema', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        lastEmbeddedAt: new Date(), // Attempting to set removed field
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      // Field should not exist
      expect((savedRequest as any).lastEmbeddedAt).toBeUndefined();
    });
  });

  describe('Timestamps', () => {
    test('should automatically set createdAt and updatedAt', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.createdAt).toBeDefined();
      expect(savedRequest.updatedAt).toBeDefined();
      expect(savedRequest.createdAt instanceof Date).toBe(true);
      expect(savedRequest.updatedAt instanceof Date).toBe(true);
    });

    test('should update updatedAt on save', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();
      const originalUpdatedAt = savedRequest.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      savedRequest.status = 'paused';
      await savedRequest.save();

      expect(savedRequest.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Optional Fields', () => {
    test('should handle optional title field', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        title: 'Looking for SUV',
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.title).toBe('Looking for SUV');
    });

    test('should handle optional freeText field', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        freeText: 'Need a family car with good fuel economy',
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.freeText).toBe('Need a family car with good fuel economy');
    });

    test('should handle optional priority field', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        priority: 5,
        filters: {},
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.priority).toBe(5);
    });
  });

  describe('Complex Filter Combinations', () => {
    test('should handle multiple filters together', async () => {
      const requestData = {
        client: mockClientId,
        createdByPhone: '+27123456789',
        title: 'Complete Request',
        freeText: 'Looking for a complete vehicle',
        filters: {
          makes: ['Toyota', 'Honda'],
          models: ['Corolla', 'Civic'],
          minYear: 2018,
          maxYear: 2023,
          maxMileageKm: 80000,
          minBudgetZar: 200000,
          maxBudgetZar: 350000,
          seats: 5,
          transmissions: ['automatic'],
          colors: ['white', 'silver'],
          mustHave: ['bluetooth', 'reverse camera'],
          niceToHave: ['sunroof'],
          excludeTerms: ['accident'],
        },
      };

      const request = new ClientRequest(requestData);
      const savedRequest = await request.save();

      expect(savedRequest.filters.makes).toEqual(['Toyota', 'Honda']);
      expect(savedRequest.filters.minYear).toBe(2018);
      expect(savedRequest.filters.maxBudgetZar).toBe(350000);
      expect(savedRequest.filters.mustHave).toContain('bluetooth');
    });
  });
});
