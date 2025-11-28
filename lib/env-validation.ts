/**
 * Environment Variable Validation
 * 
 * Validates that all required environment variables are set.
 * Call validateEnv() early in the app lifecycle to fail fast.
 */

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
  sensitive?: boolean; // If true, don't log the value
}

// All environment variables used by the application
const ENV_VARS: EnvVar[] = [
  // Core
  { name: 'NODE_ENV', required: false, description: 'Node environment (development/production)' },
  { name: 'MONGODB_URI', required: true, description: 'MongoDB connection string', sensitive: true },
  { name: 'JWT_SECRET', required: true, description: 'Secret key for JWT signing', sensitive: true },
  
  // Twilio
  { name: 'TWILIO_ACCOUNT_SID', required: true, description: 'Twilio Account SID', sensitive: true },
  { name: 'TWILIO_AUTH_TOKEN', required: true, description: 'Twilio Auth Token', sensitive: true },
  { name: 'TWILIO_VERIFY_SERVICE_SID', required: true, description: 'Twilio Verify Service SID', sensitive: true },
  
  // Cloudflare R2
  { name: 'R2_ACCESS_KEY_ID', required: true, description: 'R2 Access Key ID', sensitive: true },
  { name: 'R2_SECRET_ACCESS_KEY', required: true, description: 'R2 Secret Access Key', sensitive: true },
  { name: 'R2_BUCKET_NAME', required: true, description: 'R2 Bucket Name' },
  { name: 'R2_ACCOUNT_ID', required: true, description: 'R2 Account ID' },
  { name: 'R2_PUBLIC_URL', required: true, description: 'R2 Public URL for assets' },
  
  // Optional
  { name: 'NEXT_PUBLIC_BASE_URL', required: false, description: 'Base URL for the application' },
  { name: 'ALLOWED_ORIGIN', required: false, description: 'Allowed CORS origin' },
  { name: 'CRON_SECRET', required: false, description: 'Secret for cron job authentication', sensitive: true },
  { name: 'OPENAI_API_KEY', required: false, description: 'OpenAI API key for AI features', sensitive: true },
  { name: 'GOOGLE_GEMINI_API_KEY', required: false, description: 'Google Gemini API key', sensitive: true },
];

interface ValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validate all required environment variables.
 * 
 * @returns Validation result with missing/warning lists
 */
export function validateEnv(): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];
    
    if (envVar.required && !value) {
      missing.push(`${envVar.name} - ${envVar.description}`);
    } else if (!envVar.required && !value) {
      warnings.push(`${envVar.name} - ${envVar.description} (optional)`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Validate environment and throw if missing required variables.
 * Call this during app initialization.
 * 
 * @throws Error if required env vars are missing
 */
export function assertEnv(): void {
  const result = validateEnv();
  
  if (!result.valid) {
    const message = [
      '❌ Missing required environment variables:',
      ...result.missing.map(m => `  - ${m}`),
      '',
      'Please set these in your .env.local file or Coolify environment settings.',
    ].join('\n');
    
    console.error(message);
    throw new Error(`Missing required environment variables: ${result.missing.map(m => m.split(' - ')[0]).join(', ')}`);
  }

  // Log warnings in development
  if (process.env.NODE_ENV !== 'production' && result.warnings.length > 0) {
    console.warn('⚠️ Optional environment variables not set:', result.warnings.map(w => w.split(' - ')[0]).join(', '));
  }
}

/**
 * Get a required environment variable.
 * Throws if not set.
 * 
 * @param name - Environment variable name
 * @returns The value
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Get an optional environment variable with a default value.
 * 
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns The value or default
 */
export function getEnv(name: string, defaultValue: string = ''): string {
  return process.env[name] || defaultValue;
}

/**
 * Check if we're in production mode.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if we're in development mode.
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Log environment status (without exposing sensitive values).
 * Useful for debugging deployment issues.
 */
export function logEnvStatus(): void {
  console.log('=== Environment Status ===');
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  
  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];
    const status = value 
      ? (envVar.sensitive ? '✓ (set)' : `✓ ${value.substring(0, 20)}${value.length > 20 ? '...' : ''}`)
      : (envVar.required ? '✗ MISSING' : '○ not set');
    
    console.log(`${envVar.name}: ${status}`);
  }
  
  console.log('========================');
}
