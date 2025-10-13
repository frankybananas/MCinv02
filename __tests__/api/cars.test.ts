/**
 * Cars API Route Test Suite
 * 
 * Tests GET /api/cars and POST /api/cars after vector search removal.
 * Ensures car creation, listing, and image upload work correctly.
 * Target Coverage: 80%+
 */

import { NextResponse } from 'next/server';

// Mock dependencies
jest.mock('@/lib/mongodb', () => ({
  connectToDatabase: jest.fn(async () => ({ connection: { readyState: 1 } })),
}));

jest.mock('@/lib/s3', () => ({
  s3: {
    send: jest.fn(async () => ({ $metadata: { httpStatusCode: 200 } })),
  },
}));

jest.mock('sharp', () => {
  return jest.fn(() => ({
    rotate: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn(async () => Buffer.from('fake-image-data')),
  }));
});

// In-memory stores
const carsStore: any[] = [];
const picturesStore: any[] = [];

// Mock Car model
jest.mock('@/models/Car.js', () => ({
  __esModule: true,
  default: {
    find: jest.fn(async () => ({
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnValue(
        carsStore.map(car => ({
          ...car,
          toObject: () => car,
        }))
      ),
    })),
    create: jest.fn(async (data: any) => {
      const car = {
        ...data,
        _id: `car_${Date.now()}`,
        images: [],
        auditLog: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn(async function(this: any) {
          carsStore.push(this);
          return this;
        }),
      };
      carsStore.push(car);
      return car;
    }),
    findById: jest.fn(async (id: string) => {
      const car = carsStore.find(c => c._id === id);
      if (!car) return null;
      return {
        ...car,
        populate: jest.fn().mockReturnThis(),
        toObject: jest.fn(() => ({ ...car, virtuals: true })),
      };
    }),
    syncIndexes: jest.fn(async () => {}),
    collection: {
      indexes: jest.fn(async () => []),
    },
  },
}));

// Mock Picture model
jest.mock('@/models/Picture', () => ({
  __esModule: true,
  default: class MockPicture {
    constructor(public data: any) {
      this.data = { ...data, _id: `pic_${Date.now()}_${Math.random()}` };
    }
    async save() {
      picturesStore.push(this.data);
      return this.data;
    }
  },
}));

// Mock headers
jest.mock('next/headers', () => ({
  headers: jest.fn(async () => new Map([
    ['x-user-phone', '+27123456789'],
    ['x-user-name', 'Test User'],
  ])),
}));

