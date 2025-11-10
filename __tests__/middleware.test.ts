/**
 * Middleware Test Suite
 * 
 * Tests authentication middleware with 7-day OTP validation
 * Ensures JWT tokens with lastOtpAt are validated correctly
 * Target Coverage: 80%+
 */

import { SignJWT } from 'jose';
import { TextEncoder } from 'util';
import { NextRequest, NextResponse } from 'next/server';

// Mock NextResponse.redirect
jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server');
  return {
    ...actual,
    NextResponse: {
      ...actual.NextResponse,
      redirect: jest.fn((url: URL | string) => {
        const response = new Response(null, {
          status: 307,
          headers: { Location: url.toString() },
        });
        return response;
      }),
      next: jest.fn((options?: any) => {
        const response = new Response(null, { status: 200 });
        if (options?.request?.headers) {
          Object.entries(options.request.headers).forEach(([key, value]) => {
            response.headers.set(key, value as string);
          });
        }
        return response;
      }),
    },
  };
});

// Mock environment
const mockEnv = {
  JWT_SECRET: 'test-jwt-secret-for-middleware-testing',
  NODE_ENV: 'test',
};

beforeAll(() => {
  Object.assign(process.env, mockEnv);
});

// Import middleware after setting env
import { middleware } from '@/middleware';

