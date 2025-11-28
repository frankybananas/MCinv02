/**
 * Tests for Security Features Implementation
 * 
 * Tests for:
 * - RBAC system
 * - Input validation
 * - Environment validation
 */

import { 
  hasPermission, 
  hasAllPermissions, 
  hasAnyPermission, 
  isRoleAtLeast, 
  getPermissions, 
  isValidRole,
  requirePermission,
  requireRole,
  Permission,
  Role
} from '@/lib/rbac';

import {
  isValidObjectId,
  assertValidObjectId,
  parseObjectId,
  sanitizeString,
  sanitizeForRegex,
  parseNumber,
  parseInteger,
  isValidEmail,
  isValidUrl,
  validatePagination,
  validateSort,
} from '@/lib/validation';

import {
  validateEnv,
  getRequiredEnv,
  getEnv,
  isProduction,
  isDevelopment,
} from '@/lib/env-validation';

describe('RBAC System', () => {
  describe('hasPermission', () => {
    it('should return true for admin with admin:access', () => {
      expect(hasPermission('admin', 'admin:access')).toBe(true);
    });

    it('should return false for user with admin:access', () => {
      expect(hasPermission('user', 'admin:access')).toBe(false);
    });

    it('should return true for user with cars:read', () => {
      expect(hasPermission('user', 'cars:read')).toBe(true);
    });

    it('should be case-insensitive for roles', () => {
      expect(hasPermission('ADMIN', 'admin:access')).toBe(true);
      expect(hasPermission('Admin', 'admin:access')).toBe(true);
    });

    it('should return false for unknown roles', () => {
      expect(hasPermission('superuser', 'cars:read')).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when role has all permissions', () => {
      expect(hasAllPermissions('admin', ['cars:read', 'cars:write', 'admin:access'])).toBe(true);
    });

    it('should return false when role is missing any permission', () => {
      expect(hasAllPermissions('user', ['cars:read', 'cars:write'])).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true when role has at least one permission', () => {
      expect(hasAnyPermission('user', ['cars:read', 'admin:access'])).toBe(true);
    });

    it('should return false when role has none of the permissions', () => {
      expect(hasAnyPermission('user', ['admin:access', 'users:manage'])).toBe(false);
    });
  });

  describe('isRoleAtLeast', () => {
    it('should correctly compare role hierarchy', () => {
      expect(isRoleAtLeast('admin', 'user')).toBe(true);
      expect(isRoleAtLeast('admin', 'admin')).toBe(true);
      expect(isRoleAtLeast('user', 'admin')).toBe(false);
      expect(isRoleAtLeast('manager', 'recon')).toBe(true);
    });
  });

  describe('getPermissions', () => {
    it('should return permissions array for valid role', () => {
      const perms = getPermissions('admin');
      expect(perms).toContain('admin:access');
      expect(perms).toContain('cars:read');
    });

    it('should return empty array for unknown role', () => {
      expect(getPermissions('unknown')).toEqual([]);
    });
  });

  describe('isValidRole', () => {
    it('should return true for valid roles', () => {
      expect(isValidRole('admin')).toBe(true);
      expect(isValidRole('manager')).toBe(true);
      expect(isValidRole('recon')).toBe(true);
      expect(isValidRole('user')).toBe(true);
    });

    it('should return false for invalid roles', () => {
      expect(isValidRole('superadmin')).toBe(false);
      expect(isValidRole('')).toBe(false);
    });
  });

  describe('requirePermission', () => {
    it('should not throw for authorized role', () => {
      expect(() => requirePermission('admin', 'admin:access')).not.toThrow();
    });

    it('should throw for unauthorized role', () => {
      expect(() => requirePermission('user', 'admin:access')).toThrow('Permission denied');
    });

    it('should throw for undefined role', () => {
      expect(() => requirePermission(undefined, 'cars:read')).toThrow('Permission denied');
    });
  });

  describe('requireRole', () => {
    it('should not throw for sufficient role', () => {
      expect(() => requireRole('admin', 'manager')).not.toThrow();
    });

    it('should throw for insufficient role', () => {
      expect(() => requireRole('user', 'admin')).toThrow('Permission denied');
    });
  });
});

