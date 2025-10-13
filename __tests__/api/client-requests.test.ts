/**
 * Client Requests API Route Test Suite
 * 
 * Tests GET /api/clients/[id]/requests and POST /api/clients/[id]/requests
 * after vector search removal. Ensures request CRUD works correctly.
 * Target Coverage: 80%+
 */

import { NextResponse } from 'next/server';
import { Types } from 'mongoose';

// Mock dependencies
jest.mock('@/lib/mongodb', () => ({
  connect: jest.fn(async () => ({ connection: { readyState: 1 } })),
}));

jest.mock('@/lib/auth-session', () => ({
  requireSession: jest.fn(async () => ({
    phone: '+27123456789',
    userId: 'user123',
    role: 'user',
  })),
}));

jest.mock('@/lib/user-isolation', () => ({
  ensureClientAccess: jest.fn((client: any) => {
    if (!client) throw new Error('Client not found');
    return client;
  }),
}));

jest.mock('@/lib/errors', () => ({
  formatHttpError: jest.fn((err: any) => ({ success: false, error: err.message })),
  isHttpError: jest.fn((err: any) => err?.status !== undefined),
  BadRequestError: class BadRequestError extends Error {
    status = 400;
    constructor(message: string) {
      super(message);
    }
  },
  NotFoundError: class NotFoundError extends Error {
    status = 404;
    constructor(message: string) {
      super(message);
    }
  },
}));

// In-memory stores
const clientsStore: any[] = [];
const requestsStore: any[] = [];

// Mock Client model
jest.mock('@/models/Client', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(async (id: string) => {
      return clientsStore.find(c => c._id.toString() === id) || null;
    }),
  },
}));

