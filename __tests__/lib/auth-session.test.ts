/**
 * Auth Session Library Test Suite
 * 
 * Tests session management utilities with 7-day OTP validation
 * Ensures SessionData interface handles lastOtpAt correctly
 * Target Coverage: 80%+
 */

import { SignJWT } from 'jose';
import { TextEncoder } from 'util';
import { getSession, requireSession, isPrivileged, getRateLimitIdentity } from '@/lib/auth-session';
import { UnauthorizedError } from '@/lib/errors';

describe('Auth Session Library - 7-Day Validation', () => {
  const mockEnv = {
    JWT_SECRET: 'test-jwt-secret-for-session-library',
  };

  beforeAll(() => {
    Object.assign(process.env, mockEnv);
  });

  const jwtSecret = new TextEncoder().encode(mockEnv.JWT_SECRET);

  async function createToken(payload: any): Promise<string> {
    return await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setJti('test-jwt-id')
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(jwtSecret);
  }

  function createRequest(token?: string): Request {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['cookie'] = `session_token=${token}`;
    }

    return new Request('http://localhost:3000/api/test', { headers });
  }

  describe('getSession', () => {
    it('should extract session with lastOtpAt as number', async () => {
      const now = Date.now();
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: now,
      });

      const request = createRequest(token);
      const session = await getSession(request);

      expect(session).not.toBeNull();
      expect(session?.phone).toBe('+27123456789');
      expect(session?.userId).toBe('user123');
      expect(session?.role).toBe('user');
      expect(session?.lastOtpAt).toBe(now);
      expect(typeof session?.lastOtpAt).toBe('number');
    });

    it('should return null for lastOtpAt if not present in token', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        // No lastOtpAt
      });

      const request = createRequest(token);
      const session = await getSession(request);

      expect(session).not.toBeNull();
      expect(session?.lastOtpAt).toBeNull();
    });

    it('should return null for lastOtpAt if it is a string (old format)', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: '2024-01-01', // Wrong type
      });

      const request = createRequest(token);
      const session = await getSession(request);

      expect(session).not.toBeNull();
      expect(session?.lastOtpAt).toBeNull(); // Type guard should reject string
    });

    it('should handle lastOtpAt as 0 (valid timestamp)', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: 0, // Unix epoch
      });

      const request = createRequest(token);
      const session = await getSession(request);

      expect(session).not.toBeNull();
      expect(session?.lastOtpAt).toBe(0);
    });

    it('should extract token string', async () => {
      const tokenString = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now(),
      });

      const request = createRequest(tokenString);
      const session = await getSession(request);

      expect(session).not.toBeNull();
      expect(session?.token).toBe(tokenString);
    });

    it('should extract full JWT payload', async () => {
      const now = Date.now();
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'manager',
        lastOtpAt: now,
        customField: 'custom-value',
      });

      const request = createRequest(token);
      const session = await getSession(request);

      expect(session).not.toBeNull();
      expect(session?.payload).toBeDefined();
      expect(session?.payload.phone).toBe('+27123456789');
      expect(session?.payload.lastOtpAt).toBe(now);
      expect((session?.payload as any).customField).toBe('custom-value');
    });

    it('should return null when no token is present', async () => {
      const request = createRequest();
      const session = await getSession(request);

      expect(session).toBeNull();
    });

    it('should return null when token is invalid', async () => {
      const request = createRequest('invalid-token-string');
      const session = await getSession(request);

      expect(session).toBeNull();
    });

    it('should return null when token is expired', async () => {
      const token = await new SignJWT({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now(),
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setJti('test-jwt-id')
        .setIssuedAt()
        .setExpirationTime('1ms')
        .sign(jwtSecret);

      await new Promise(resolve => setTimeout(resolve, 10));

      const request = createRequest(token);
      const session = await getSession(request);

      expect(session).toBeNull();
    });

    it('should return null when phone is missing', async () => {
      const token = await createToken({
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now(),
        // No phone
      });

      const request = createRequest(token);
      const session = await getSession(request);

      expect(session).toBeNull();
    });

    it('should return null for role if not present', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        lastOtpAt: Date.now(),
        // No role
      });

      const request = createRequest(token);
      const session = await getSession(request);

      expect(session).not.toBeNull();
      expect(session?.role).toBeNull();
    });

    it('should return null for userId if not present', async () => {
      const token = await createToken({
        phone: '+27123456789',
        role: 'user',
        lastOtpAt: Date.now(),
        // No userId
      });

      const request = createRequest(token);
      const session = await getSession(request);

      expect(session).not.toBeNull();
      expect(session?.userId).toBeNull();
    });

    it('should handle multiple cookies in header', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now(),
      });

      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'cookie': `other_cookie=value1; session_token=${token}; another_cookie=value2`,
        },
      });

      const session = await getSession(request);

      expect(session).not.toBeNull();
      expect(session?.phone).toBe('+27123456789');
    });

    it('should handle URL-encoded cookie values', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now(),
      });

      const encodedToken = encodeURIComponent(token);
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'cookie': `session_token=${encodedToken}`,
        },
      });

      const session = await getSession(request);

      expect(session).not.toBeNull();
      expect(session?.phone).toBe('+27123456789');
    });
  });

  describe('requireSession', () => {
    it('should return session when valid token is present', async () => {
      const now = Date.now();
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: now,
      });

      const request = createRequest(token);
      const session = await requireSession(request);

      expect(session).toBeDefined();
      expect(session.phone).toBe('+27123456789');
      expect(session.lastOtpAt).toBe(now);
    });

    it('should throw UnauthorizedError when no token is present', async () => {
      const request = createRequest();

      await expect(requireSession(request)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when token is invalid', async () => {
      const request = createRequest('invalid-token');

      await expect(requireSession(request)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when token is expired', async () => {
      const token = await new SignJWT({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now(),
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setJti('test-jwt-id')
        .setIssuedAt()
        .setExpirationTime('1ms')
        .sign(jwtSecret);

      await new Promise(resolve => setTimeout(resolve, 10));

      const request = createRequest(token);

      await expect(requireSession(request)).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when phone is missing', async () => {
      const token = await createToken({
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now(),
      });

      const request = createRequest(token);

      await expect(requireSession(request)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('isPrivileged', () => {
    it('should return true for admin role', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'admin123',
        role: 'admin',
        lastOtpAt: Date.now(),
      });

      const request = createRequest(token);
      const session = await getSession(request);

      expect(isPrivileged(session)).toBe(true);
    });

    it('should return true for manager role', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'manager123',
        role: 'manager',
        lastOtpAt: Date.now(),
      });

      const request = createRequest(token);
      const session = await getSession(request);

      expect(isPrivileged(session)).toBe(true);
    });

    it('should return false for user role', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now(),
      });

      const request = createRequest(token);
      const session = await getSession(request);

      expect(isPrivileged(session)).toBe(false);
    });

    it('should return false for null session', () => {
      expect(isPrivileged(null)).toBe(false);
    });

    it('should return false for undefined session', () => {
      expect(isPrivileged(undefined)).toBe(false);
    });

    it('should return false for session with null role', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        lastOtpAt: Date.now(),
        // No role
      });

      const request = createRequest(token);
      const session = await getSession(request);

      expect(isPrivileged(session)).toBe(false);
    });

    it('should return false for unknown role', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'guest',
        lastOtpAt: Date.now(),
      });

      const request = createRequest(token);
      const session = await getSession(request);

      expect(isPrivileged(session)).toBe(false);
    });
  });

  describe('getRateLimitIdentity', () => {
    it('should return phone number for rate limiting', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now(),
      });

      const request = createRequest(token);
      const session = await getSession(request);

      expect(getRateLimitIdentity(session!)).toBe('+27123456789');
    });

    it('should return different identities for different users', async () => {
      const token1 = await createToken({
        phone: '+27111111111',
        userId: 'user1',
        role: 'user',
        lastOtpAt: Date.now(),
      });

      const token2 = await createToken({
        phone: '+27222222222',
        userId: 'user2',
        role: 'user',
        lastOtpAt: Date.now(),
      });

      const request1 = createRequest(token1);
      const session1 = await getSession(request1);

      const request2 = createRequest(token2);
      const session2 = await getSession(request2);

      expect(getRateLimitIdentity(session1!)).toBe('+27111111111');
      expect(getRateLimitIdentity(session2!)).toBe('+27222222222');
      expect(getRateLimitIdentity(session1!)).not.toBe(getRateLimitIdentity(session2!));
    });

    it('should return same identity for same user across sessions', async () => {
      const phone = '+27123456789';
      
      const token1 = await createToken({
        phone,
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now() - 1000,
      });

      const token2 = await createToken({
        phone,
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now(),
      });

      const request1 = createRequest(token1);
      const session1 = await getSession(request1);

      const request2 = createRequest(token2);
      const session2 = await getSession(request2);

      expect(getRateLimitIdentity(session1!)).toBe(getRateLimitIdentity(session2!));
    });
  });

  describe('SessionData Interface', () => {
    it('should have correct type for lastOtpAt', async () => {
      const now = Date.now();
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: now,
      });

      const request = createRequest(token);
      const session = await getSession(request);

      expect(session).not.toBeNull();
      
      // Type check
      if (session) {
        const lastOtpAt: number | null | undefined = session.lastOtpAt;
        expect(typeof lastOtpAt).toBe('number');
      }
    });

    it('should not have otpDay field (old format)', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now(),
      });

      const request = createRequest(token);
      const session = await getSession(request);

      expect(session).not.toBeNull();
      expect((session as any).otpDay).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw UnauthorizedError when JWT_SECRET is missing', async () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      const request = createRequest('some-token');

      await expect(getSession(request)).rejects.toThrow(UnauthorizedError);

      process.env.JWT_SECRET = originalSecret;
    });

    it('should handle malformed cookie header gracefully', async () => {
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'cookie': 'malformed;;;cookie===data',
        },
      });

      const session = await getSession(request);
      expect(session).toBeNull();
    });

    it('should handle empty cookie header', async () => {
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'cookie': '',
        },
      });

      const session = await getSession(request);
      expect(session).toBeNull();
    });

    it('should handle cookie with empty session_token value', async () => {
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'cookie': 'session_token=',
        },
      });

      const session = await getSession(request);
      expect(session).toBeNull();
    });
  });
});
