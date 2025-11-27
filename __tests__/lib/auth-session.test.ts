/**
 * Auth Session Library Test Suite
 * Tests session management utilities with mocked jose
 */

import { jwtVerify } from 'jose';
import { getSession, requireSession, isPrivileged, getRateLimitIdentity, verifyActiveSession } from '@/lib/auth-session';
import { UnauthorizedError } from '@/lib/errors';

const mockJwtVerify = jwtVerify as jest.Mock;

describe('Auth Session Library', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createRequest(token?: string): Request {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['cookie'] = `session_token=${token}`;
    return new Request('http://localhost:3000/api/test', { headers });
  }

  describe('getSession', () => {
    it('should extract session with all fields', async () => {
      mockJwtVerify.mockResolvedValueOnce({
        payload: { phone: '+27123456789', userId: 'user123', role: 'user', lastOtpAt: Date.now() },
      });
      const session = await getSession(createRequest('valid-token'));
      expect(session).not.toBeNull();
      expect(session?.phone).toBe('+27123456789');
    });

    it('should return null when no token is present', async () => {
      const session = await getSession(createRequest());
      expect(session).toBeNull();
    });
  });

  describe('requireSession', () => {
    it('should return session when valid', async () => {
      mockJwtVerify.mockResolvedValueOnce({
        payload: { phone: '+27123456789', userId: 'user123', role: 'user' },
      });
      const session = await requireSession(createRequest('valid-token'));
      expect(session.phone).toBe('+27123456789');
    });

    it('should throw UnauthorizedError when no token', async () => {
      await expect(requireSession(createRequest())).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('isPrivileged', () => {
    it('should return true for admin', async () => {
      mockJwtVerify.mockResolvedValueOnce({
        payload: { phone: '+27123456789', role: 'admin' },
      });
      const session = await getSession(createRequest('valid-token'));
      expect(isPrivileged(session)).toBe(true);
    });

    it('should return false for user', async () => {
      mockJwtVerify.mockResolvedValueOnce({
        payload: { phone: '+27123456789', role: 'user' },
      });
      const session = await getSession(createRequest('valid-token'));
      expect(isPrivileged(session)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isPrivileged(null)).toBe(false);
    });
  });

  describe('verifyActiveSession', () => {
    it('should skip DB check in test env', async () => {
      mockJwtVerify.mockResolvedValueOnce({
        payload: { phone: '+27123456789', role: 'user', jti: 'test-jti' },
      });
      const session = await getSession(createRequest('valid-token'));
      await expect(verifyActiveSession(session!)).resolves.not.toThrow();
    });
  });
});
