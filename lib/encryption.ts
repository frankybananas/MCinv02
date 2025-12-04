import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Validates the encryption key format
 * @throws Error if encryption key is not set or invalid
 */
const validateEncryptionKey = (): string => {
  const ENCRYPTION_KEY = process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY;
  
  if (!ENCRYPTION_KEY) {
    throw new Error('FACEBOOK_TOKEN_ENCRYPTION_KEY environment variable is not set');
  }
  
  if (ENCRYPTION_KEY.length !== 64) {
    throw new Error('FACEBOOK_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  
  return ENCRYPTION_KEY;
};

/**
 * Encrypts a token using AES-256-CBC encryption
 * @param token - The token to encrypt
 * @returns Encrypted token in format "iv:encryptedData"
 * @throws Error if encryption key is not set or invalid
 */
export const encryptToken = (token: string): string => {
  const ENCRYPTION_KEY = validateEncryptionKey();
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer as any, iv as any);
  
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
};

/**
 * Decrypts a token that was encrypted with encryptToken
 * @param encryptedToken - The encrypted token in format "iv:encryptedData"
 * @returns Decrypted token
 * @throws Error if encryption key is not set, invalid, or decryption fails
 */
export const decryptToken = (encryptedToken: string): string => {
  const ENCRYPTION_KEY = validateEncryptionKey();
  
  try {
    const [ivHex, encrypted] = encryptedToken.split(':');
    
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted token format');
    }
    
    const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer as any, iv as any);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Failed to decrypt token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Generates a random 32-byte encryption key in hex format
 * Use this to generate FACEBOOK_TOKEN_ENCRYPTION_KEY
 * @returns 64-character hex string (32 bytes)
 */
export const generateEncryptionKey = (): string => {
  return crypto.randomBytes(32).toString('hex');
};
