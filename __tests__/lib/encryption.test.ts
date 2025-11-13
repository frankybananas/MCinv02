import { encryptToken, decryptToken, generateEncryptionKey } from '../../lib/encryption';

describe('Encryption Utilities', () => {
  const originalEnv = process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY;
  const validKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars
  
  beforeEach(() => {
    process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY = validKey;
  });
  
  afterEach(() => {
    process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY = originalEnv;
  });

  describe('generateEncryptionKey', () => {
    it('should generate a 64-character hex string', () => {
      const key = generateEncryptionKey();
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
    });

    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('encryptToken', () => {
    it('should encrypt a token successfully', () => {
      const token = 'my-secret-token-12345';
      const encrypted = encryptToken(token);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(token);
      expect(encrypted).toContain(':');
    });

    it('should produce different encrypted values for same token (different IV)', () => {
      const token = 'my-secret-token';
      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should throw error if encryption key is not set', () => {
      delete process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY;
      
      expect(() => encryptToken('token')).toThrow('FACEBOOK_TOKEN_ENCRYPTION_KEY environment variable is not set');
    });

    it('should throw error if encryption key is invalid length', () => {
      process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY = 'short-key';
      
      expect(() => encryptToken('token')).toThrow('FACEBOOK_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    });

    it('should handle empty string token', () => {
      const encrypted = encryptToken('');
      expect(encrypted).toBeDefined();
      expect(encrypted).toContain(':');
    });

    it('should handle long tokens', () => {
      const longToken = 'a'.repeat(1000);
      const encrypted = encryptToken(longToken);
      expect(encrypted).toBeDefined();
      expect(encrypted).toContain(':');
    });

    it('should handle special characters in token', () => {
      const token = 'token!@#$%^&*()_+-={}[]|:";\'<>?,./';
      const encrypted = encryptToken(token);
      expect(encrypted).toBeDefined();
      expect(encrypted).toContain(':');
    });
  });

  describe('decryptToken', () => {
    it('should decrypt an encrypted token successfully', () => {
      const originalToken = 'my-secret-token-12345';
      const encrypted = encryptToken(originalToken);
      const decrypted = decryptToken(encrypted);
      
      expect(decrypted).toBe(originalToken);
    });

    it('should handle empty string token round-trip', () => {
      const encrypted = encryptToken('');
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe('');
    });

    it('should handle long tokens round-trip', () => {
      const longToken = 'a'.repeat(1000);
      const encrypted = encryptToken(longToken);
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(longToken);
    });

    it('should handle special characters round-trip', () => {
      const token = 'token!@#$%^&*()_+-={}[]|:";\'<>?,./';
      const encrypted = encryptToken(token);
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(token);
    });

    it('should throw error if encryption key is not set', () => {
      const encrypted = encryptToken('token');
      delete process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY;
      
      expect(() => decryptToken(encrypted)).toThrow('FACEBOOK_TOKEN_ENCRYPTION_KEY environment variable is not set');
    });

    it('should throw error if encryption key is invalid length', () => {
      const encrypted = encryptToken('token');
      process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY = 'short-key';
      
      expect(() => decryptToken(encrypted)).toThrow('FACEBOOK_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    });

    it('should throw error for invalid encrypted token format (no colon)', () => {
      expect(() => decryptToken('invalid-format')).toThrow('Invalid encrypted token format');
    });

    it('should throw error for invalid encrypted token format (empty parts)', () => {
      expect(() => decryptToken(':encrypted')).toThrow('Invalid encrypted token format');
      expect(() => decryptToken('iv:')).toThrow('Failed to decrypt token');
    });

    it('should throw error for malformed encrypted data', () => {
      expect(() => decryptToken('invalidiv:invaliddata')).toThrow('Failed to decrypt token');
    });

    it('should throw error when decrypting with wrong key', () => {
      const encrypted = encryptToken('token');
      process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      expect(() => decryptToken(encrypted)).toThrow('Failed to decrypt token');
    });
  });

  describe('encryption/decryption integration', () => {
    it('should maintain data integrity through multiple encrypt/decrypt cycles', () => {
      const token = 'test-token-12345';
      
      const encrypted1 = encryptToken(token);
      const decrypted1 = decryptToken(encrypted1);
      expect(decrypted1).toBe(token);
      
      const encrypted2 = encryptToken(decrypted1);
      const decrypted2 = decryptToken(encrypted2);
      expect(decrypted2).toBe(token);
    });

    it('should handle Unicode characters', () => {
      const token = 'token-with-émojis-🚀-and-中文';
      const encrypted = encryptToken(token);
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(token);
    });

    it('should produce encrypted format with valid structure', () => {
      const token = 'test-token';
      const encrypted = encryptToken(token);
      const parts = encrypted.split(':');
      
      expect(parts).toHaveLength(2);
      expect(parts[0]).toHaveLength(32); // IV is 16 bytes = 32 hex chars
      expect(parts[1].length).toBeGreaterThan(0);
      expect(/^[0-9a-f]+$/.test(parts[0])).toBe(true);
      expect(/^[0-9a-f]+$/.test(parts[1])).toBe(true);
    });
  });
});
