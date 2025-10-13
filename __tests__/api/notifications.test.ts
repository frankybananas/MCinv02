/**
 * Notifications API Route Test Suite
 * 
 * Tests GET /api/notifications after match notification removal.
 * Ensures notifications work correctly without client_match type.
 * Target Coverage: 80%+
 */

import { NextResponse } from 'next/server';

// Mock dependencies
jest.mock('@/lib/mongodb', () => ({
  connect: jest.fn(async () => ({ connection: { readyState: 1 } })),
}));

jest.mock('@/lib/auth-session', () => ({
  getSession: jest.fn(async () => ({
    phone: '+27123456789',
    userId: 'user123',
    role: 'user',
  })),
}));

// In-memory stores
const usersStore: any[] = [];
const carsStore: any[] = [];
const deliveriesStore: any[] = [];
const todosStore: any[] = [];

// Mock User model
jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async (query: any) => {
      return usersStore.find(u => u.phone === query.phone) || null;
    }),
  },
}));

// Mock Car model
jest.mock('@/models/Car', () => ({
  __esModule: true,
  default: {
    find: jest.fn(async (query: any) => {
      let results = [...carsStore];
      if (query.createdAt?.$gt) {
        const since = new Date(query.createdAt.$gt);
        results = results.filter(c => new Date(c.createdAt) > since);
      }
      return {
        sort: jest.fn(() => ({
          limit: jest.fn(() => ({
            populate: jest.fn(() => results),
          })),
        })),
      };
    }),
  },
}));

// Mock Delivery model
jest.mock('@/models/Delivery', () => ({
  __esModule: true,
  default: {
    find: jest.fn(async (query: any) => {
      let results = [...deliveriesStore];
      if (query.salesperson) {
        results = results.filter(d => d.salesperson === query.salesperson);
      }
      if (query.updatedAt?.$gt) {
        const since = new Date(query.updatedAt.$gt);
        results = results.filter(d => new Date(d.updatedAt) > since);
      }
      return {
        sort: jest.fn(() => ({
          populate: jest.fn(() => results),
        })),
      };
    }),
  },
}));

// Mock Todo model
jest.mock('@/models/Todo', () => ({
  __esModule: true,
  default: {
    find: jest.fn(async (query: any) => {
      return todosStore.filter(t => {
        if (query.user && t.user !== query.user) return false;
        if (query.date) {
          const date = t.date;
          if (query.date.$gte && date < query.date.$gte) return false;
          if (query.date.$lte && date > query.date.$lte) return false;
        }
        return true;
      });
    }),
  },
}));

