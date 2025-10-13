/**
 * Car Model Test Suite
 * 
 * Tests the Car model after removal of vector search fields.
 * Ensures model validation, creation, and updates work correctly.
 * Target Coverage: 80%+
 */

import mongoose from 'mongoose';

// Mock MongoDB connection
jest.mock('@/lib/mongodb', () => ({
  connectToDatabase: jest.fn(async () => ({ connection: { readyState: 1 } })),
  connect: jest.fn(async () => ({ connection: { readyState: 1 } })),
}));

// Import Car model
let Car: any;

describe('Car Model', () => {
  beforeAll(() => {
    // Setup in-memory MongoDB
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
  });

  beforeEach(async () => {
    // Clear all cached modules
    jest.resetModules();
    
    // Re-import Car model
    Car = (await import('@/models/Car.js')).default;
    
    // Clear any existing data
    if (Car.collection) {
      await Car.deleteMany({});
    }
  });

  afterEach(async () => {
    // Clean up after each test
    if (Car.collection) {
      await Car.deleteMany({});
    }
  });

  afterAll(async () => {
    // Close mongoose connection
    await mongoose.disconnect();
  });

  describe('Schema Validation', () => {
    test('should create a valid car with required fields', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
        color: 'White',
        transmission: 'automatic',
        status: 'in-stock',
        kilometers: 50000,
        vin: 'ABC123XYZ456',
        notes: 'Well maintained',
      };

      const car = new Car(carData);
      const savedCar = await car.save();

      expect(savedCar._id).toBeDefined();
      expect(savedCar.make).toBe('Toyota');
      expect(savedCar.model).toBe('Corolla');
      expect(savedCar.year).toBe(2020);
      expect(savedCar.price).toBe(250000);
      expect(savedCar.status).toBe('in-stock');
      expect(savedCar.createdAt).toBeDefined();
      expect(savedCar.updatedAt).toBeDefined();
    });

    test('should fail validation without required make field', async () => {
      const carData = {
        model: 'Corolla',
        year: 2020,
        price: 250000,
      };

      const car = new Car(carData);
      
      await expect(car.save()).rejects.toThrow();
    });

    test('should fail validation without required model field', async () => {
      const carData = {
        make: 'Toyota',
        year: 2020,
        price: 250000,
      };

      const car = new Car(carData);
      
      await expect(car.save()).rejects.toThrow();
    });

    test('should fail validation without required year field', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        price: 250000,
      };

      const car = new Car(carData);
      
      await expect(car.save()).rejects.toThrow();
    });

    test('should fail validation without required price field', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
      };

      const car = new Car(carData);
      
      await expect(car.save()).rejects.toThrow();
    });

    test('should accept valid transmission types', async () => {
      const transmissions = ['manual', 'automatic', 'cvt'];

      for (const transmission of transmissions) {
        const carData = {
          make: 'Toyota',
          model: 'Corolla',
          year: 2020,
          price: 250000,
          transmission,
        };

        const car = new Car(carData);
        const savedCar = await car.save();
        
        expect(savedCar.transmission).toBe(transmission);
        
        await Car.deleteMany({});
      }
    });

    test('should accept valid status types', async () => {
      const statuses = ['in-stock', 'coming', 'reserved', 'sold'];

      for (const status of statuses) {
        const carData = {
          make: 'Toyota',
          model: 'Corolla',
          year: 2020,
          price: 250000,
          status,
        };

        const car = new Car(carData);
        const savedCar = await car.save();
        
        expect(savedCar.status).toBe(status);
        
        await Car.deleteMany({});
      }
    });

    test('should default status to "coming"', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
      };

      const car = new Car(carData);
      const savedCar = await car.save();

      expect(savedCar.status).toBe('coming');
    });

    test('should default demo to false', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
      };

      const car = new Car(carData);
      const savedCar = await car.save();

      expect(savedCar.demo).toBe(false);
    });
  });

  describe('Vector Search Fields Removal', () => {
    test('should NOT have searchText field in schema', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
        searchText: 'Should be ignored', // Attempting to set removed field
      };

      const car = new Car(carData);
      const savedCar = await car.save();

      // Field should not exist
      expect((savedCar as any).searchText).toBeUndefined();
    });

    test('should NOT have embeddingVector field in schema', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
        embeddingVector: [0.1, 0.2, 0.3], // Attempting to set removed field
      };

      const car = new Car(carData);
      const savedCar = await car.save();

      // Field should not exist
      expect((savedCar as any).embeddingVector).toBeUndefined();
    });

    test('should NOT have embeddingModel field in schema', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
        embeddingModel: 'text-embedding-3-small', // Attempting to set removed field
      };

      const car = new Car(carData);
      const savedCar = await car.save();

      // Field should not exist
      expect((savedCar as any).embeddingModel).toBeUndefined();
    });

    test('should NOT have lastEmbeddedAt field in schema', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
        lastEmbeddedAt: new Date(), // Attempting to set removed field
      };

      const car = new Car(carData);
      const savedCar = await car.save();

      // Field should not exist
      expect((savedCar as any).lastEmbeddedAt).toBeUndefined();
    });
  });

  describe('Audit Log', () => {
    test('should initialize with empty audit log', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
      };

      const car = new Car(carData);
      const savedCar = await car.save();

      expect(savedCar.auditLog).toBeDefined();
      expect(Array.isArray(savedCar.auditLog)).toBe(true);
      expect(savedCar.auditLog.length).toBe(0);
    });

    test('should allow adding audit log entries', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
      };

      const car = new Car(carData);
      car.auditLog.push({
        action: 'Car Created',
        user: '+27123456789',
        details: 'Initial creation',
        timestamp: new Date(),
      });

      const savedCar = await car.save();

      expect(savedCar.auditLog.length).toBe(1);
      expect(savedCar.auditLog[0].action).toBe('Car Created');
      expect(savedCar.auditLog[0].user).toBe('+27123456789');
    });
  });

  describe('Updates and Timestamps', () => {
    test('should update updatedAt timestamp on save', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
      };

      const car = new Car(carData);
      const savedCar = await car.save();
      const originalUpdatedAt = savedCar.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      savedCar.price = 260000;
      await savedCar.save();

      expect(savedCar.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    test('should update car fields correctly', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
        kilometers: 50000,
      };

      const car = new Car(carData);
      const savedCar = await car.save();

      savedCar.price = 240000;
      savedCar.kilometers = 55000;
      savedCar.status = 'reserved';

      const updatedCar = await savedCar.save();

      expect(updatedCar.price).toBe(240000);
      expect(updatedCar.kilometers).toBe(55000);
      expect(updatedCar.status).toBe('reserved');
    });
  });

  describe('Optional Fields', () => {
    test('should handle optional description field', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
        description: 'Excellent condition, one owner',
      };

      const car = new Car(carData);
      const savedCar = await car.save();

      expect(savedCar.description).toBe('Excellent condition, one owner');
    });

    test('should handle optional notes field', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
        notes: 'Service history available',
      };

      const car = new Car(carData);
      const savedCar = await car.save();

      expect(savedCar.notes).toBe('Service history available');
    });

    test('should handle optional licensePlate field', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
        licensePlate: 'ABC123GP',
      };

      const car = new Car(carData);
      const savedCar = await car.save();

      expect(savedCar.licensePlate).toBe('ABC123GP');
    });

    test('should handle optional color field', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
        color: 'Silver',
      };

      const car = new Car(carData);
      const savedCar = await car.save();

      expect(savedCar.color).toBe('Silver');
    });
  });

  describe('Image References', () => {
    test('should initialize with empty images array', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
      };

      const car = new Car(carData);
      const savedCar = await car.save();

      expect(savedCar.images).toBeDefined();
      expect(Array.isArray(savedCar.images)).toBe(true);
      expect(savedCar.images.length).toBe(0);
    });

    test('should allow adding image references', async () => {
      const carData = {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        price: 250000,
      };

      const car = new Car(carData);
      const mockImageId = new mongoose.Types.ObjectId();
      car.images.push(mockImageId);

      const savedCar = await car.save();

      expect(savedCar.images.length).toBe(1);
      expect(savedCar.images[0].toString()).toBe(mockImageId.toString());
    });
  });
});
