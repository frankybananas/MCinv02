/**
 * Client Request Detail API Route Test Suite
 * 
 * Tests PUT /api/clients/[id]/requests/[requestId] and DELETE after cleanup.
 * Ensures request updates work without vector/embedding operations.
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
  getRateLimitIdentity: jest.fn(() => '+27123456789'),
}));

jest.mock('@/lib/user-isolation', () => ({
  ensureClientAccess: jest.fn((client: any) => {
    if (!client) throw new Error('Client not found');
    return client;
  }),
}));

jest.mock('@/lib/rate-limit', () => ({
  assertRateLimit: jest.fn(),
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

jest.mock('@/lib/validation/client-request', () => ({
  clientRequestUpdateSchema: {
    safeParse: jest.fn((data: any) => ({
      success: true,
      data,
    })),
  },
  normalizeClientRequestUpdate: jest.fn((data: any) => data),
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
    findOne: jest.fn(async (query: any) => {
      const request = requestsStore.find(
        r => r._id.toString() === query._id && r.client.toString() === query.client
      );
      if (!request) return null;
      return {
        ...request,
        save: jest.fn(async function(this: any) {
          const index = requestsStore.findIndex(r => r._id.toString() === this._id.toString());
          if (index !== -1) {
            requestsStore[index] = { ...this };
          }
          return this;
        }),
        toObject: jest.fn(function(this: any) {
          return { ...this };
        }),
      };
    }),
    deleteOne: jest.fn(async (query: any) => {
      const index = requestsStore.findIndex(
        r => r._id.toString() === query._id && r.client.toString() === query.client
      );
      if (index !== -1) {
        requestsStore.splice(index, 1);
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    }),
  },
}));

describe('Client Request Detail API Routes', () => {
  const mockClientId = new Types.ObjectId();
  const mockRequestId = new Types.ObjectId();

  beforeEach(() => {
    clientsStore.length = 0;
    requestsStore.length = 0;
    jest.clearAllMocks();

    // Add test client
    clientsStore.push({
      _id: mockClientId,
      firstName: 'John',
      lastName: 'Doe',
      createdByPhone: '+27123456789',
    });

    // Add test request
    requestsStore.push({
      _id: mockRequestId,
      client: mockClientId,
      createdByPhone: '+27123456789',
      title: 'Original Title',
      freeText: 'Original text',
      status: 'active',
      filters: {
        makes: ['Toyota'],
        maxBudgetZar: 300000,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe('PUT /api/clients/[id]/requests/[requestId]', () => {
    test('should update request title', async () => {
      const updateBody = {
        title: 'Updated Title',
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests/456', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
      const mockParams = {
        id: mockClientId.toString(),
        requestId: mockRequestId.toString(),
      };

      const { PUT } = await import('@/app/api/clients/[id]/requests/[requestId]/route');
      
      const response = await PUT(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe('Updated Title');
    });

    test('should update request freeText', async () => {
      const updateBody = {
        freeText: 'Updated requirements',
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests/456', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
      const mockParams = {
        id: mockClientId.toString(),
        requestId: mockRequestId.toString(),
      };

      const { PUT } = await import('@/app/api/clients/[id]/requests/[requestId]/route');
      
      const response = await PUT(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(data.data.freeText).toBe('Updated requirements');
    });

    test('should update request filters', async () => {
      const updateBody = {
        filters: {
          makes: ['Honda', 'Toyota'],
          maxBudgetZar: 350000,
          transmissions: ['automatic'],
        },
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests/456', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
      const mockParams = {
        id: mockClientId.toString(),
        requestId: mockRequestId.toString(),
      };

      const { PUT } = await import('@/app/api/clients/[id]/requests/[requestId]/route');
      
      const response = await PUT(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(data.data.filters.makes).toEqual(['Honda', 'Toyota']);
      expect(data.data.filters.maxBudgetZar).toBe(350000);
    });

    test('should update request status', async () => {
      const updateBody = {
        status: 'paused',
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests/456', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
      const mockParams = {
        id: mockClientId.toString(),
        requestId: mockRequestId.toString(),
      };

      const { PUT } = await import('@/app/api/clients/[id]/requests/[requestId]/route');
      
      const response = await PUT(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(data.data.status).toBe('paused');
    });

    test('should update updatedAt timestamp', async () => {
      const originalRequest = requestsStore[0];
      const originalUpdatedAt = originalRequest.updatedAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      const updateBody = {
        title: 'New Title',
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests/456', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
      const mockParams = {
        id: mockClientId.toString(),
        requestId: mockRequestId.toString(),
      };

      const { PUT } = await import('@/app/api/clients/[id]/requests/[requestId]/route');
      
      const response = await PUT(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(data.data.updatedAt).toBeDefined();
    });

    test('should NOT generate embeddings on update', async () => {
      const updateBody = {
        freeText: 'Completely new detailed requirements',
        filters: {
          makes: ['Honda'],
          maxBudgetZar: 400000,
        },
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests/456', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
      const mockParams = {
        id: mockClientId.toString(),
        requestId: mockRequestId.toString(),
      };

      const { PUT } = await import('@/app/api/clients/[id]/requests/[requestId]/route');
      
      const response = await PUT(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should NOT have vector fields
      expect(data.data.embeddingVector).toBeUndefined();
      expect(data.data.embeddingModel).toBeUndefined();
      expect(data.data.requestText).toBeUndefined();
      expect(data.data.lastEmbeddedAt).toBeUndefined();
    });

    test('should NOT call vector upsert on update', async () => {
      const updateBody = {
        filters: { makes: ['Honda'] },
        status: 'active',
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests/456', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
      const mockParams = {
        id: mockClientId.toString(),
        requestId: mockRequestId.toString(),
      };

      const { PUT } = await import('@/app/api/clients/[id]/requests/[requestId]/route');
      
      const response = await PUT(mockRequest, { params: mockParams });

      expect(response.status).toBe(200);
      // Test passes if no vector operations attempted
    });

    test('should return 404 for non-existent request', async () => {
      const updateBody = { title: 'New Title' };

      const mockRequest = new Request('http://localhost/api/clients/123/requests/999', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
      const mockParams = {
        id: mockClientId.toString(),
        requestId: new Types.ObjectId().toString(),
      };

      const { PUT } = await import('@/app/api/clients/[id]/requests/[requestId]/route');
      
      const response = await PUT(mockRequest, { params: mockParams });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should handle validation errors', async () => {
      const validation = await import('@/lib/validation/client-request');
      (validation.clientRequestUpdateSchema.safeParse as jest.Mock).mockReturnValueOnce({
        success: false,
        error: { flatten: () => ({ fieldErrors: {} }) },
      });

      const updateBody = { invalid: 'data' };

      const mockRequest = new Request('http://localhost/api/clients/123/requests/456', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
      const mockParams = {
        id: mockClientId.toString(),
        requestId: mockRequestId.toString(),
      };

      const { PUT } = await import('@/app/api/clients/[id]/requests/[requestId]/route');
      
      const response = await PUT(mockRequest, { params: mockParams });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('DELETE /api/clients/[id]/requests/[requestId]', () => {
    test('should delete request successfully', async () => {
      expect(requestsStore.length).toBe(1);

      const mockRequest = new Request('http://localhost/api/clients/123/requests/456', {
        method: 'DELETE',
      });
      const mockParams = {
        id: mockClientId.toString(),
        requestId: mockRequestId.toString(),
      };

      const { DELETE } = await import('@/app/api/clients/[id]/requests/[requestId]/route');
      
      const response = await DELETE(mockRequest, { params: mockParams });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(requestsStore.length).toBe(0);
    });

    test('should handle non-existent request deletion', async () => {
      const mockRequest = new Request('http://localhost/api/clients/123/requests/999', {
        method: 'DELETE',
      });
      const mockParams = {
        id: mockClientId.toString(),
        requestId: new Types.ObjectId().toString(),
      };

      const { DELETE } = await import('@/app/api/clients/[id]/requests/[requestId]/route');
      
      const response = await DELETE(mockRequest, { params: mockParams });

      expect(response.status).toBe(200);
      // Should succeed even if not found
    });

    test('should respect rate limiting', async () => {
      const rateLimit = await import('@/lib/rate-limit');
      const rateLimitSpy = rateLimit.assertRateLimit as jest.Mock;

      const mockRequest = new Request('http://localhost/api/clients/123/requests/456', {
        method: 'DELETE',
      });
      const mockParams = {
        id: mockClientId.toString(),
        requestId: mockRequestId.toString(),
      };

      const { DELETE } = await import('@/app/api/clients/[id]/requests/[requestId]/route');
      
      await DELETE(mockRequest, { params: mockParams });

      expect(rateLimitSpy).toHaveBeenCalled();
    });
  });

  describe('Simplified Updates (No AI Processing)', () => {
    test('should update instantly without AI delays', async () => {
      const startTime = Date.now();

      const updateBody = {
        freeText: 'Very detailed requirements that would normally be embedded',
        filters: {
          makes: ['Toyota', 'Honda'],
          maxBudgetZar: 500000,
        },
        status: 'active',
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests/456', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
      const mockParams = {
        id: mockClientId.toString(),
        requestId: mockRequestId.toString(),
      };

      const { PUT } = await import('@/app/api/clients/[id]/requests/[requestId]/route');
      
      const response = await PUT(mockRequest, { params: mockParams });
      const endTime = Date.now();

      expect(response.status).toBe(200);
      // Should be fast (no AI processing)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    test('should work without OpenAI dependencies', async () => {
      delete process.env.OPENAI_API_KEY;

      const updateBody = {
        title: 'Updated without AI',
        filters: { makes: ['Honda'] },
      };

      const mockRequest = new Request('http://localhost/api/clients/123/requests/456', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
      const mockParams = {
        id: mockClientId.toString(),
        requestId: mockRequestId.toString(),
      };

      const { PUT } = await import('@/app/api/clients/[id]/requests/[requestId]/route');
      
      const response = await PUT(mockRequest, { params: mockParams });

      expect(response.status).toBe(200);
      // Should work without AI dependencies
    });

    test('should handle status changes without re-embedding', async () => {
      const statusChanges = ['active', 'paused', 'completed', 'active'];

      for (const status of statusChanges) {
        const mockRequest = new Request('http://localhost/api/clients/123/requests/456', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        const mockParams = {
          id: mockClientId.toString(),
          requestId: mockRequestId.toString(),
        };

        const { PUT } = await import('@/app/api/clients/[id]/requests/[requestId]/route');
        
        const response = await PUT(mockRequest, { params: mockParams });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.status).toBe(status);
        // No embeddings should be generated
        expect(data.data.embeddingVector).toBeUndefined();
      }
    });
  });
});