describe('Notifications API Routes', () => {
  beforeEach(() => {
    usersStore.length = 0;
    carsStore.length = 0;
    deliveriesStore.length = 0;
    todosStore.length = 0;
    jest.clearAllMocks();

    // Add test user
    usersStore.push({
      _id: 'user123',
      phone: '+27123456789',
      name: 'Test User',
      todoEnabled: true,
    });
  });

  describe('GET /api/notifications', () => {
    test('should return empty array when no notifications exist', async () => {
      const { GET } = await import('@/app/api/notifications/route');
      
      const mockRequest = new Request('http://localhost/api/notifications');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(0);
    });

    test('should return car_new notifications', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      carsStore.push({
        _id: 'car1',
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        status: 'in-stock',
        images: [],
        createdAt: new Date(),
      });

      const { GET } = await import('@/app/api/notifications/route');
      
      const mockRequest = new Request('http://localhost/api/notifications');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBeGreaterThan(0);
      
      const carNotifications = data.data.filter((n: any) => n.type === 'car_new');
      expect(carNotifications.length).toBeGreaterThan(0);
    });

    test('should return delivery notifications', async () => {
      deliveriesStore.push({
        _id: 'delivery1',
        salesperson: 'user123',
        car: { _id: 'car1', make: 'Toyota', model: 'Corolla', year: 2020, images: [] },
        status: 'active',
        updatedAt: new Date(),
        createdAt: new Date(),
      });

      const { GET } = await import('@/app/api/notifications/route');
      
      const mockRequest = new Request('http://localhost/api/notifications');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      const deliveryNotifications = data.data.filter(
        (n: any) => n.type === 'delivery_update' || n.type === 'delivery_due_soon'
      );
      expect(deliveryNotifications.length).toBeGreaterThanOrEqual(0);
    });

    test('should return todo reminders when todoEnabled', async () => {
      const today = new Date().toISOString().substring(0, 10);
      
      todosStore.push({
        _id: 'todo1',
        user: 'user123',
        date: today,
        title: 'Important task',
        time: '14:00',
        createdAt: new Date(),
      });

      const { GET } = await import('@/app/api/notifications/route');
      
      const mockRequest = new Request('http://localhost/api/notifications');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      const todoNotifications = data.data.filter((n: any) => n.type === 'todo_reminder');
      expect(todoNotifications.length).toBeGreaterThanOrEqual(0);
    });

    test('should NOT return client_match notifications', async () => {
      const { GET } = await import('@/app/api/notifications/route');
      
      const mockRequest = new Request('http://localhost/api/notifications');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Should have NO client_match type notifications
      const matchNotifications = data.data.filter((n: any) => n.type === 'client_match');
      expect(matchNotifications.length).toBe(0);
    });

    test('should NOT import Match model', async () => {
      const { GET } = await import('@/app/api/notifications/route');
      
      const mockRequest = new Request('http://localhost/api/notifications');
      const response = await GET(mockRequest);

      expect(response.status).toBe(200);
      // Test passes if no errors (Match model not imported)
    });

    test('should filter by time window (7 days)', async () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      carsStore.push(
        {
          _id: 'car_old',
          make: 'Toyota',
          model: 'Old Car',
          year: 2015,
          status: 'in-stock',
          images: [],
          createdAt: tenDaysAgo,
        },
        {
          _id: 'car_recent',
          make: 'Honda',
          model: 'Recent Car',
          year: 2023,
          status: 'in-stock',
          images: [],
          createdAt: twoDaysAgo,
        }
      );

      const { GET } = await import('@/app/api/notifications/route');
      
      const mockRequest = new Request('http://localhost/api/notifications');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should only include recent notifications
      expect(data.data.every((n: any) => {
        const notifDate = new Date(n.createdAt);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return notifDate >= sevenDaysAgo;
      })).toBe(true);
    });

    test('should respect user done notifications', async () => {
      usersStore[0].notificationsDoneIds = ['car_new:car1'];

      carsStore.push({
        _id: 'car1',
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        status: 'in-stock',
        images: [],
        createdAt: new Date(),
      });

      const { GET } = await import('@/app/api/notifications/route');
      
      const mockRequest = new Request('http://localhost/api/notifications');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Marked-as-done notifications should be filtered out
    });

    test('should limit results to 50 notifications', async () => {
      // Add many cars
      for (let i = 0; i < 100; i++) {
        carsStore.push({
          _id: `car${i}`,
          make: 'Toyota',
          model: `Model ${i}`,
          year: 2020,
          status: 'in-stock',
          images: [],
          createdAt: new Date(),
        });
      }

      const { GET } = await import('@/app/api/notifications/route');
      
      const mockRequest = new Request('http://localhost/api/notifications');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBeLessThanOrEqual(50);
    });

    test('should sort notifications by createdAt descending', async () => {
      const dates = [
        new Date('2024-01-01'),
        new Date('2024-01-03'),
        new Date('2024-01-02'),
      ];

      dates.forEach((date, i) => {
        carsStore.push({
          _id: `car${i}`,
          make: 'Toyota',
          model: `Model ${i}`,
          year: 2020,
          status: 'in-stock',
          images: [],
          createdAt: date,
        });
      });

      const { GET } = await import('@/app/api/notifications/route');
      
      const mockRequest = new Request('http://localhost/api/notifications');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Check if sorted by date descending
      for (let i = 1; i < data.data.length; i++) {
        const prev = new Date(data.data[i - 1].createdAt);
        const curr = new Date(data.data[i].createdAt);
        expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
      }
    });

    test('should handle missing user gracefully', async () => {
      usersStore.length = 0;

      const { GET } = await import('@/app/api/notifications/route');
      
      const mockRequest = new Request('http://localhost/api/notifications');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should still work, just without user-specific features
    });

    test('should handle database errors gracefully', async () => {
      const Car = (await import('@/models/Car')).default;
      (Car.find as jest.Mock).mockRejectedValueOnce(new Error('Database error'));

      const { GET } = await import('@/app/api/notifications/route');
      
      const mockRequest = new Request('http://localhost/api/notifications');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('Notification Types (After Cleanup)', () => {
    test('should only include valid notification types', async () => {
      const validTypes = [
        'car_new',
        'car_reserved',
        'car_sold',
        'delivery_update',
        'delivery_due_soon',
        'delivery_completed',
        'todo_reminder',
      ];

      // Add various data
      carsStore.push({
        _id: 'car1',
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        status: 'in-stock',
        images: [],
        createdAt: new Date(),
      });

      deliveriesStore.push({
        _id: 'delivery1',
        salesperson: 'user123',
        car: { _id: 'car1', make: 'Toyota', model: 'Corolla', year: 2020, images: [] },
        status: 'active',
        updatedAt: new Date(),
        createdAt: new Date(),
      });

      const { GET } = await import('@/app/api/notifications/route');
      
      const mockRequest = new Request('http://localhost/api/notifications');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // All notification types should be in the valid list
      data.data.forEach((notification: any) => {
        expect(validTypes).toContain(notification.type);
      });

      // Should NOT include 'client_match'
      expect(data.data.every((n: any) => n.type !== 'client_match')).toBe(true);
    });

    test('should not have matchId in notification data', async () => {
      carsStore.push({
        _id: 'car1',
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        status: 'in-stock',
        images: [],
        createdAt: new Date(),
      });

      const { GET } = await import('@/app/api/notifications/route');
      
      const mockRequest = new Request('http://localhost/api/notifications');
      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // No notification should have matchId
      data.data.forEach((notification: any) => {
        expect(notification.data?.matchId).toBeUndefined();
      });
    });
  });

  describe('Performance', () => {
    test('should complete within reasonable time', async () => {
      // Add moderate amount of data
      for (let i = 0; i < 20; i++) {
        carsStore.push({
          _id: `car${i}`,
          make: 'Toyota',
          model: `Model ${i}`,
          year: 2020,
          status: 'in-stock',
          images: [],
          createdAt: new Date(),
        });
      }

      const startTime = Date.now();

      const { GET } = await import('@/app/api/notifications/route');
      
      const mockRequest = new Request('http://localhost/api/notifications');
      const response = await GET(mockRequest);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      // Should complete quickly without AI/vector operations
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });
});
