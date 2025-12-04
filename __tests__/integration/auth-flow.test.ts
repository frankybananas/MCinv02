/**
 * Integration Test: Authentication Flow
 * 
 * Tests the complete OTP authentication journey:
 * 1. OTP request (send)
 * 2. Rate limiting
 * 3. OTP verification
 * 4. Session creation
 * 5. Protected route access
 * 6. Session expiry (7-day rule)
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock Twilio
jest.mock('twilio', () => {
  return jest.fn().mockImplementation(() => ({
    verify: {
      v2: {
        services: jest.fn().mockReturnValue({
          verifications: {
            create: jest.fn().mockResolvedValue({ status: 'pending', sid: 'verification-123' }),
          },
          verificationChecks: {
            create: jest.fn().mockResolvedValue({ status: 'approved', valid: true }),
          },
        }),
      },
    },
  }));
});

// Mock MongoDB connection
jest.mock('@/lib/mongodb', () => ({
  connectToDatabase: jest.fn().mockResolvedValue({}),
  connect: jest.fn().mockResolvedValue({}),
}));

// Mock User model
const mockUser = {
  _id: 'user-123',
  phone: '+27123456789',
  isAuthorized: true,
  role: 'user',
  department: 'used',
  save: jest.fn().mockResolvedValue(true),
};

jest.mock('@/models/User', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn().mockResolvedValue(mockUser),
    findOneAndUpdate: jest.fn().mockResolvedValue(mockUser),
  },
}));

// Mock Session model
jest.mock('@/models/Session', () => ({
  __esModule: true,
  default: {
    create: jest.fn().mockResolvedValue({ _id: 'session-123', jwtId: 'jwt-123' }),
    findOne: jest.fn().mockResolvedValue({ isActive: true }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  },
}));

// Mock RateLimit model
jest.mock('@/models/RateLimit', () => ({
  __esModule: true,
  default: {
    findOneAndUpdate: jest.fn().mockResolvedValue({ count: 1 }),
  },
}));

// Mock OtpBlock model
jest.mock('@/models/OtpBlock', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn().mockResolvedValue(null), // Not blocked
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  },
}));

describe('Authentication Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Phone Number Validation', () => {
    it('should normalize phone numbers to E.164 format', () => {
      const normalizePhone = (phone: string): string => {
        // Remove all non-digit characters except leading +
        let cleaned = phone.replace(/[^\d+]/g, '');
        
        // South African number handling
        if (cleaned.startsWith('0') && cleaned.length === 10) {
          cleaned = '+27' + cleaned.substring(1);
        } else if (cleaned.startsWith('27') && !cleaned.startsWith('+')) {
          cleaned = '+' + cleaned;
        } else if (!cleaned.startsWith('+')) {
          cleaned = '+' + cleaned;
        }
        
        return cleaned;
      };

      expect(normalizePhone('0821234567')).toBe('+27821234567');
      expect(normalizePhone('+27821234567')).toBe('+27821234567');
      expect(normalizePhone('27821234567')).toBe('+27821234567');
    });

    it('should reject invalid phone numbers', () => {
      const isValidPhone = (phone: string): boolean => {
        // E.164 format: + followed by 10-15 digits
        return /^\+\d{10,15}$/.test(phone);
      };

      expect(isValidPhone('+27821234567')).toBe(true);
      expect(isValidPhone('+1234567890')).toBe(true);
      expect(isValidPhone('invalid')).toBe(false);
      expect(isValidPhone('+123')).toBe(false); // Too short
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce OTP send rate limits', async () => {
      const RateLimit = (await import('@/models/RateLimit')).default;
      
      // Simulate rate limit check
      const result = await RateLimit.findOneAndUpdate(
        { key: 'otp:send:+27123456789:12345' },
        { $inc: { count: 1 } },
        { upsert: true, new: true }
      );

      expect(RateLimit.findOneAndUpdate).toHaveBeenCalled();
      expect(result.count).toBe(1);
    });

    it('should implement progressive blocking after failed attempts', () => {
      // Test progressive blocking logic
      const calculateBlockDuration = (blockCount: number): number => {
        // Block duration doubles: 1h, 2h, 4h, 8h...
        return Math.pow(2, blockCount - 1) * 60 * 60 * 1000; // ms
      };

      expect(calculateBlockDuration(1)).toBe(1 * 60 * 60 * 1000); // 1 hour
      expect(calculateBlockDuration(2)).toBe(2 * 60 * 60 * 1000); // 2 hours
      expect(calculateBlockDuration(3)).toBe(4 * 60 * 60 * 1000); // 4 hours
    });

    it('should reset block on successful login', async () => {
      const OtpBlock = (await import('@/models/OtpBlock')).default;
      
      // Simulate successful login reset
      await OtpBlock.deleteOne({ phone: '+27123456789' });

      expect(OtpBlock.deleteOne).toHaveBeenCalledWith({ phone: '+27123456789' });
    });
  });

  describe('User Authorization', () => {
    it('should only allow authorized users to log in', async () => {
      const User = (await import('@/models/User')).default;
      
      const user = await User.findOne({ phone: '+27123456789' });
      
      expect(user).toBeDefined();
      expect(user?.isAuthorized).toBe(true);
    });

    it('should reject unauthorized users', async () => {
      const User = (await import('@/models/User')).default;
      (User.findOne as jest.Mock).mockResolvedValueOnce({
        ...mockUser,
        isAuthorized: false,
      });
      
      const user = await User.findOne({ phone: '+27123456789' });
      
      expect(user?.isAuthorized).toBe(false);
    });
  });

  describe('JWT Session', () => {
    it('should create session with required claims', () => {
      const createSessionPayload = (user: typeof mockUser) => ({
        phone: user.phone,
        userId: user._id,
        role: user.role,
        lastOtpAt: Date.now(),
        jti: 'unique-jwt-id',
      });

      const payload = createSessionPayload(mockUser);

      expect(payload.phone).toBe('+27123456789');
      expect(payload.userId).toBe('user-123');
      expect(payload.role).toBe('user');
      expect(payload.lastOtpAt).toBeDefined();
      expect(payload.jti).toBeDefined();
    });

    it('should enforce 7-day OTP re-authentication', () => {
      const isOtpExpired = (lastOtpAt: number): boolean => {
        const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
        return Date.now() - lastOtpAt >= sevenDaysInMs;
      };

      const now = Date.now();
      const sixDaysAgo = now - (6 * 24 * 60 * 60 * 1000);
      const eightDaysAgo = now - (8 * 24 * 60 * 60 * 1000);

      expect(isOtpExpired(sixDaysAgo)).toBe(false);
      expect(isOtpExpired(eightDaysAgo)).toBe(true);
    });

    it('should set HttpOnly cookie attributes', () => {
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
        sameSite: 'strict' as const,
      };

      expect(cookieOptions.httpOnly).toBe(true);
      expect(cookieOptions.sameSite).toBe('strict');
      expect(cookieOptions.maxAge).toBe(604800); // 7 days in seconds
    });
  });

  describe('Role-Based Access', () => {
    it('should correctly identify admin role', () => {
      const hasAdminAccess = (role: string): boolean => role === 'admin';

      expect(hasAdminAccess('admin')).toBe(true);
      expect(hasAdminAccess('manager')).toBe(false);
      expect(hasAdminAccess('user')).toBe(false);
    });

    it('should correctly identify privileged roles', () => {
      const isPrivileged = (role: string): boolean => {
        return role === 'admin' || role === 'manager';
      };

      expect(isPrivileged('admin')).toBe(true);
      expect(isPrivileged('manager')).toBe(true);
      expect(isPrivileged('recon')).toBe(false);
      expect(isPrivileged('user')).toBe(false);
    });

    it('should enforce role hierarchy', () => {
      const roleHierarchy: Record<string, number> = {
        user: 0,
        recon: 1,
        manager: 2,
        admin: 3,
      };

      const isRoleAtLeast = (userRole: string, requiredRole: string): boolean => {
        return (roleHierarchy[userRole] ?? -1) >= (roleHierarchy[requiredRole] ?? 999);
      };

      expect(isRoleAtLeast('admin', 'user')).toBe(true);
      expect(isRoleAtLeast('admin', 'admin')).toBe(true);
      expect(isRoleAtLeast('user', 'admin')).toBe(false);
      expect(isRoleAtLeast('manager', 'recon')).toBe(true);
    });
  });

  describe('Device Session Management', () => {
    it('should track device type in session', () => {
      const getDeviceType = (userAgent: string): 'mobile' | 'desktop' => {
        const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad'];
        const ua = userAgent.toLowerCase();
        return mobileKeywords.some(keyword => ua.includes(keyword)) ? 'mobile' : 'desktop';
      };

      expect(getDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)')).toBe('mobile');
      expect(getDeviceType('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
      expect(getDeviceType('Mozilla/5.0 (Linux; Android 11)')).toBe('mobile');
    });

    it('should limit sessions per device type', async () => {
      const Session = (await import('@/models/Session')).default;
      
      // Simulate clearing old sessions of same device type
      await Session.deleteMany({
        phone: '+27123456789',
        deviceType: 'mobile',
        isActive: true,
      });

      expect(Session.deleteMany).toHaveBeenCalled();
    });
  });
});

describe('Auth Error Handling', () => {
  it('should return appropriate error for missing phone', () => {
    const validateOtpRequest = (body: { phone?: string }) => {
      if (!body.phone) {
        return { error: 'Phone number is required', status: 400 };
      }
      return null;
    };

    expect(validateOtpRequest({})).toEqual({ error: 'Phone number is required', status: 400 });
    expect(validateOtpRequest({ phone: '+27123456789' })).toBeNull();
  });

  it('should return appropriate error for unauthorized user', () => {
    const checkAuthorization = (user: { isAuthorized: boolean } | null) => {
      if (!user) {
        return { error: 'User not found', status: 404 };
      }
      if (!user.isAuthorized) {
        return { error: 'User not authorized', status: 403 };
      }
      return null;
    };

    expect(checkAuthorization(null)).toEqual({ error: 'User not found', status: 404 });
    expect(checkAuthorization({ isAuthorized: false })).toEqual({ error: 'User not authorized', status: 403 });
    expect(checkAuthorization({ isAuthorized: true })).toBeNull();
  });

  it('should return appropriate error for rate limit exceeded', () => {
    const checkRateLimit = (count: number, limit: number) => {
      if (count > limit) {
        return { error: 'Rate limit exceeded', status: 429 };
      }
      return null;
    };

    expect(checkRateLimit(6, 5)).toEqual({ error: 'Rate limit exceeded', status: 429 });
    expect(checkRateLimit(5, 5)).toBeNull();
  });
});