describe('Cars API Routes', () => {
  beforeEach(() => {
    carsStore.length = 0;
    picturesStore.length = 0;
    jest.clearAllMocks();
  });

  describe('GET /api/cars', () => {
    test('should return empty array when no cars exist', async () => {
      const { GET } = await import('@/app/api/cars/route.js');
      
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(0);
    });

    test('should return all cars', async () => {
      // Add test data
      carsStore.push(
        {
          _id: 'car1',
          make: 'Toyota',
          model: 'Corolla',
          year: 2020,
          price: 250000,
          status: 'in-stock',
          toObject: function() { return this; },
        },
        {
          _id: 'car2',
          make: 'Honda',
          model: 'Civic',
          year: 2021,
          price: 280000,
          status: 'reserved',
          toObject: function() { return this; },
        }
      );

      const { GET } = await import('@/app/api/cars/route.js');
      
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.length).toBe(2);
      expect(data.data[0].make).toBe('Toyota');
      expect(data.data[1].make).toBe('Honda');
    });

    test('should handle database errors gracefully', async () => {
      const Car = (await import('@/models/Car.js')).default;
      (Car.find as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      const { GET } = await import('@/app/api/cars/route.js');
      
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toContain('Failed to fetch cars');
    });
  });

  describe('POST /api/cars', () => {
    test('should create a car without images', async () => {
      const formData = new FormData();
      formData.append('make', 'Toyota');
      formData.append('model', 'Corolla');
      formData.append('year', '2020');
      formData.append('price', '250000');
      formData.append('kilometers', '50000');
      formData.append('color', 'White');
      formData.append('transmission', 'automatic');
      formData.append('vin', 'ABC123XYZ456');
      formData.append('notes', 'Well maintained');

      const request = new Request('http://localhost/api/cars', {
        method: 'POST',
        body: formData,
      });

      const { POST } = await import('@/app/api/cars/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.make).toBe('Toyota');
      expect(data.data.model).toBe('Corolla');
      expect(data.data.year).toBe(2020);
      expect(data.data.price).toBe(250000);
    });

    test('should NOT create vector search fields', async () => {
      const formData = new FormData();
      formData.append('make', 'Toyota');
      formData.append('model', 'Corolla');
      formData.append('year', '2020');
      formData.append('price', '250000');

      const request = new Request('http://localhost/api/cars', {
        method: 'POST',
        body: formData,
      });

      const { POST } = await import('@/app/api/cars/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.searchText).toBeUndefined();
      expect(data.data.embeddingVector).toBeUndefined();
      expect(data.data.embeddingModel).toBeUndefined();
      expect(data.data.lastEmbeddedAt).toBeUndefined();
    });

    test('should create audit log entry', async () => {
      const formData = new FormData();
      formData.append('make', 'Toyota');
      formData.append('model', 'Corolla');
      formData.append('year', '2020');
      formData.append('price', '250000');

      const request = new Request('http://localhost/api/cars', {
        method: 'POST',
        body: formData,
      });

      const { POST } = await import('@/app/api/cars/route.js');
      
      await POST(request);

      const createdCar = carsStore[0];
      expect(createdCar.auditLog).toBeDefined();
      expect(Array.isArray(createdCar.auditLog)).toBe(true);
    });

    test('should parse numeric fields correctly', async () => {
      const formData = new FormData();
      formData.append('make', 'Toyota');
      formData.append('model', 'Corolla');
      formData.append('year', '2020');
      formData.append('price', '250000');
      formData.append('kilometers', '50000');

      const request = new Request('http://localhost/api/cars', {
        method: 'POST',
        body: formData,
      });

      const { POST } = await import('@/app/api/cars/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(typeof data.data.year).toBe('number');
      expect(typeof data.data.price).toBe('number');
      expect(typeof data.data.kilometers).toBe('number');
      expect(data.data.year).toBe(2020);
      expect(data.data.price).toBe(250000);
      expect(data.data.kilometers).toBe(50000);
    });

    test('should handle form data parsing correctly', async () => {
      const formData = new FormData();
      formData.append('make', 'Toyota');
      formData.append('model', 'Corolla');
      formData.append('year', '2020');
      formData.append('price', '250000');
      formData.append('color', 'White');
      formData.append('transmission', 'automatic');
      formData.append('status', 'in-stock');

      const request = new Request('http://localhost/api/cars', {
        method: 'POST',
        body: formData,
      });

      const { POST } = await import('@/app/api/cars/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(data.data.make).toBe('Toyota');
      expect(data.data.model).toBe('Corolla');
      expect(data.data.color).toBe('White');
      expect(data.data.transmission).toBe('automatic');
      expect(data.data.status).toBe('in-stock');
    });

    test('should handle image uploads', async () => {
      // Create a fake image file
      const imageBlob = new Blob(['fake image data'], { type: 'image/jpeg' });
      const imageFile = new File([imageBlob], 'test.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('make', 'Toyota');
      formData.append('model', 'Corolla');
      formData.append('year', '2020');
      formData.append('price', '250000');
      formData.append('images', imageFile);

      const request = new Request('http://localhost/api/cars', {
        method: 'POST',
        body: formData,
      });

      const { POST } = await import('@/app/api/cars/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      
      // Check that picture was created
      expect(picturesStore.length).toBeGreaterThan(0);
    });

    test('should handle errors gracefully', async () => {
      const Car = (await import('@/models/Car.js')).default;
      (Car.create as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const formData = new FormData();
      formData.append('make', 'Toyota');
      formData.append('model', 'Corolla');
      formData.append('year', '2020');
      formData.append('price', '250000');

      const request = new Request('http://localhost/api/cars', {
        method: 'POST',
        body: formData,
      });

      const { POST } = await import('@/app/api/cars/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    test('should handle invalid numeric fields', async () => {
      const formData = new FormData();
      formData.append('make', 'Toyota');
      formData.append('model', 'Corolla');
      formData.append('year', 'invalid');
      formData.append('price', 'not-a-number');

      const request = new Request('http://localhost/api/cars', {
        method: 'POST',
        body: formData,
      });

      const { POST } = await import('@/app/api/cars/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      // Should still create car, just without the invalid fields
      expect(response.status).toBe(201);
      expect(data.data.make).toBe('Toyota');
      expect(data.data.model).toBe('Corolla');
    });

    test('should filter out empty image files', async () => {
      const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });
      const validFile = new File([new Blob(['data'])], 'valid.jpg', { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('make', 'Toyota');
      formData.append('model', 'Corolla');
      formData.append('year', '2020');
      formData.append('price', '250000');
      formData.append('images', emptyFile);
      formData.append('images', validFile);

      const request = new Request('http://localhost/api/cars', {
        method: 'POST',
        body: formData,
      });

      const { POST } = await import('@/app/api/cars/route.js');
      
      const response = await POST(request);

      expect(response.status).toBe(201);
      // Only one valid image should be processed
      expect(picturesStore.length).toBe(1);
    });
  });

  describe('Cleanup - No Vector/AI Operations', () => {
    test('should NOT call vector search functions', async () => {
      const formData = new FormData();
      formData.append('make', 'Toyota');
      formData.append('model', 'Corolla');
      formData.append('year', '2020');
      formData.append('price', '250000');

      const request = new Request('http://localhost/api/cars', {
        method: 'POST',
        body: formData,
      });

      const { POST } = await import('@/app/api/cars/route.js');
      
      await POST(request);

      // Verify no vector search operations were attempted
      // (Code should complete without trying to import non-existent modules)
      expect(carsStore.length).toBe(1);
      expect(carsStore[0].embeddingVector).toBeUndefined();
    });

    test('should NOT create Match records', async () => {
      const formData = new FormData();
      formData.append('make', 'Toyota');
      formData.append('model', 'Corolla');
      formData.append('year', '2020');
      formData.append('price', '250000');

      const request = new Request('http://localhost/api/cars', {
        method: 'POST',
        body: formData,
      });

      const { POST } = await import('@/app/api/cars/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      // Test passes if no errors thrown (no Match model imported)
      expect(data.success).toBe(true);
    });
  });
});
