/**
 * Admin Users API Route Test Suite
 * 
 * Tests GET, POST, PATCH, and DELETE /api/admin/users
 * Ensures user management, role updates, and feature toggles work correctly.
 * Target Coverage: 80%+
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock dependencies
jest.mock('@/lib/mongodb', () => ({
  connect: jest.fn(async () => ({ connection: { readyState: 1 } })),
}));

// In-memory user store
const usersStore: any[] = [];
let userIdCounter = 1;

// Mock User model
const mockUserModel = {
  find: jest.fn(() => ({
    sort: jest.fn(() => Promise.resolve(usersStore)),
  })),
    findOne: jest.fn(async (query: any) => {
      return usersStore.find(u => u.phone === query.phone);
    }),
    findById: jest.fn(async (id: string) => {
      return usersStore.find(u => u._id === id);
    }),
    findByIdAndUpdate: jest.fn(async (id: string, update: any, options: any) => {
      const userIndex = usersStore.findIndex(u => u._id === id);
      if (userIndex === -1) return null;
      
      const user = usersStore[userIndex];
      if (update.$set) {
        Object.keys(update.$set).forEach(key => {
          if (key.includes('.')) {
            const [parent, child] = key.split('.');
            if (!user[parent]) user[parent] = {};
            user[parent][child] = update.$set[key];
          } else {
            user[key] = update.$set[key];
          }
        });
      }
      return user;
    }),
    findByIdAndDelete: jest.fn(async (id: string) => {
      const userIndex = usersStore.findIndex(u => u._id === id);
      if (userIndex === -1) return null;
      const deleted = usersStore[userIndex];
      usersStore.splice(userIndex, 1);
      return deleted;
    }),
  };

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: mockUserModel,
}));

// Import route handlers after mocks
import { GET, POST, PATCH, DELETE } from '@/app/api/admin/users/route';

describe('Admin Users API Routes', () => {
  beforeEach(() => {
    // Clear store
    usersStore.length = 0;
    userIdCounter = 1;
    
    // Add test users
    usersStore.push({
      _id: 'user1',
      phone: '+1234567890',
      profile: { firstName: 'John', lastName: 'Doe' },
      department: 'new',
      role: 'user',
      isAuthorized: true,
      matchingEnabled: true,
      todoEnabled: false,
      marketingEnabled: false,
      createdAt: new Date('2024-01-01'),
    });
    usersStore.push({
      _id: 'user2',
      phone: '+0987654321',
      profile: { firstName: 'Jane', lastName: 'Smith' },
      department: 'used',
      role: 'manager',
      isAuthorized: true,
      matchingEnabled: true,
      todoEnabled: true,
      marketingEnabled: false,
      createdAt: new Date('2024-01-02'),
    });
  });

  describe('GET /api/admin/users', () => {
    it('should return all users for admin', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'GET',
        headers: { 'x-user-role': 'admin' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.data[0].phone).toBe('+1234567890');
    });

    it('should return 403 for non-admin users', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'GET',
        headers: { 'x-user-role': 'user' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });

    it('should return 403 when no role header', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'GET',
      });

      const response = await GET(request);
      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/admin/users', () => {
    it('should create a new user with valid data', async () => {
      const newUser = {
        phone: '+1111111111',
        firstName: 'Test',
        lastName: 'User',
        department: 'new',
        role: 'user',
      };

      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify(newUser),
      });

      // Mock User constructor for this test
      const originalMock = mockUserModel;
      const mockSave = jest.fn(async function(this: any) {
        const user = {
          ...this,
          _id: `user${userIdCounter++}`,
          createdAt: new Date(),
        };
        usersStore.push(user);
        return user;
      });

      // Override with constructor function
      const MockUserConstructor: any = function(this: any, data: any) {
        Object.assign(this, data);
        this.save = mockSave;
      };
      Object.assign(MockUserConstructor, originalMock);
      jest.spyOn(require('@/models/User'), 'default').mockReturnValue(MockUserConstructor as any);
      (require('@/models/User').default as any) = MockUserConstructor;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toContain('successfully');
      expect(data.user.phone).toBe(newUser.phone);
    });

    it('should return 400 when required fields are missing', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({ phone: '+1111111111' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('required');
    });

    it('should return 409 when user already exists', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          phone: '+1234567890', // Existing user
          firstName: 'Test',
          lastName: 'User',
          department: 'new',
          role: 'user',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('already exists');
    });

    it('should return 403 for non-admin users', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'user',
        },
        body: JSON.stringify({
          phone: '+1111111111',
          firstName: 'Test',
          lastName: 'User',
          department: 'new',
          role: 'user',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });
  });

  describe('PATCH /api/admin/users', () => {
    it('should update user matchingEnabled flag', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          userId: 'user1',
          matchingEnabled: false,
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.matchingEnabled).toBe(false);
    });

    it('should update user todoEnabled flag', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          userId: 'user1',
          todoEnabled: true,
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.todoEnabled).toBe(true);
    });

    it('should update user marketingEnabled flag', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          userId: 'user1',
          marketingEnabled: true,
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.marketingEnabled).toBe(true);
    });

    it('should update user role', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          userId: 'user1',
          role: 'manager',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.role).toBe('manager');
    });

    it('should update user department', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          userId: 'user1',
          department: 'used',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.department).toBe('used');
    });

    it('should update user profile fields', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          userId: 'user1',
          firstName: 'UpdatedFirst',
          lastName: 'UpdatedLast',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.profile.firstName).toBe('UpdatedFirst');
      expect(data.user.profile.lastName).toBe('UpdatedLast');
    });

    it('should update user phone', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          userId: 'user1',
          phone: '+9999999999',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.phone).toBe('+9999999999');
    });

    it('should return 400 when userId is missing', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          matchingEnabled: false,
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('userId is required');
    });

    it('should return 400 when no updatable fields provided', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          userId: 'user1',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('No updatable fields');
    });

    it('should return 404 when user not found', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin',
        },
        body: JSON.stringify({
          userId: 'nonexistent',
          matchingEnabled: false,
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should return 403 for non-admin users', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'user',
        },
        body: JSON.stringify({
          userId: 'user1',
          matchingEnabled: false,
        }),
      });

      const response = await PATCH(request);
      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /api/admin/users', () => {
    it('should delete a user successfully', async () => {
      const request = new Request('http://localhost:3000/api/admin/users?userId=user1', {
        method: 'DELETE',
        headers: { 'x-user-role': 'admin' },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('deleted successfully');
      expect(usersStore.find(u => u._id === 'user1')).toBeUndefined();
    });

    it('should return 400 when userId is missing', async () => {
      const request = new Request('http://localhost:3000/api/admin/users', {
        method: 'DELETE',
        headers: { 'x-user-role': 'admin' },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('userId is required');
    });

    it('should return 404 when user not found', async () => {
      const request = new Request('http://localhost:3000/api/admin/users?userId=nonexistent', {
        method: 'DELETE',
        headers: { 'x-user-role': 'admin' },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should return 403 for non-admin users', async () => {
      const request = new Request('http://localhost:3000/api/admin/users?userId=user1', {
        method: 'DELETE',
        headers: { 'x-user-role': 'user' },
      });

      const response = await DELETE(request);
      expect(response.status).toBe(403);
    });
  });
});
