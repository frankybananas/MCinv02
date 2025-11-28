/**
 * Input Validation Utilities
 * 
 * Provides validation and sanitization functions for user inputs
 * to prevent injection attacks and ensure data integrity.
 */

// ObjectId regex pattern: 24 hex characters
const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;

/**
 * Validate if a string is a valid MongoDB ObjectId.
 * Uses regex to avoid importing mongoose (Edge-compatible).
 * 
 * @param id - String to validate
 * @returns true if valid ObjectId format
 */
export function isValidObjectId(id: string | undefined | null): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return OBJECT_ID_REGEX.test(id);
}

/**
 * Assert that a string is a valid MongoDB ObjectId.
 * Throws if invalid.
 * 
 * @param id - String to validate
 * @param fieldName - Name of the field for error message
 * @throws Error if invalid
 */
export function assertValidObjectId(id: string | undefined | null, fieldName: string = 'id'): asserts id is string {
  if (!isValidObjectId(id)) {
    throw new Error(`Invalid ${fieldName}: must be a valid ObjectId`);
  }
}

/**
 * Safely parse and validate an ObjectId from route params or query.
 * Returns null if invalid instead of throwing.
 * 
 * @param id - String to validate
 * @returns The ObjectId string or null if invalid
 */
export function parseObjectId(id: string | undefined | null): string | null {
  return isValidObjectId(id) ? id! : null;
}

/**
 * Sanitize a string by removing potentially dangerous characters.
 * Use for user-provided text that will be stored or displayed.
 * 
 * @param input - String to sanitize
 * @param maxLength - Maximum allowed length (default 500)
 * @returns Sanitized string
 */
export function sanitizeString(input: string | undefined | null, maxLength: number = 500): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Trim whitespace
  let sanitized = input.trim();
  
  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // Remove null bytes and other control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized;
}

/**
 * Sanitize a string for use in MongoDB queries.
 * Escapes special regex characters to prevent ReDoS attacks.
 * 
 * @param input - String to sanitize
 * @returns Regex-safe string
 */
export function sanitizeForRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate and sanitize a numeric string.
 * 
 * @param input - String to parse
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Parsed number or null if invalid
 */
export function parseNumber(
  input: string | undefined | null, 
  min: number = Number.MIN_SAFE_INTEGER, 
  max: number = Number.MAX_SAFE_INTEGER
): number | null {
  if (!input || typeof input !== 'string') {
    return null;
  }
  
  const num = parseFloat(input);
  
  if (isNaN(num) || !isFinite(num)) {
    return null;
  }
  
  if (num < min || num > max) {
    return null;
  }
  
  return num;
}

/**
 * Validate and sanitize an integer string.
 * 
 * @param input - String to parse
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Parsed integer or null if invalid
 */
export function parseInteger(
  input: string | undefined | null, 
  min: number = Number.MIN_SAFE_INTEGER, 
  max: number = Number.MAX_SAFE_INTEGER
): number | null {
  const num = parseNumber(input, min, max);
  return num !== null ? Math.floor(num) : null;
}

/**
 * Validate an email address format.
 * 
 * @param email - Email to validate
 * @returns true if valid email format
 */
export function isValidEmail(email: string | undefined | null): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // Basic email regex - not exhaustive but catches most issues
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate a URL format.
 * 
 * @param url - URL to validate
 * @param allowedProtocols - Allowed protocols (default: http, https)
 * @returns true if valid URL
 */
export function isValidUrl(
  url: string | undefined | null, 
  allowedProtocols: string[] = ['http:', 'https:']
): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    const parsed = new URL(url);
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate pagination parameters.
 * 
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @param maxLimit - Maximum allowed limit
 * @returns Validated pagination object
 */
export function validatePagination(
  page: string | undefined | null,
  limit: string | undefined | null,
  maxLimit: number = 100
): { page: number; limit: number; skip: number } {
  const parsedPage = parseInteger(page, 1, 1000) || 1;
  const parsedLimit = parseInteger(limit, 1, maxLimit) || 20;
  
  return {
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit,
  };
}

/**
 * Validate sort parameters for MongoDB queries.
 * 
 * @param sortField - Field to sort by
 * @param sortOrder - Sort order ('asc' or 'desc')
 * @param allowedFields - List of allowed field names
 * @param defaultField - Default field if invalid
 * @returns MongoDB sort object
 */
export function validateSort(
  sortField: string | undefined | null,
  sortOrder: string | undefined | null,
  allowedFields: string[],
  defaultField: string = 'createdAt'
): Record<string, 1 | -1> {
  const field = allowedFields.includes(sortField || '') ? sortField! : defaultField;
  const order = sortOrder === 'asc' ? 1 : -1;
  
  return { [field]: order };
}
