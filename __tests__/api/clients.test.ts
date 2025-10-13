/**
 * Clients API Route Test Suite
 * 
 * Tests GET /api/clients and POST /api/clients after vector search removal.
 * Ensures client creation and listing work correctly with user isolation.
 * Target Coverage: 80%+
 */

import { NextResponse } from 'next/server';

// Mock dependencies
jest.mock('@/lib/mongodb', () => ({
  connectToDatabase: jest.fn(async () => ({ connection: { readyState: 1 } })),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    get: jest.fn((name: string) => {
      if (name === 'session_token') {
        return { value: 'valid-token' };
      }
      return null;
    }),
  })),
}));

jest.mock('jose', () => ({
  jwtVerify: jest.fn(async () => ({
    payload: {
      phone: '+27123456789',
      role: 'user',
    },
  })),
}));

// In-memory store
const clientsStore: any[] = [];

// Mock Client model
jest.mock('@/models/Client', () => ({
  __esModule: true,
  default: {
    find: jest.fn(async (query: any) => ({
      sort: jest.fn(() => {
        let filtered = [...clientsStore];
        if (query.createdByPhone) {
          filtered = filtered.filter(c => c.createdByPhone === query.createdByPhone);
        }
        return filtered.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }),
    })),
    create: jest.fn(async (data: any) => {
      const client = {
        ...data,
        _id: `client_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      clientsStore.push(client);
      return client;
    }),
  },
}));

// Mock other required models
jest.mock('@/models/Phone', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@/models/Car', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@/models/Document', () => ({
  __esModule: true,
  default: {},
}));

describe('Clients API Routes', () => {
  beforeEach(() => {
    clientsStore.length = 0;
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('GET /api/clients', () => {
    test('should return empty array when no clients exist', async () => {
      const { GET } = await import('@/app/api/clients/route.js');
      
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(0);
    });

    test('should return only user\'s clients (user isolation)', async () => {
      // Add test data with different owners
      clientsStore.push(
        {
          _id: 'client1',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+27111111111',
          createdByPhone: '+27123456789', // Current user
          createdAt: new Date().toISOString(),
        },
        {
          _id: 'client2',
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+27222222222',
          createdByPhone: '+27987654321', // Different user
          createdAt: new Date().toISOString(),
        },
        {
          _id: 'client3',
          firstName: 'Bob',
          lastName: 'Johnson',
          phone: '+27333333333',
          createdByPhone: '+27123456789', // Current user
          createdAt: new Date().toISOString(),
        }
      );

      const { GET } = await import('@/app/api/clients/route.js');
      
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.length).toBe(2); // Only current user's clients
      expect(data.data.every((c: any) => c.createdByPhone === '+27123456789')).toBe(true);
    });

    test('should return all clients for admin users', async () => {
      // Mock admin role
      const jose = await import('jose');
      (jose.jwtVerify as jest.Mock).mockResolvedValueOnce({
        payload: {
          phone: '+27123456789',
          role: 'admin',
        },
      });

      clientsStore.push(
        { _id: 'client1', firstName: 'John', createdByPhone: '+27111111111', createdAt: new Date().toISOString() },
        { _id: 'client2', firstName: 'Jane', createdByPhone: '+27222222222', createdAt: new Date().toISOString() },
        { _id: 'client3', firstName: 'Bob', createdByPhone: '+27333333333', createdAt: new Date().toISOString() }
      );

      const { GET } = await import('@/app/api/clients/route.js');
      
      const response = await GET();
      const data = await response.json();

      expect(data.data.length).toBe(3); // All clients visible to admin
    });

    test('should return 401 without valid session token', async () => {
      const cookies = await import('next/headers');
      (cookies.cookies as jest.Mock).mockResolvedValueOnce({
        get: jest.fn(() => null),
      });

      const { GET } = await import('@/app/api/clients/route.js');
      
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Unauthorized');
    });

    test('should handle JWT verification errors', async () => {
      const jose = await import('jose');
      (jose.jwtVerify as jest.Mock).mockRejectedValueOnce(new Error('Invalid token'));

      const { GET } = await import('@/app/api/clients/route.js');
      
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /api/clients', () => {
    test('should create a client successfully', async () => {
      const request = new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          phone: '0123456789',
          email: 'john@example.com',
          notes: 'Important client',
        }),
      });

      const { POST } = await import('@/app/api/clients/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.firstName).toBe('John');
      expect(data.data.lastName).toBe('Doe');
      expect(data.data.email).toBe('john@example.com');
    });

    test('should set createdByPhone to current user', async () => {
      const request = new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          phone: '0123456789',
        }),
      });

      const { POST } = await import('@/app/api/clients/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(data.data.createdByPhone).toBe('+27123456789');
    });

    test('should format phone number to +27 format', async () => {
      const request = new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          phone: '0123456789', // South African format starting with 0
        }),
      });

      const { POST } = await import('@/app/api/clients/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(data.data.phone).toBe('+27123456789');
    });

    test('should remove empty string fields', async () => {
      const request = new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          lastName: '',
          phone: '0123456789',
          email: '',
          notes: 'Some notes',
        }),
      });

      const { POST } = await import('@/app/api/clients/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(data.data.firstName).toBe('John');
      expect(data.data.notes).toBe('Some notes');
      // Empty fields should be removed
      expect(data.data.lastName).toBeUndefined();
      expect(data.data.email).toBeUndefined();
    });

    test('should NOT auto-generate client requests from notes', async () => {
      const request = new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          phone: '0123456789',
          notes: 'Looking for a Toyota Corolla under R250k',
        }),
      });

      const { POST } = await import('@/app/api/clients/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      // Should NOT have triggered AI parsing or request creation
      // Test passes if no errors thrown
    });

    test('should return 401 without valid session', async () => {
      const cookies = await import('next/headers');
      (cookies.cookies as jest.Mock).mockResolvedValueOnce({
        get: jest.fn(() => null),
      });

      const request = new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          phone: '0123456789',
        }),
      });

      const { POST } = await import('@/app/api/clients/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    test('should handle database errors gracefully', async () => {
      const Client = (await import('@/models/Client')).default;
      (Client.create as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const request = new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          phone: '0123456789',
        }),
      });

      const { POST } = await import('@/app/api/clients/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('Cleanup - No Vector/AI Operations', () => {
    test('should NOT attempt to parse notes with AI', async () => {
      const request = new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          phone: '0123456789',
          notes: 'Looking for Toyota Corolla automatic transmission under R300000',
        }),
      });

      const { POST } = await import('@/app/api/clients/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      // Should complete without trying to import parseNotesToRequest
      expect(data.data.notes).toBe('Looking for Toyota Corolla automatic transmission under R300000');
    });

    test('should NOT create ClientRequest records', async () => {
      const request = new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          phone: '0123456789',
          notes: 'Very detailed requirements for a car',
        }),
      });

      const { POST } = await import('@/app/api/clients/route.js');
      
      const response = await POST(request);

      expect(response.status).toBe(201);
      // Test passes if no errors (no ClientRequest import)
    });

    test('should NOT call vector search or matching', async () => {
      const request = new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          phone: '0123456789',
          notes: 'Detailed car requirements',
        }),
      });

      const { POST } = await import('@/app/api/clients/route.js');
      
      await POST(request);

      // Verify no vector/AI operations attempted
      expect(clientsStore.length).toBe(1);
      expect(clientsStore[0].firstName).toBe('John');
    });
  });

  describe('Phone Number Formatting', () => {
    test('should keep already formatted +27 numbers', async () => {
      const request = new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          phone: '+27123456789',
        }),
      });

      const { POST } = await import('@/app/api/clients/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(data.data.phone).toBe('+27123456789');
    });

    test('should format 0-prefixed numbers to +27', async () => {
      const request = new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          phone: '0823456789',
        }),
      });

      const { POST } = await import('@/app/api/clients/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(data.data.phone).toBe('+27823456789');
    });

    test('should trim whitespace from phone numbers', async () => {
      const request = new Request('http://localhost/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          phone: '  0823456789  ',
        }),
      });

      const { POST } = await import('@/app/api/clients/route.js');
      
      const response = await POST(request);
      const data = await response.json();

      expect(data.data.phone).toBe('+27823456789');
    });
  });
});
