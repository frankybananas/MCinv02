import { S3Client } from '@aws-sdk/client-s3';

/**
 * Cloudflare R2 S3-compatible client
 * 
 * Required environment variables:
 * - R2_ENDPOINT: The R2 API endpoint
 * - CLOUDFLARE_ACCESS_KEY_ID: R2 access key
 * - CLOUDFLARE_SECRET_ACCESS_KEY: R2 secret key
 */

// Validate required environment variables at module load
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const ACCESS_KEY_ID = process.env.CLOUDFLARE_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.CLOUDFLARE_SECRET_ACCESS_KEY;

if (!R2_ENDPOINT || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  throw new Error(
    'Cloudflare R2 credentials are not set in the environment variables. ' +
    'Required: R2_ENDPOINT, CLOUDFLARE_ACCESS_KEY_ID, CLOUDFLARE_SECRET_ACCESS_KEY'
  );
}

export const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});
