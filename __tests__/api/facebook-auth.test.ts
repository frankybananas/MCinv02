import { NextRequest } from 'next/server';
import { GET as statusGet } from '@/app/api/facebook/auth/status/route';
import { DELETE as disconnectHandler } from '@/app/api/facebook/auth/disconnect/route';
import { connect as connectDb } from '@/lib/mongodb';
import User from '@/models/User';
import FacebookAuth from '@/models/FacebookAuth';
import { encryptToken } from '@/lib/encryption';

// Mock dependencies
jest.mock('@/lib/auth-session');
jest.mock('@/lib/mongodb');
jest.mock('@/models/User');
jest.mock('@/models/FacebookAuth');
jest.mock('@/lib/encryption');

const mockRequireSession = require('@/lib/auth-session').requireSession;
const mockConnectDb = connectDb as jest.MockedFunction<typeof connectDb>;
const mockEncryptToken = encryptToken as jest.MockedFunction<typeof encryptToken>;

// Helper creators to avoid constructing NextRequest directly in tests
const createStatusRequest = (): NextRequest => {
  const req = new Request('http://localhost:3000/api/facebook/auth/status');
  return req as unknown as NextRequest;
};

const createDisconnectRequest = (): NextRequest => {
  const req = new Request('http://localhost:3000/api/facebook/auth/disconnect', {
    method: 'POST',
  });
  return req as unknown as NextRequest;
};

describe('Facebook Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectDb.mockResolvedValue(undefined as any);
    mockEncryptToken.mockReturnValue('encrypted_token');
  });

  describe('GET /api/facebook/auth/status', () => {
    it('should return not connected when user has no Facebook connection', async () => {
      mockRequireSession.mockResolvedValue({ phone: '+27824544656' });
      
      const mockUser = {
        _id: 'user123',
        phone: '+27824544656',
        facebookConnected: false
      };
      
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);

      const request = createStatusRequest();
      const response = await statusGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.connected).toBe(false);
      expect(data.accountType).toBeNull();
    });

    it('should return connected status with details', async () => {
      mockRequireSession.mockResolvedValue({ phone: '+27824544656' });
      
      const mockUser = {
        _id: 'user123',
        phone: '+27824544656',
        facebookConnected: true,
        facebookLastSyncedAt: new Date('2025-11-13')
      };
      
      const mockFbAuth = {
        userId: 'user123',
        accountType: 'business_page',
        facebookPageName: 'Test Page',
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000),
        grantedPermissions: ['pages_manage_posts']
      };
      
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (FacebookAuth.findOne as jest.Mock).mockResolvedValue(mockFbAuth);

      const request = createStatusRequest();
      const response = await statusGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.connected).toBe(true);
      expect(data.accountType).toBe('business_page');
      expect(data.facebookPageName).toBe('Test Page');
      expect(data.isExpired).toBe(false);
    });

    it('should detect expired tokens', async () => {
      mockRequireSession.mockResolvedValue({ phone: '+27824544656' });
      
      const mockUser = {
        _id: 'user123',
        phone: '+27824544656',
        facebookConnected: true,
        facebookLastSyncedAt: new Date('2025-11-13')
      };
      
      const mockFbAuth = {
        userId: 'user123',
        accountType: 'personal',
        isActive: true,
        expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
        grantedPermissions: ['public_profile']
      };
      
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (FacebookAuth.findOne as jest.Mock).mockResolvedValue(mockFbAuth);

      const request = createStatusRequest();
      const response = await statusGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.connected).toBe(true);
      expect(data.isExpired).toBe(true);
    });

    it('should return 404 when user not found', async () => {
      mockRequireSession.mockResolvedValue({ phone: '+27824544656' });
      (User.findOne as jest.Mock).mockResolvedValue(null);

      const request = createStatusRequest();
      const response = await statusGet(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should update user status if auth not found', async () => {
      mockRequireSession.mockResolvedValue({ phone: '+27824544656' });
      
      const mockUser = {
        _id: 'user123',
        phone: '+27824544656',
        facebookConnected: true,
        save: jest.fn()
      };
      
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (FacebookAuth.findOne as jest.Mock).mockResolvedValue(null);

      const request = createStatusRequest();
      const response = await statusGet(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.connected).toBe(false);
      expect(mockUser.facebookConnected).toBe(false);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should handle authentication errors', async () => {
      mockRequireSession.mockRejectedValue(new Error('Unauthorized'));

      const request = createStatusRequest();
      const response = await statusGet(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to check Facebook status');
    });
  });

  describe('POST /api/facebook/auth/disconnect', () => {
    it('should successfully disconnect Facebook account', async () => {
      mockRequireSession.mockResolvedValue({ phone: '+27824544656' });
      
      const mockUser = {
        _id: 'user123',
        phone: '+27824544656',
        facebookConnected: true,
        facebookAccountType: 'business_page',
        save: jest.fn()
      };
      
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (FacebookAuth.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });

      const request = createDisconnectRequest();
      const response = await disconnectHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Facebook account disconnected successfully');
      expect(mockUser.facebookConnected).toBe(false);
      expect(mockUser.facebookAccountType).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(FacebookAuth.deleteOne).toHaveBeenCalledWith({ userId: 'user123' });
    });

    it('should return 404 when user not found', async () => {
      mockRequireSession.mockResolvedValue({ phone: '+27824544656' });
      (User.findOne as jest.Mock).mockResolvedValue(null);

      const request = createDisconnectRequest();
      const response = await disconnectPost(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should handle database errors gracefully', async () => {
      mockRequireSession.mockResolvedValue({ phone: '+27824544656' });
      
      const mockUser = {
        _id: 'user123',
        phone: '+27824544656',
        save: jest.fn()
      };
      
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);
      (FacebookAuth.deleteOne as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createDisconnectRequest();
      const response = await disconnectPost(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to disconnect Facebook account');
    });

    it('should handle authentication errors', async () => {
      mockRequireSession.mockRejectedValue(new Error('Unauthorized'));

      const request = createDisconnectRequest();
      const response = await disconnectPost(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to disconnect Facebook account');
    });
  });

  describe('OAuth Flow Integration', () => {
    it('should maintain consistent state through connect-disconnect cycle', async () => {
      mockRequireSession.mockResolvedValue({ phone: '+27824544656' });
      
      const mockUser = {
        _id: 'user123',
        phone: '+27824544656',
        facebookConnected: false,
        save: jest.fn()
      };
      
      // Initial status - not connected
      (User.findOne as jest.Mock).mockResolvedValue(mockUser);

      // Initial status - not connected
      const statusRequest = createStatusRequest();
      const statusResponse = await statusGet(statusRequest);
      const statusData = await statusResponse.json();
      
      expect(statusData.connected).toBe(false);
      
      // After disconnect
      mockUser.facebookConnected = true;
      (FacebookAuth.deleteOne as jest.Mock).mockResolvedValue({ deletedCount: 1 });
      
      const disconnectRequest = createDisconnectRequest();
      const disconnectResponse = await disconnectHandler(disconnectRequest);
      const disconnectData = await disconnectResponse.json();
      
      expect(disconnectData.success).toBe(true);
      expect(mockUser.facebookConnected).toBe(false);
    });
  });
});
