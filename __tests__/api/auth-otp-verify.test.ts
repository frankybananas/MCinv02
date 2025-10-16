/**
 * Auth OTP Verify API Route Test Suite
 * 
 * Tests POST /api/auth/otp/verify with 7-day OTP validation
 * Ensures JWT tokens contain lastOtpAt timestamp instead of otpDay
 * Target Coverage: 80%+
 */

import { SignJWT, jwtVerify } from 'jose';

// Mock dependencies
jest.mock('@/lib/mongodb', () => ({
  connect: jest.fn(async () => ({ connection: { readyState: 1 } })),
}));

jest.mock('twilio', () => {
  return {
    Twilio: jest.fn().mockImplementation(() => ({
      verify: {
        v2: {
          services: jest.fn().mockReturnValue({
            verificationChecks: {
              create: jest.fn(),
            },
          }),
        },
      },
    })),
  };
});

jest.mock('libphonenumber-js', () => ({
  __esModule: true,
  default: jest.fn((phone: string) => ({
    isValid: () => true,
    format: (format: string) => {
      if (format === 'E.164') {
        return phone.startsWith('+') ? phone : `+27${phone.replace(/^0/, '')}`;
      }
      return phone;
    },
  })),
}));

jest.mock('@/lib/test-accounts', () => ({
  getTestOtp: jest.fn((phone: string) => {
    if (phone === '+27123456789') return '123456';
    return null;
  }),
}));

// In-memory stores
const usersStore: any[] = [];
const sessionsStore: any[] = [];

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(async (query: any) => {
      return usersStore.find(u => u.phone === query.phone);
    }),
  },
}));

jest.mock('@/models/Session', () => {
  const mockSessionModel = {
    find: jest.fn((query: any) => ({
      sort: jest.fn(() => {
        const filtered = sessionsStore.filter(
          s => s.phoneNumber === query.phoneNumber && s.isActive === query.isActive
        );
        return Promise.resolve(filtered);
      }),
    })),
    findByIdAndUpdate: jest.fn(async (id: string, update: any) => {
      const session = sessionsStore.find(s => s._id === id);
      if (session) {
        Object.assign(session, update);
      }
      return session;
    }),
  };

  const SessionConstructor = jest.fn().mockImplementation((data: any) => ({
    ...data,
    _id: `session_${Date.now()}_${Math.random()}`,
    save: jest.fn(async function(this: any) {
      sessionsStore.push(this);
      return this;
    }),
  }));

  return {
    __esModule: true,
    default: Object.assign(SessionConstructor, mockSessionModel),
  };
});

// Import route handler after mocks
import { POST } from '@/app/api/auth/otp/verify/route';
import { Twilio } from 'twilio';