describe('Middleware - 7-Day OTP Validation', () => {
  const jwtSecret = new TextEncoder().encode(mockEnv.JWT_SECRET);

  async function createToken(payload: any, expiresIn: string = '7d'): Promise<string> {
    return await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setJti('test-jwt-id')
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(jwtSecret);
  }

  function createRequest(pathname: string, token?: string): any {
    const url = `http://localhost:3000${pathname}`;
    const headers = new Headers({
      'Content-Type': 'application/json',
    });
    
    if (token) {
      headers.set('cookie', `session_token=${token}`);
    }

    const request = new Request(url, { headers });
    
    // Create URL with clone method
    const nextUrl = new URL(url);
    (nextUrl as any).clone = () => new URL(url);
    
    // Add NextRequest-specific properties
    return Object.assign(request, {
      nextUrl,
      cookies: {
        get: (name: string) => {
          const cookieHeader = headers.get('cookie') || '';
          const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
          return match ? { value: match[1] } : undefined;
        },
      },
      page: {},
      ua: {},
    });
  }

  describe('7-Day OTP Validation', () => {
    it('should allow access with valid token within 7 days', async () => {
      const now = Date.now();
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: now, // Just authenticated
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      expect(response.status).not.toBe(307); // Not redirected
      expect(response.headers.get('x-user-phone')).toBe('+27123456789');
      expect(response.headers.get('x-user-role')).toBe('user');
    });

    it('should allow access on day 6 (within 7 days)', async () => {
      const sixDaysAgo = Date.now() - (6 * 24 * 60 * 60 * 1000);
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: sixDaysAgo,
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
      expect(response.headers.get('x-user-phone')).toBe('+27123456789');
    });

    it('should redirect when exactly 7 days have passed', async () => {
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: sevenDaysAgo,
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      expect(response.status).toBe(307); // Redirect
      const location = response.headers.get('location');
      expect(location).toContain('/auth/login');
      expect(location).toContain('redirect=%2Fdashboard');
    });

    it('should redirect when more than 7 days have passed', async () => {
      const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: eightDaysAgo,
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/auth/login');
    });

    it('should redirect when 30 days have passed', async () => {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: thirtyDaysAgo,
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/auth/login');
    });

    it('should clear session cookie when redirecting due to expired OTP', async () => {
      const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: eightDaysAgo,
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      const cookies = response.headers.getSetCookie();
      const deletedCookie = cookies.find(c => c.startsWith('session_token='));
      
      // Cookie should be deleted (Max-Age=0 or Expires in past)
      expect(deletedCookie).toBeDefined();
      expect(deletedCookie).toMatch(/Max-Age=0|Expires=/);
    });
  });

  describe('Backward Compatibility - Old Token Format', () => {
    it('should redirect when token has otpDay instead of lastOtpAt', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        otpDay: '2024-01-01', // Old format
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/auth/login');
    });

    it('should redirect when token is missing lastOtpAt field', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        // No lastOtpAt or otpDay
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/auth/login');
    });

    it('should redirect when lastOtpAt is null', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: null,
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/auth/login');
    });

    it('should redirect when lastOtpAt is undefined', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: undefined,
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/auth/login');
    });
  });

  describe('Public Paths', () => {
    it('should allow access to /auth/login without token', async () => {
      const request = createRequest('/auth/login');
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
    });

    it('should allow access to /api/auth/otp/send without token', async () => {
      const request = createRequest('/api/auth/otp/send');
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
    });

    it('should allow access to /_next/static without token', async () => {
      const request = createRequest('/_next/static/chunks/main.js');
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
    });

    it('should allow access to /favicon.ico without token', async () => {
      const request = createRequest('/favicon.ico');
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
    });

    it('should allow access to /manifest.json without token', async () => {
      const request = createRequest('/manifest.json');
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
    });
  });

  describe('Protected Paths', () => {
    it('should redirect to login when accessing protected path without token', async () => {
      const request = createRequest('/dashboard');
      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/auth/login');
      expect(location).toContain('redirect=%2Fdashboard');
    });

    it('should redirect to login when accessing /cars without token', async () => {
      const request = createRequest('/cars');
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/auth/login');
    });

    it('should redirect to login when accessing API without token', async () => {
      const request = createRequest('/api/cars');
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/auth/login');
    });
  });

  describe('Admin Authorization', () => {
    it('should allow admin to access /admin paths', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'admin123',
        role: 'admin',
        lastOtpAt: Date.now(),
      });

      const request = createRequest('/admin/users', token);
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
      expect(response.headers.get('x-user-role')).toBe('admin');
    });

    it('should redirect non-admin from /admin paths to dashboard', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now(),
      });

      const request = createRequest('/admin/users', token);
      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toBe('http://localhost:3000/');
    });

    it('should redirect manager from /admin paths to dashboard', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'manager123',
        role: 'manager',
        lastOtpAt: Date.now(),
      });

      const request = createRequest('/admin/settings', token);
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/');
    });
  });

  describe('Request Headers Forwarding', () => {
    it('should forward user phone in x-user-phone header', async () => {
      const token = await createToken({
        phone: '+27987654321',
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now(),
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      expect(response.headers.get('x-user-phone')).toBe('+27987654321');
    });

    it('should forward user role in x-user-role header', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'manager123',
        role: 'manager',
        lastOtpAt: Date.now(),
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      expect(response.headers.get('x-user-role')).toBe('manager');
    });

    it('should forward empty string if phone is missing', async () => {
      const token = await createToken({
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now(),
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      // Should redirect because phone is required
      expect(response.status).toBe(307);
    });
  });

  describe('Invalid Token Handling', () => {
    it('should redirect when token is invalid', async () => {
      const request = createRequest('/dashboard', 'invalid-token-string');
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/auth/login');
    });

    it('should redirect when token is expired (JWT expiry)', async () => {
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now(),
      }, '1ms'); // Expires immediately

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/auth/login');
    });

    it('should redirect when token signature is invalid', async () => {
      const wrongSecret = new TextEncoder().encode('wrong-secret');
      const token = await new SignJWT({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: Date.now(),
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setJti('test-jwt-id')
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(wrongSecret);

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/auth/login');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very recent lastOtpAt (1 second ago)', async () => {
      const oneSecondAgo = Date.now() - 1000;
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: oneSecondAgo,
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
      expect(response.headers.get('x-user-phone')).toBe('+27123456789');
    });

    it('should handle lastOtpAt exactly at 7 day boundary', async () => {
      const exactlySevenDays = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: exactlySevenDays,
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      // Should redirect at exactly 7 days
      expect(response.status).toBe(307);
    });

    it('should handle lastOtpAt 1 millisecond before 7 days', async () => {
      const almostSevenDays = Date.now() - (7 * 24 * 60 * 60 * 1000 - 1);
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: almostSevenDays,
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      // Should allow access (still within 7 days)
      expect(response.status).not.toBe(307);
    });

    it('should handle future lastOtpAt timestamp', async () => {
      const futureTime = Date.now() + (1 * 24 * 60 * 60 * 1000); // 1 day in future
      const token = await createToken({
        phone: '+27123456789',
        userId: 'user123',
        role: 'user',
        lastOtpAt: futureTime,
      });

      const request = createRequest('/dashboard', token);
      const response = await middleware(request);

      // Should allow (negative time difference)
      expect(response.status).not.toBe(307);
    });

    it('should preserve redirect parameter in URL', async () => {
      const request = createRequest('/cars/123');
      const response = await middleware(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/auth/login');
      expect(location).toContain('redirect=%2Fcars%2F123');
    });
  });
});