describe('Input Validation', () => {
  describe('isValidObjectId', () => {
    it('should return true for valid ObjectId', () => {
      expect(isValidObjectId('507f1f77bcf86cd799439011')).toBe(true);
    });

    it('should return false for invalid ObjectId', () => {
      expect(isValidObjectId('invalid')).toBe(false);
      expect(isValidObjectId('')).toBe(false);
      expect(isValidObjectId(null)).toBe(false);
      expect(isValidObjectId(undefined)).toBe(false);
    });
  });

  describe('assertValidObjectId', () => {
    it('should not throw for valid ObjectId', () => {
      expect(() => assertValidObjectId('507f1f77bcf86cd799439011')).not.toThrow();
    });

    it('should throw for invalid ObjectId', () => {
      expect(() => assertValidObjectId('invalid')).toThrow('Invalid');
    });
  });

  describe('parseObjectId', () => {
    it('should return id for valid ObjectId', () => {
      expect(parseObjectId('507f1f77bcf86cd799439011')).toBe('507f1f77bcf86cd799439011');
    });

    it('should return null for invalid ObjectId', () => {
      expect(parseObjectId('invalid')).toBeNull();
    });
  });

  describe('sanitizeString', () => {
    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should truncate long strings', () => {
      const long = 'a'.repeat(600);
      expect(sanitizeString(long).length).toBe(500);
    });

    it('should remove control characters', () => {
      expect(sanitizeString('hello\x00world')).toBe('helloworld');
    });

    it('should handle null/undefined', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });
  });

  describe('sanitizeForRegex', () => {
    it('should escape regex special characters', () => {
      expect(sanitizeForRegex('test.*+?')).toBe('test\\.\\*\\+\\?');
    });
  });

  describe('parseNumber', () => {
    it('should parse valid numbers', () => {
      expect(parseNumber('42')).toBe(42);
      expect(parseNumber('3.14')).toBe(3.14);
    });

    it('should return null for invalid numbers', () => {
      expect(parseNumber('abc')).toBeNull();
      expect(parseNumber('')).toBeNull();
    });

    it('should enforce min/max bounds', () => {
      expect(parseNumber('5', 1, 10)).toBe(5);
      expect(parseNumber('15', 1, 10)).toBeNull();
    });
  });

  describe('parseInteger', () => {
    it('should parse and floor decimals', () => {
      expect(parseInteger('3.7')).toBe(3);
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidUrl', () => {
    it('should validate http/https URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://example.com')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
    });
  });

  describe('validatePagination', () => {
    it('should return valid pagination object', () => {
      const result = validatePagination('2', '10', 100);
      expect(result).toEqual({ page: 2, limit: 10, skip: 10 });
    });

    it('should use defaults for invalid input', () => {
      const result = validatePagination(null, null, 100);
      expect(result).toEqual({ page: 1, limit: 20, skip: 0 });
    });
  });

  describe('validateSort', () => {
    it('should validate allowed fields', () => {
      const result = validateSort('name', 'asc', ['name', 'createdAt']);
      expect(result).toEqual({ name: 1 });
    });

    it('should use default for invalid field', () => {
      const result = validateSort('invalid', 'desc', ['name', 'createdAt'], 'createdAt');
      expect(result).toEqual({ createdAt: -1 });
    });
  });
});

describe('Environment Validation', () => {
  describe('validateEnv', () => {
    it('should return validation result object', () => {
      const result = validateEnv();
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('missing');
      expect(result).toHaveProperty('warnings');
    });
  });

  describe('getEnv', () => {
    it('should return default value when env not set', () => {
      expect(getEnv('NONEXISTENT_VAR', 'default')).toBe('default');
    });

    it('should return env value when set', () => {
      process.env.TEST_VAR = 'test_value';
      expect(getEnv('TEST_VAR', 'default')).toBe('test_value');
      delete process.env.TEST_VAR;
    });
  });

  describe('getRequiredEnv', () => {
    it('should throw for missing required env', () => {
      expect(() => getRequiredEnv('NONEXISTENT_REQUIRED_VAR')).toThrow();
    });
  });

  describe('isProduction/isDevelopment', () => {
    it('should return boolean values', () => {
      // Just verify the functions return booleans
      expect(typeof isProduction()).toBe('boolean');
      expect(typeof isDevelopment()).toBe('boolean');
    });

    it('should be mutually exclusive', () => {
      // In test env, one should be true and one false
      // (unless NODE_ENV is neither 'production' nor something else)
      const prod = isProduction();
      const dev = isDevelopment();
      expect(prod !== dev || (!prod && !dev)).toBe(true);
    });
  });
});