describe('Auth OTP Verify API - 7-Day Validation', () => {
  const mockEnv = {
    JWT_SECRET: 'test-jwt-secret-key-for-testing-purposes',
    TWILIO_ACCOUNT_SID: 'test-account-sid',
    TWILIO_AUTH_TOKEN: 'test-auth-token',
    TWILIO_VERIFY_SERVICE_SID: 'test-verify-service-sid',
    NODE_ENV: 'test',
  };

  beforeEach(() => {
    // Set environment variables
    Object.assign(process.env, mockEnv);

    // Clear stores
    usersStore.length = 0;
    sessionsStore.length = 0;

    // Add test user
    usersStore.push({
      _id: 'user123',
      phone: '+27123456789',
      role: 'user',
      profile: { firstName: 'Test', lastName: 'User' },
      isAuthorized: true,
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('JWT Token Structure', () => {
    it('should create JWT with lastOtpAt timestamp instead of otpDay', async () => {
      const request = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        },
        body: JSON.stringify({
          phone: '+27123456789',
          code: '123456',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Extract and verify JWT token
      const cookies = response.headers.getSetCookie();
      const sessionCookie = cookies.find(c => c.startsWith('session_token='));
      expect(sessionCookie).toBeDefined();

      const token = sessionCookie!.split(';')[0].split('=')[1];
      const secret = new TextEncoder().encode(mockEnv.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);

      // Verify lastOtpAt exists and is a number (timestamp)
      expect(payload.lastOtpAt).toBeDefined();
      expect(typeof payload.lastOtpAt).toBe('number');
      expect(payload.lastOtpAt).toBeGreaterThan(Date.now() - 10000); // Within last 10 seconds

      // Verify otpDay does NOT exist (old format)
      expect(payload.otpDay).toBeUndefined();

      // Verify other payload fields
      expect(payload.phone).toBe('+27123456789');
      expect(payload.userId).toBe('user123');
      expect(payload.role).toBe('user');
    });

    it('should set lastOtpAt to current timestamp', async () => {
      const beforeTime = Date.now();

      const request = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({
          phone: '+27123456789',
          code: '123456',
        }),
      });

      const response = await POST(request);
      const afterTime = Date.now();

      const cookies = response.headers.getSetCookie();
      const sessionCookie = cookies.find(c => c.startsWith('session_token='));
      const token = sessionCookie!.split(';')[0].split('=')[1];
      const secret = new TextEncoder().encode(mockEnv.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);

      const lastOtpAt = payload.lastOtpAt as number;
      expect(lastOtpAt).toBeGreaterThanOrEqual(beforeTime);
      expect(lastOtpAt).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Session Creation', () => {
    it('should create session with lastOtpAt timestamp', async () => {
      const request = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-agent': 'Mozilla/5.0 (iPhone)',
        },
        body: JSON.stringify({
          phone: '+27123456789',
          code: '123456',
        }),
      });

      await POST(request);

      expect(sessionsStore.length).toBe(1);
      const session = sessionsStore[0];
      expect(session.lastOtpAt).toBeInstanceOf(Date);
      expect(session.phoneNumber).toBe('+27123456789');
      expect(session.deviceType).toBe('mobile');
      expect(session.isActive).toBe(true);
    });

    it('should set session expiry to 7 days from now', async () => {
      const beforeTime = Date.now();

      const request = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({
          phone: '+27123456789',
          code: '123456',
        }),
      });

      await POST(request);

      const session = sessionsStore[0];
      const expiresAt = session.expiresAt.getTime();
      const expectedExpiry = beforeTime + 7 * 24 * 60 * 60 * 1000;

      // Allow 10 second tolerance
      expect(expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 10000);
      expect(expiresAt).toBeLessThanOrEqual(expectedExpiry + 10000);
    });
  });

  describe('Device Type Detection', () => {
    it('should detect mobile device from user-agent', async () => {
      const request = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        },
        body: JSON.stringify({
          phone: '+27123456789',
          code: '123456',
        }),
      });

      await POST(request);

      const session = sessionsStore[0];
      expect(session.deviceType).toBe('mobile');
    });

    it('should detect desktop device from user-agent', async () => {
      const request = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        body: JSON.stringify({
          phone: '+27123456789',
          code: '123456',
        }),
      });

      await POST(request);

      const session = sessionsStore[0];
      expect(session.deviceType).toBe('desktop');
    });

    it('should replace old session when logging in from same device type', async () => {
      // First login - mobile
      const request1 = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-agent': 'Mozilla/5.0 (iPhone)',
        },
        body: JSON.stringify({
          phone: '+27123456789',
          code: '123456',
        }),
      });

      await POST(request1);
      const firstSessionId = sessionsStore[0]._id;

      // Second login - mobile (should deactivate first)
      const request2 = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-agent': 'Mozilla/5.0 (Android)',
        },
        body: JSON.stringify({
          phone: '+27123456789',
          code: '123456',
        }),
      });

      await POST(request2);

      expect(sessionsStore.length).toBe(2);
      const firstSession = sessionsStore.find(s => s._id === firstSessionId);
      expect(firstSession?.isActive).toBe(false);
      expect(sessionsStore[1].isActive).toBe(true);
    });
  });

  describe('Test Account Handling', () => {
    it('should verify test account with test OTP', async () => {
      const request = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({
          phone: '+27123456789',
          code: '123456',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject invalid test OTP', async () => {
      const request = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({
          phone: '+27123456789',
          code: '999999',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid test OTP');
    });
  });

  describe('Real User Twilio Verification', () => {
    beforeEach(() => {
      usersStore.push({
        _id: 'user456',
        phone: '+27987654321',
        role: 'manager',
        profile: { firstName: 'Real', lastName: 'User' },
        isAuthorized: true,
      });
    });

    it('should verify real user with Twilio', async () => {
      const mockTwilio = Twilio as jest.MockedClass<typeof Twilio>;
      const mockCreate = mockTwilio.mock.results[0]?.value.verify.v2.services().verificationChecks.create;
      mockCreate.mockResolvedValueOnce({ status: 'approved' } as any);

      const request = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({
          phone: '+27987654321',
          code: '654321',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith({
        to: '+27987654321',
        code: '654321',
      });
    });

    it('should reject invalid Twilio OTP', async () => {
      const mockTwilio = Twilio as jest.MockedClass<typeof Twilio>;
      const mockCreate = mockTwilio.mock.results[0]?.value.verify.v2.services().verificationChecks.create;
      mockCreate.mockResolvedValueOnce({ status: 'pending' } as any);

      const request = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-agent': 'Mozilla/5.0',
        },
        body: JSON.stringify({
          phone: '+27987654321',
          code: '000000',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid OTP');
    });
  });

  describe('Error Handling', () => {
    it('should return 400 if phone is missing', async () => {
      const request = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '123456' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Phone number and code are required');
    });

    it('should return 400 if code is missing', async () => {
      const request = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '+27123456789' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Phone number and code are required');
    });

    it('should return 500 if JWT_SECRET is missing', async () => {
      delete process.env.JWT_SECRET;

      const request = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+27123456789',
          code: '123456',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Server configuration error');
    });

    it('should return 404 if user not found after verification', async () => {
      usersStore.length = 0; // Clear users

      const request = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+27123456789',
          code: '123456',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('User not found');
    });
  });

  describe('Cookie Settings', () => {
    it('should set secure cookie in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });

      const request = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+27123456789',
          code: '123456',
        }),
      });

      const response = await POST(request);
      const cookies = response.headers.getSetCookie();
      const sessionCookie = cookies.find(c => c.startsWith('session_token='));

      expect(sessionCookie).toContain('Secure');
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('SameSite=Lax');
      expect(sessionCookie).toContain('Max-Age=604800'); // 7 days

      Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, writable: true });
    });

    it('should not set secure flag in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });

      const request = new Request('http://localhost:3000/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+27123456789',
          code: '123456',
        }),
      });

      const response = await POST(request);
      const cookies = response.headers.getSetCookie();
      const sessionCookie = cookies.find(c => c.startsWith('session_token='));

      expect(sessionCookie).not.toContain('Secure');
      expect(sessionCookie).toContain('HttpOnly');

      Object.defineProperty(process.env, 'NODE_ENV', { value: originalEnv, writable: true });
    });
  });
});

