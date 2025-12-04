import { S3Client } from '@aws-sdk/client-s3';

/**
 * Cloudflare R2 S3-compatible client
 * 
 * Required environment variables:
 * - R2_ENDPOINT: The R2 API endpoint
 * - CLOUDFLARE_ACCESS_KEY_ID: R2 access key
 * - CLOUDFLARE_SECRET_ACCESS_KEY: R2 secret key
 */

let _s3Client: S3Client | null = null;

/**
 * Get the S3 client instance (lazy initialization)
 * Throws if required environment variables are not set
 */
export function getS3Client(): S3Client {
  if (_s3Client) {
    return _s3Client;
  }

  const R2_ENDPOINT = process.env.R2_ENDPOINT;
  const ACCESS_KEY_ID = process.env.CLOUDFLARE_ACCESS_KEY_ID;
  const SECRET_ACCESS_KEY = process.env.CLOUDFLARE_SECRET_ACCESS_KEY;

  if (!R2_ENDPOINT || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error(
      'Cloudflare R2 credentials are not set in the environment variables. ' +
      'Required: R2_ENDPOINT, CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY'
    );
  }

  _s3Client = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  });

  return _s3Client;
}

// Export a getter for backward compatibility
// Note: This will throw on first access if env vars are missing
export const s3 = new Proxy({} as S3Client, {
  get(_, prop) {
    return Reflect.get(getS3Client(), prop);
  },
});