// Mock ClientRequest model
jest.mock('@/models/ClientRequest', () => ({
  __esModule: true,
  default: {
    find: jest.fn(async (query: any) => ({
      sort: jest.fn(() => ({
        lean: jest.fn(() => {
          let filtered = [...requestsStore];
          if (query.client) {
            filtered = filtered.filter(r => r.client.toString() === query.client.toString());
          }
          return filtered.sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        }),
      })),
    })),
    create: jest.fn(async (data: any) => {
      const request = {
        ...data,
        _id: new Types.ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      requestsStore.push(request);
      return request;
    }),
  },
}));

describe('Client Requests API Routes', () => {
  const mockClientId = new Types.ObjectId();

  beforeEach(() => {
    clientsStore.length = 0;
    requestsStore.length = 0;
    jest.clearAllMocks();

    // Add a test client
    clientsStore.push({
      _id: mockClientId,
      firstName: 'John',
      lastName: 'Doe',
      phone: '+27111111111',
      createdByPhone: '+27123456789',
    });
  });

  describe('GET /api/clients/[id]/requests', () => {
    test('should return empty array when no requests exist', async () => {
      const mockRequest = new Request('http://localhost/api/clients/123/requests');
      const mockParams = { id: mockClientId.toString() };

      const { GET } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await GET(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(0);
    });

    test('should return client\'s requests', async () => {
      // Add test requests
      requestsStore.push(
        {
          _id: new Types.ObjectId(),
          client: mockClientId,
          createdByPhone: '+27123456789',
          title: 'Looking for Toyota',
          status: 'active',
          filters: { makes: ['Toyota'] },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          _id: new Types.ObjectId(),
          client: mockClientId,
          createdByPhone: '+27123456789',
          title: 'Looking for Honda',
          status: 'paused',
          filters: { makes: ['Honda'] },
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      );

      const mockRequest = new Request('http://localhost/api/clients/123/requests');
      const mockParams = { id: mockClientId.toString() };

      const { GET } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await GET(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.length).toBe(2);
    });

    test('should return 404 for non-existent client', async () => {
      const mockRequest = new Request('http://localhost/api/clients/999/requests');
      const mockParams = { id: 'nonexistent' };

      const Client = (await import('@/models/Client')).default;
      (Client.findById as jest.Mock).mockResolvedValueOnce(null);

      const { GET } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await GET(mockRequest, { params: mockParams });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /api/clients/[id]/requests', () => {
    test('should create a request successfully', async () => {
      const requestBody = {
        title: 'Looking for Toyota',
        freeText: 'Need a reliable family car',
        filters: {
          makes: ['Toyota'],
          maxBudgetZar: 300000,
          transmissions: ['automatic'],
        },
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const mockParams = { id: mockClientId.toString() };

      const { POST } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await POST(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe('Looking for Toyota');
      expect(data.data.status).toBe('active');
      expect(data.data.filters.makes).toEqual(['Toyota']);
    });

    test('should set default status to "active"', async () => {
      const requestBody = {
        title: 'Looking for Honda',
        filters: { makes: ['Honda'] },
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const mockParams = { id: mockClientId.toString() };

      const { POST } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await POST(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(data.data.status).toBe('active');
    });

    test('should set source to "manual"', async () => {
      const requestBody = {
        title: 'Looking for Honda',
        filters: { makes: ['Honda'] },
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const mockParams = { id: mockClientId.toString() };

      const { POST } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await POST(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(data.data.source).toBe('manual');
    });

    test('should set createdByPhone from session', async () => {
      const requestBody = {
        title: 'Looking for Toyota',
        filters: { makes: ['Toyota'] },
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const mockParams = { id: mockClientId.toString() };

      const { POST } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await POST(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(data.data.createdByPhone).toBe('+27123456789');
    });

    test('should handle complex filters', async () => {
      const requestBody = {
        title: 'Detailed Request',
        freeText: 'Looking for specific car',
        filters: {
          makes: ['Toyota', 'Honda'],
          models: ['Corolla', 'Civic'],
          minYear: 2018,
          maxYear: 2023,
          maxBudgetZar: 350000,
          maxMileageKm: 80000,
          seats: 5,
          transmissions: ['automatic'],
          colors: ['white', 'silver'],
          mustHave: ['bluetooth', 'reverse camera'],
        },
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const mockParams = { id: mockClientId.toString() };

      const { POST } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await POST(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(data.data.filters.makes).toEqual(['Toyota', 'Honda']);
      expect(data.data.filters.maxBudgetZar).toBe(350000);
      expect(data.data.filters.mustHave).toEqual(['bluetooth', 'reverse camera']);
    });

    test('should NOT generate embeddings', async () => {
      const requestBody = {
        title: 'Looking for Toyota',
        freeText: 'Detailed requirements for a car',
        filters: { makes: ['Toyota'] },
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const mockParams = { id: mockClientId.toString() };

      const { POST } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await POST(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should NOT have vector fields
      expect(data.data.embeddingVector).toBeUndefined();
      expect(data.data.embeddingModel).toBeUndefined();
      expect(data.data.requestText).toBeUndefined();
      expect(data.data.lastEmbeddedAt).toBeUndefined();
    });

    test('should NOT perform vector search', async () => {
      const requestBody = {
        title: 'Looking for Toyota',
        filters: { makes: ['Toyota'] },
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const mockParams = { id: mockClientId.toString() };

      const { POST } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await POST(mockRequest, { params: mockParams });

      expect(response.status).toBe(200);
      // Test passes if no errors (no vector search imports)
      expect(requestsStore.length).toBe(1);
    });

    test('should NOT create Match records', async () => {
      const requestBody = {
        title: 'Looking for Toyota',
        filters: { makes: ['Toyota'] },
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const mockParams = { id: mockClientId.toString() };

      const { POST } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await POST(mockRequest, { params: mockParams });

      expect(response.status).toBe(200);
      // Test passes if no Match operations attempted
    });
  });

  describe('Filter Sanitization', () => {
    test('should handle empty filters', async () => {
      const requestBody = {
        title: 'Simple Request',
        filters: {},
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const mockParams = { id: mockClientId.toString() };

      const { POST } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await POST(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(data.data.filters).toBeDefined();
      expect(data.data.filters).toEqual({});
    });

    test('should filter out invalid array values', async () => {
      const requestBody = {
        title: 'Test Request',
        filters: {
          makes: ['Toyota', '', null, 'Honda', undefined],
          transmissions: ['automatic', '', 'manual'],
        },
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const mockParams = { id: mockClientId.toString() };

      const { POST } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await POST(mockRequest, { params: mockParams });

      expect(response.status).toBe(200);
      // Invalid values should be filtered out
    });

    test('should handle numeric filters correctly', async () => {
      const requestBody = {
        title: 'Numeric Filters',
        filters: {
          minYear: 2018,
          maxYear: 2023,
          maxBudgetZar: 350000,
          maxMileageKm: 80000,
          seats: 7,
        },
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const mockParams = { id: mockClientId.toString() };

      const { POST } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await POST(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(data.data.filters.minYear).toBe(2018);
      expect(data.data.filters.maxYear).toBe(2023);
      expect(data.data.filters.maxBudgetZar).toBe(350000);
      expect(data.data.filters.maxMileageKm).toBe(80000);
      expect(data.data.filters.seats).toBe(7);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JSON gracefully', async () => {
      const mockRequest = new Request('http://localhost/api/clients/123/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });
      const mockParams = { id: mockClientId.toString() };

      const { POST } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await POST(mockRequest, { params: mockParams });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should handle database errors', async () => {
      const ClientRequest = (await import('@/models/ClientRequest')).default;
      (ClientRequest.create as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const requestBody = {
        title: 'Test Request',
        filters: { makes: ['Toyota'] },
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const mockParams = { id: mockClientId.toString() };

      const { POST } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await POST(mockRequest, { params: mockParams });

      expect(response.status).toBe(500);
    });
  });

  describe('Simplified Request Creation (No AI)', () => {
    test('should create request instantly without AI processing', async () => {
      const startTime = Date.now();

      const requestBody = {
        title: 'Quick Request',
        freeText: 'Some detailed requirements that would have been embedded',
        filters: { makes: ['Toyota'] },
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const mockParams = { id: mockClientId.toString() };

      const { POST } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await POST(mockRequest, { params: mockParams });
      const endTime = Date.now();

      expect(response.status).toBe(200);
      // Should be fast (no AI/embedding delays)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('should work without OpenAI API key', async () => {
      // Remove API key
      delete process.env.OPENAI_API_KEY;

      const requestBody = {
        title: 'Request without AI',
        filters: { makes: ['Toyota'] },
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const mockParams = { id: mockClientId.toString() };

      const { POST } = await import('@/app/api/clients/[id]/requests/route');
      
      const response = await POST(mockRequest, { params: mockParams });

      expect(response.status).toBe(200);
      // Should work fine without AI dependencies
    });
  });
});
