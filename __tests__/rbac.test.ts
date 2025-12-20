let mockHeaderRole = 'user';

jest.mock('@/lib/mongodb', () => ({
  connect: jest.fn(async () => ({})),
  connectToDatabase: jest.fn(async () => ({})),
}));

jest.mock('@/lib/auth-session', () => ({
  requireSession: jest.fn(),
  verifyActiveSession: jest.fn(async () => {}),
}));

jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn((key: string) => {
      if (key === 'x-user-role') return mockHeaderRole;
      return null;
    }),
  }),
}));

const mockUsers = [{ _id: 'u1', phone: '+27821234567' }];

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    find: jest.fn(() => ({
      sort: jest.fn().mockResolvedValue(mockUsers),
    })),
    findOne: jest.fn(async () => ({ _id: '65123456789abc0011223344' })),
  },
}));

const mockDeliveries = [{ _id: 'd1' }];

jest.mock('@/models/Delivery', () => ({
  __esModule: true,
  default: {
    find: jest.fn(() => ({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(mockDeliveries),
    })),
    findOne: jest.fn(() => ({
      lean: jest.fn().mockResolvedValue({ _id: 'd1' }),
    })),
  },
}));

jest.mock('@/models/Client', () => ({ __esModule: true, default: {} }));
jest.mock('@/models/Car', () => ({ __esModule: true, default: {} }));

import { hasPermission, isRoleAtLeast } from '@/lib/rbac';
import { requireSession } from '@/lib/auth-session';
import User from '@/models/User';
import Delivery from '@/models/Delivery';

import { GET as adminUsersGET } from '@/app/api/admin/users/route';
import { GET as deliveriesGET } from '@/app/api/deliveries/route';
import { GET as deliveryByIdGET } from '@/app/api/deliveries/[id]/route';

describe('RBAC - Permission Matrix + Endpoint Enforcement', () => {
  const mockRequireSession = requireSession as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockHeaderRole = 'user';
  });

  describe('permission matrix sanity checks', () => {
    it('should reflect expected high-level permission boundaries', () => {
      expect(hasPermission('admin', 'users:manage')).toBe(true);
      expect(hasPermission('manager', 'users:manage')).toBe(false);

      expect(hasPermission('recon', 'cars:write')).toBe(true);
      expect(hasPermission('user', 'cars:write')).toBe(false);

      expect(isRoleAtLeast('admin', 'manager')).toBe(true);
      expect(isRoleAtLeast('user', 'manager')).toBe(false);
    });
  });

  describe('endpoint enforcement', () => {
    it('should deny non-admin access to GET /api/admin/users', async () => {
      mockRequireSession.mockResolvedValue({ role: 'manager' });

      const request = new Request('http://localhost:3000/api/admin/users', { method: 'GET' });
      const response = await adminUsersGET(request as any);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toContain('Forbidden');
      expect(User.find).not.toHaveBeenCalled();
    });

    it('should allow admin access to GET /api/admin/users', async () => {
      mockRequireSession.mockResolvedValue({ role: 'admin' });

      const request = new Request('http://localhost:3000/api/admin/users', { method: 'GET' });
      const response = await adminUsersGET(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(User.find).toHaveBeenCalledWith({});
    });

    it('should deny user access to GET /api/deliveries?scope=recon', async () => {
      mockHeaderRole = 'user';
      mockRequireSession.mockResolvedValue({
        phone: '+27821234567',
        userId: '65123456789abc0011223344',
        role: 'user',
      });

      const request = new Request('http://localhost:3000/api/deliveries?scope=recon', { method: 'GET' });
      const response = await deliveriesGET(request as any);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toBe('Forbidden');
      expect(Delivery.find).not.toHaveBeenCalled();
    });

    it('should allow recon access to GET /api/deliveries?scope=recon', async () => {
      mockHeaderRole = 'recon';
      mockRequireSession.mockResolvedValue({
        phone: '+27821234567',
        userId: '65123456789abc0011223344',
        role: 'recon',
      });

      const request = new Request('http://localhost:3000/api/deliveries?scope=recon', { method: 'GET' });
      const response = await deliveriesGET(request as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Delivery.find).toHaveBeenCalledWith({
        status: 'active',
        $or: [
          { reconTasks: { $exists: true, $ne: [] } },
          { deliveryDate: { $ne: null } },
        ],
      });
    });

    it('should restrict GET /api/deliveries/[id] to salesperson for non-privileged roles', async () => {
      mockHeaderRole = 'user';
      mockRequireSession.mockResolvedValue({
        phone: '+27821234567',
        userId: '65123456789abc0011223344',
        role: 'user',
      });

      const request = new Request('http://localhost:3000/api/deliveries/d1', { method: 'GET' });
      const response = await deliveryByIdGET(request as any, { params: { id: 'd1' } } as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Delivery.findOne).toHaveBeenCalledWith({ _id: 'd1', salesperson: '65123456789abc0011223344' });
    });

    it('should allow privileged roles to GET /api/deliveries/[id] without salesperson filter', async () => {
      mockHeaderRole = 'manager';
      mockRequireSession.mockResolvedValue({
        phone: '+27821234567',
        userId: '65123456789abc0011223344',
        role: 'manager',
      });

      const request = new Request('http://localhost:3000/api/deliveries/d1', { method: 'GET' });
      const response = await deliveryByIdGET(request as any, { params: { id: 'd1' } } as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(Delivery.findOne).toHaveBeenCalledWith({ _id: 'd1' });
    });
  });
});
