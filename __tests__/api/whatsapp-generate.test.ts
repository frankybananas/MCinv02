/**
 * WhatsApp Generate API Route Test Suite
 * 
 * Tests POST /api/whatsapp/generate endpoint
 * Ensures proper image preparation, validation, and error handling
 * Target Coverage: 80%+
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/whatsapp/generate/route';

// Mock dependencies
jest.mock('@/lib/mongodb', () => ({
  connect: jest.fn(async () => ({ connection: { readyState: 1 } })),
}));

// Mock mongoose Types
jest.mock('mongoose', () => ({
  __esModule: true,
  Types: {
    ObjectId: class MockObjectId {
      constructor(id: string) {
        return id as any;
      }
    }
  }
}));

jest.mock('@/lib/auth-session', () => ({
  requireSession: jest.fn(async () => ({ userId: 'user_123', phone: '+27123456789' })),
}));

// Mock User model
jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findById: jest.fn((id: string) => {
      const user = usersStore.find(u => u._id === id);
      if (!user) return null;
      return {
        select: jest.fn(() => ({
          lean: jest.fn(async () => user)
        }))
      };
    }),
    findOne: jest.fn(async (query: any) => {
      if (query.phone?.$in) {
        return usersStore.find(u => query.phone.$in.includes(u.phone)) || null;
      }
      return null;
    }),
  },
}));

// In-memory stores
const carsStore: any[] = [];
const picturesStore: any[] = [];
const generationsStore: any[] = [];
const usersStore: any[] = [];

// Mock Car model
jest.mock('@/models/Car', () => ({
  __esModule: true,
  default: {
    find: jest.fn((query: any) => {
      let results = carsStore;
      
      // Filter by _id if $in is provided
      if (query._id?.$in) {
        results = results.filter(car => query._id.$in.includes(car._id));
      }
      
      // Filter by images existence
      if (query.images) {
        results = results.filter(car => car.images && car.images.length > 0);
      }
      
      return {
        populate: jest.fn(async () => {
          // Populate images with Picture objects
          return results.map(car => ({
            ...car,
            images: car.images?.map((imgId: string) => 
              picturesStore.find(pic => pic._id === imgId)
            ).filter(Boolean) || []
          }));
        })
      };
    }),
  },
}));

// Mock WhatsAppGeneration model
jest.mock('@/models/WhatsAppGeneration', () => {
  return jest.fn().mockImplementation((data: any) => {
    const generation = {
      ...data,
      _id: `gen_${Date.now()}_${Math.random()}`,
      generatedAt: new Date(),
      save: jest.fn(async function(this: any) {
        generationsStore.push(this);
        return this;
      }),
    };
    return generation;
  });
});

describe('POST /api/whatsapp/generate', () => {
  beforeEach(() => {
    // Clear stores
    carsStore.length = 0;
    picturesStore.length = 0;
    generationsStore.length = 0;
    usersStore.length = 0;
    jest.clearAllMocks();
    
    // Add default test user
    usersStore.push({
      _id: 'user_123',
      phone: '+27123456789',
      profile: {
        firstName: 'John',
        lastName: 'Doe',
      },
    });
  });

  const createMockRequest = (body: any): NextRequest => {
    return {
      json: jest.fn(async () => body),
      headers: new Headers(),
      method: 'POST',
    } as unknown as NextRequest;
  };

  describe('Input Validation', () => {
    it('should reject request with no selectedCarIds', async () => {
      const request = createMockRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No cars selected for generation');
    });

    it('should reject request with empty selectedCarIds array', async () => {
      const request = createMockRequest({ selectedCarIds: [] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No cars selected for generation');
    });

    it('should reject request with non-array selectedCarIds', async () => {
      const request = createMockRequest({ selectedCarIds: 'not-an-array' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No cars selected for generation');
    });

    it('should reject request with null selectedCarIds', async () => {
      const request = createMockRequest({ selectedCarIds: null });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('No cars selected for generation');
    });

    it('should include kilometers when available', async () => {
      // Re-add user since global beforeEach clears it
      if (usersStore.length === 0) {
        usersStore.push({
          _id: 'user_123',
          phone: '+27123456789',
          profile: {
            firstName: 'John',
            lastName: 'Doe',
          },
        });
      }
      
      // picture for car_km
      picturesStore.push({
        _id: 'pic_km',
        imageUrl: 'https://example.com/km.jpg',
        title: 'KM Picture',
        car: 'car_km'
      });

      carsStore.push({
        _id: 'car_km',
        make: 'VW',
        model: 'Golf',
        year: 2022,
        price: 350000,
        kilometers: 18000,
        images: ['pic_km']
      });

      const request = createMockRequest({ selectedCarIds: ['car_km'] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cars[0].kilometers).toBe(18000);
    });
  });

  describe('Car Validation', () => {
    it('should return 404 when no cars match the provided IDs', async () => {
      const request = createMockRequest({ selectedCarIds: ['car_nonexistent'] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No valid cars found for generation');
    });

    it('should return 404 when cars exist but have no images', async () => {
      // Add car without images
      carsStore.push({
        _id: 'car_1',
        make: 'BMW',
        model: 'M3',
        year: 2024,
        price: 1899000,
        images: []
      });

      const request = createMockRequest({ selectedCarIds: ['car_1'] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No valid cars found for generation');
    });

    it('should return 404 when cars have images but they are not populated correctly', async () => {
      // Add car with image reference but no actual picture
      carsStore.push({
        _id: 'car_2',
        make: 'BMW',
        model: 'M3',
        year: 2024,
        price: 1899000,
        images: ['pic_nonexistent']
      });

      const request = createMockRequest({ selectedCarIds: ['car_2'] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No cars with valid images found for generation');
    });
  });

  describe('Successful Generation Preparation', () => {
    beforeEach(() => {
      // Re-add user since global beforeEach clears it
      if (usersStore.length === 0) {
        usersStore.push({
          _id: 'user_123',
          phone: '+27123456789',
          profile: {
            firstName: 'John',
            lastName: 'Doe',
          },
        });
      }
      
      // Add valid picture
      picturesStore.push({
        _id: 'pic_1',
        imageUrl: 'https://example.com/car1.jpg',
        title: 'Car Image 1',
        car: 'car_1'
      });

      // Add valid car with image
      carsStore.push({
        _id: 'car_1',
        make: 'BMW',
        model: 'M3 Competition',
        year: 2024,
        price: 1899000,
        images: ['pic_1']
      });
    });

    it('should successfully prepare generation for valid car', async () => {
      const request = createMockRequest({ selectedCarIds: ['car_1'] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.generationId).toBeDefined();
      expect(data.cars).toHaveLength(1);
      expect(data.cars[0]).toMatchObject({
        id: 'car_1',
        make: 'BMW',
        model: 'M3 Competition',
        year: 2024,
        price: 1899000,
        coverImage: 'https://example.com/car1.jpg'
      });
    });

    it('should create WhatsAppGeneration record', async () => {
      const request = createMockRequest({ selectedCarIds: ['car_1'] });
      await POST(request);

      expect(generationsStore).toHaveLength(1);
      expect(generationsStore[0]).toMatchObject({
        user: 'user_123',
        carCount: 1,
        carIds: ['car_1'],
        status: 'pending'
      });
    });

    it('should handle multiple cars successfully', async () => {
      // Add more pictures and cars
      picturesStore.push({
        _id: 'pic_2',
        imageUrl: 'https://example.com/car2.jpg',
        title: 'Car Image 2',
        car: 'car_2'
      });

      picturesStore.push({
        _id: 'pic_3',
        imageUrl: 'https://example.com/car3.jpg',
        title: 'Car Image 3',
        car: 'car_3'
      });

      carsStore.push({
        _id: 'car_2',
        make: 'Mercedes',
        model: 'C63 AMG',
        year: 2023,
        price: 1500000,
        images: ['pic_2']
      });

      carsStore.push({
        _id: 'car_3',
        make: 'Audi',
        model: 'RS6',
        year: 2024,
        price: 2100000,
        images: ['pic_3']
      });

      const request = createMockRequest({ selectedCarIds: ['car_1', 'car_2', 'car_3'] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.cars).toHaveLength(3);
      expect(generationsStore[0].carCount).toBe(3);
      expect(generationsStore[0].carIds).toEqual(['car_1', 'car_2', 'car_3']);
    });

    it('should filter out cars without valid images from mixed selection', async () => {
      // Add car without images
      carsStore.push({
        _id: 'car_no_images',
        make: 'Toyota',
        model: 'Corolla',
        year: 2023,
        price: 350000,
        images: []
      });

      const request = createMockRequest({ selectedCarIds: ['car_1', 'car_no_images'] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.cars).toHaveLength(1);
      expect(data.cars[0].id).toBe('car_1');
      expect(generationsStore[0].carCount).toBe(1);
    });

    it('should handle car with multiple images and use first one', async () => {
      // Add multiple pictures for same car
      picturesStore.push({
        _id: 'pic_4',
        imageUrl: 'https://example.com/car4-image1.jpg',
        title: 'Car 4 Image 1',
        car: 'car_4'
      });

      picturesStore.push({
        _id: 'pic_5',
        imageUrl: 'https://example.com/car4-image2.jpg',
        title: 'Car 4 Image 2',
        car: 'car_4'
      });

      carsStore.push({
        _id: 'car_4',
        make: 'Porsche',
        model: '911 Turbo',
        year: 2024,
        price: 3500000,
        images: ['pic_4', 'pic_5']
      });

      const request = createMockRequest({ selectedCarIds: ['car_4'] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cars[0].coverImage).toBe('https://example.com/car4-image1.jpg');
    });
  });

  describe('Edge Cases', () => {
    it('should handle car with image that has no imageUrl', async () => {
      picturesStore.push({
        _id: 'pic_invalid',
        title: 'Invalid Picture',
        car: 'car_invalid'
        // Missing imageUrl
      });

      carsStore.push({
        _id: 'car_invalid',
        make: 'Test',
        model: 'Car',
        year: 2024,
        price: 100000,
        images: ['pic_invalid']
      });

      const request = createMockRequest({ selectedCarIds: ['car_invalid'] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No cars with valid images found for generation');
    });

    it('should handle empty string imageUrl', async () => {
      picturesStore.push({
        _id: 'pic_empty',
        imageUrl: '',
        title: 'Empty URL Picture',
        car: 'car_empty'
      });

      carsStore.push({
        _id: 'car_empty',
        make: 'Test',
        model: 'Car',
        year: 2024,
        price: 100000,
        images: ['pic_empty']
      });

      const request = createMockRequest({ selectedCarIds: ['car_empty'] });
      const response = await POST(request);
      const data = await response.json();

      // Should still succeed but with empty coverImage
      expect(response.status).toBe(200);
      expect(data.cars[0].coverImage).toBe('');
    });

    it('should handle duplicate car IDs in request', async () => {
      picturesStore.push({
        _id: 'pic_dup',
        imageUrl: 'https://example.com/dup.jpg',
        title: 'Dup Picture',
        car: 'car_dup'
      });

      carsStore.push({
        _id: 'car_dup',
        make: 'BMW',
        model: 'X5',
        year: 2024,
        price: 1200000,
        images: ['pic_dup']
      });

      const request = createMockRequest({ selectedCarIds: ['car_dup', 'car_dup', 'car_dup'] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should only return unique cars
      expect(data.cars).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      const { connect } = require('@/lib/mongodb');
      connect.mockRejectedValueOnce(new Error('Database connection failed'));

      const request = createMockRequest({ selectedCarIds: ['car_1'] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to prepare image generation');
    });

    it('should handle authentication errors', async () => {
      const { requireSession } = require('@/lib/auth-session');
      requireSession.mockRejectedValueOnce(new Error('Unauthorized'));

      const request = createMockRequest({ selectedCarIds: ['car_1'] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to prepare image generation');
    });

    it('should handle WhatsAppGeneration save errors', async () => {
      picturesStore.push({
        _id: 'pic_save_error',
        imageUrl: 'https://example.com/error.jpg',
        title: 'Error Picture',
        car: 'car_save_error'
      });

      carsStore.push({
        _id: 'car_save_error',
        make: 'Test',
        model: 'Error',
        year: 2024,
        price: 100000,
        images: ['pic_save_error']
      });

      // Mock save to throw error
      const WhatsAppGeneration = require('@/models/WhatsAppGeneration');
      WhatsAppGeneration.mockImplementationOnce((data: any) => ({
        ...data,
        _id: 'gen_error',
        save: jest.fn(async () => {
          throw new Error('Database save failed');
        })
      }));

      const request = createMockRequest({ selectedCarIds: ['car_save_error'] });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to prepare image generation');
    });

    it('should handle malformed JSON in request body', async () => {
      const request = {
        json: jest.fn(async () => {
          throw new Error('Invalid JSON');
        }),
        headers: new Headers(),
        method: 'POST',
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to prepare image generation');
    });
  });

  describe('Response Format', () => {
    beforeEach(() => {
      // Re-add user since global beforeEach clears it
      if (usersStore.length === 0) {
        usersStore.push({
          _id: 'user_123',
          phone: '+27123456789',
          profile: {
            firstName: 'John',
            lastName: 'Doe',
          },
        });
      }
      
      picturesStore.push({
        _id: 'pic_format',
        imageUrl: 'https://example.com/format.jpg',
        title: 'Format Picture',
        car: 'car_format'
      });

      carsStore.push({
        _id: 'car_format',
        make: 'BMW',
        model: 'M5',
        year: 2024,
        price: 2200000,
        images: ['pic_format']
      });
    });

    it('should return correct response structure', async () => {
      const request = createMockRequest({ selectedCarIds: ['car_format'] });
      const response = await POST(request);
      const data = await response.json();

      // Debug: log the response if it's an error
      if (data.error) {
        console.log('API Error:', data.error, 'Status:', response.status);
      }

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('generationId');
      expect(data).toHaveProperty('cars');
      expect(data).toHaveProperty('user');
      expect(Array.isArray(data.cars)).toBe(true);
    });

    it('should return car data with all required fields', async () => {
      const request = createMockRequest({ selectedCarIds: ['car_format'] });
      const response = await POST(request);
      const data = await response.json();

      const car = data.cars[0];
      expect(car).toHaveProperty('id');
      expect(car).toHaveProperty('make');
      expect(car).toHaveProperty('model');
      expect(car).toHaveProperty('year');
      expect(car).toHaveProperty('price');
      expect(car).toHaveProperty('coverImage');
    });

    it('should return car data with correct types', async () => {
      const request = createMockRequest({ selectedCarIds: ['car_format'] });
      const response = await POST(request);
      const data = await response.json();

      const car = data.cars[0];
      expect(typeof car.id).toBe('string');
      expect(typeof car.make).toBe('string');
      expect(typeof car.model).toBe('string');
      expect(typeof car.year).toBe('number');
      expect(typeof car.price).toBe('number');
      expect(typeof car.coverImage).toBe('string');
    });

    it('should include user information in response', async () => {
      const request = createMockRequest({ selectedCarIds: ['car_format'] });
      const response = await POST(request);
      const data = await response.json();

      expect(data.user).toBeDefined();
      expect(data.user).toHaveProperty('name');
      expect(data.user).toHaveProperty('phone');
      expect(typeof data.user.name).toBe('string');
      expect(typeof data.user.phone).toBe('string');
    });

    it('should format user name correctly when both first and last name exist', async () => {
      const request = createMockRequest({ selectedCarIds: ['car_format'] });
      const response = await POST(request);
      const data = await response.json();

      expect(data.user.name).toBe('John Doe');
    });

    it('should use firstName only when lastName is missing', async () => {
      usersStore[0].profile.lastName = undefined;
      
      const request = createMockRequest({ selectedCarIds: ['car_format'] });
      const response = await POST(request);
      const data = await response.json();

      expect(data.user.name).toBe('John');
    });

    it('should use lastName only when firstName is missing', async () => {
      usersStore[0].profile.firstName = undefined;
      usersStore[0].profile.lastName = 'Doe';
      
      const request = createMockRequest({ selectedCarIds: ['car_format'] });
      const response = await POST(request);
      const data = await response.json();

      expect(data.user.name).toBe('Doe');
    });

    it('should use "Sales" as default when no name is available', async () => {
      usersStore[0].profile = {};
      
      const request = createMockRequest({ selectedCarIds: ['car_format'] });
      const response = await POST(request);
      const data = await response.json();

      expect(data.user.name).toBe('Sales');
    });

    it('should include phone number in response', async () => {
      const request = createMockRequest({ selectedCarIds: ['car_format'] });
      const response = await POST(request);
      const data = await response.json();

      expect(data.user.phone).toBe('+27123456789');
    });
  });
});
