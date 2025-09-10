# MCinv02 Deployment and Security Guide (Contabo Cloud VPS)

This guide walks you through deploying MCinv02 on a Contabo Cloud VPS and securing it for production mobile and desktop usage. It summarizes the third‑party services used, required environment variables, recommended infrastructure, and step‑by‑step instructions tailored to this repository.


## Third‑Party Services Used

- MongoDB (database)
  - Code references: `lib/mongodb.ts`, `models/*`
  - Packages: `mongodb`, `mongoose`
- Cloudflare R2 (object storage for images)
  - Code references: `lib/s3.js`, `app/api/uploads/route.ts`, `workers/r2-cors-worker.js`
  - Packages: `@aws-sdk/client-s3`
- Twilio Verify (SMS OTP for authentication)
  - Code references: `app/api/auth/otp/send/route.ts`, `app/api/auth/otp/verify/route.ts`
  - Packages: `twilio`, `libphonenumber-js`
- JWT and crypto
  - Code references: `middleware.ts`, `app/api/auth/otp/verify/route.ts`
  - Packages: `jose`, `uuid`
- Next.js + React + Tailwind UI libs (core framework and UI)
  - Code references: throughout app
  - Packages: `next`, `react`, `tailwindcss`, `@radix-ui/*`, `lucide-react`


## Environment Variables (Production)

Set these securely on your server or platform (do not commit to git):

- JWT_SECRET: Long random string for signing JWTs
- MONGODB_URI: Mongo connection string (Atlas or self‑hosted)
- TWILIO_ACCOUNT_SID: Twilio account SID
- TWILIO_AUTH_TOKEN: Twilio auth token
- TWILIO_VERIFY_SERVICE_SID: Twilio Verify Service SID
- R2_ENDPOINT: Cloudflare R2 S3 endpoint (e.g. https://<account>.r2.cloudflarestorage.com)
- CLOUDFLARE_ACCESS_KEY_ID: R2 access key id
- CLOUDFLARE_SECRET_ACCESS_KEY: R2 secret access key
- R2_BUCKET: R2 bucket name
- R2_PUBLIC_URL: Public base URL where uploaded images are served (e.g. https://images.example.com)
- NODE_ENV: production
- NEXT_TELEMETRY_DISABLED: 1

Where these are used:
- Mongo: `lib/mongodb.ts` expects `MONGODB_URI`
- Twilio: `app/api/auth/otp/send/route.ts` and `app/api/auth/otp/verify/route.ts` expect Twilio envs
- R2: `lib/s3.js` expects `R2_ENDPOINT`, `CLOUDFLARE_ACCESS_KEY_ID`, `CLOUDFLARE_SECRET_ACCESS_KEY`; `app/api/uploads/route.ts` expects `R2_BUCKET`, `R2_PUBLIC_URL`
- JWT: middleware and OTP verify route expect `JWT_SECRET`


## Recommended Server Setup (Contabo + Docker/Coolify)

You can deploy with any process manager, but Coolify (Docker + Traefik) on Contabo is simple and robust.

1) Provision VPS
- Ubuntu 22.04/24.04, 2+ vCPU, 4+ GB RAM.
- DNS: Create an A record (e.g., inventory.example.com) to your VPS IP.
- Firewall: Allow 80, 443. Restrict SSH to your IP(s).

2) Install Coolify (optional but recommended)
- Follow Coolify one-liner install. It sets up Docker and Traefik with automatic TLS.
- Access the Coolify dashboard and finish setup.

3) MongoDB
- Use MongoDB Atlas or a managed Mongo instance (recommended). Add your VPS IP to its allow‑list.
- Set `MONGODB_URI` in your app environment.

4) Cloudflare R2 for images
- Create an R2 bucket for car images.
- Configure a public/custom domain (e.g. images.example.com) via Cloudflare.
- Set CORS for images (see “CORS and R2” below).
- Capture credentials and set env variables listed above.

5) Twilio Verify for OTP
- Create a Twilio Verify Service, note its Service SID.
- Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`.


## Using Twilio Verify (Coolify setup)

This app uses Twilio Verify for OTP. Follow this checklist when deploying with Coolify.

### Environment variables to set (Coolify → Application → Environment Variables)

- `TWILIO_ACCOUNT_SID` (required)
- `TWILIO_AUTH_TOKEN` (required)
- `TWILIO_VERIFY_SERVICE_SID` (required)
- `JWT_SECRET` (required)
- `MONGODB_URI` (required)
- `NODE_ENV=production` (recommended)
- `NEXT_TELEMETRY_DISABLED=1` (optional)

Do not set the Messaging Service variables (`TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_FROM_NUMBER`) for Verify. They are not needed.

### Where to set in Coolify

1. Open your app in Coolify.
2. Go to `Environment` → `Environment Variables`.
3. Add each key/value exactly as above (one per row).
4. Save and redeploy.

### Testing steps (production URL over HTTPS)

1. Navigate to your production domain (e.g., `https://inventory.example.com`). Ensure the browser shows a lock icon (no red cross).  
2. Enter an authorized phone number (must exist in your `User` collection; stored and used in E.164 format like `+27721234567`).  
3. You should receive an SMS from Twilio Verify with a code.  
4. Enter the code on the OTP screen and verify.  

Notes:
- Twilio Verify composes the SMS; it may not be origin-bound, so WebOTP autofill usually will not trigger. Manual entry remains supported.  
- The WebOTP hints remain in the UI but are best‑effort only with Verify.

### Troubleshooting

- __Server configuration error on Send OTP__  
  Check that `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID` are present. In non‑production, the API may return which variable is missing in the `detail` field; otherwise inspect server logs in Coolify.

- __No SMS or Verify errors in Twilio Console__  
  - Ensure the Verify Service is active and the destination country is allowed.  
  - Confirm Twilio’s geo permissions for SMS to the target region.  
  - Ensure your Twilio account has sufficient balance/credit.

- __Login page shows a red cross / Not Secure__  
  - The app must be served over valid HTTPS. Attach a real domain and let Coolify/Traefik issue a Let’s Encrypt certificate.  
  - Avoid using raw IPs; certificates don’t validate against bare IPs.  
  - Eliminate mixed content (all assets must load over HTTPS).  
  - WebOTP requires a secure context; without a proper lock icon, OTP autofill and some features may not work.

- __“Invalid phone number”__  
  - The app validates with `libphonenumber-js` (defaults ZA). Enter in international format or with a leading `+` and country code.  
  - Ensure the same normalized E.164 number exists in `User`.

- __Verify approves but login still fails__  
  - Check server logs for JWT creation errors and confirm `JWT_SECRET` is set.  
  - Confirm cookies are allowed; the app sets `session_token` (HttpOnly, Secure in production).


## Build and Run Commands (pnpm)

- Install dependencies: `pnpm install`
- Development: `pnpm run dev`
- Build: `pnpm run build`
- Start: `pnpm run start` (serves on port 3000)

If using Coolify:
- Base image: Node.js 20 LTS
- Build command: `pnpm install --frozen-lockfile && pnpm run build`
- Start command: `pnpm run start`
- Exposed/Internal port: 3000
- Set environment variables in Coolify’s UI


## Domain and HTTPS

- Attach your domain (e.g., https://inventory.example.com) to the app.
- If using Coolify/Traefik, automatic Let’s Encrypt TLS is configured.
- Production app requires HTTPS for best mobile Web Share behavior.

### Domain and HTTPS (Cloudflare + Coolify)

Follow these steps to get a valid lock icon and stable HTTPS when using Cloudflare in front of Coolify/Traefik.

1) Add your domain to Cloudflare and point nameservers
- Add `yourdomain.tld` to Cloudflare.
- At your registrar, change nameservers to the two Cloudflare nameservers Cloudflare provides.
- Wait for Cloudflare to show the domain as Active.

2) Create DNS records (start as DNS-only, gray cloud)
- A record for your app host:
  - Name: `app` (serves `https://app.yourdomain.tld`)
  - Type: `A`
  - Value: Your VPS IPv4
  - Proxy status: DNS only (gray)
- Optional root + www:
  - `@` → A → VPS IPv4 (DNS only)
  - `www` → CNAME → `@` (DNS only)

3) Configure the domain in Coolify
- In your application → Domains: add the host you’ll use (e.g., `app.yourdomain.tld`).
- Enable “Force HTTPS”.
- Redeploy. Traefik should obtain a Let’s Encrypt certificate via HTTP‑01 because records are DNS‑only.

4) Verify the HTTPS lock
- Visit `https://app.yourdomain.tld` on desktop and mobile.
- You should see a proper lock icon. If not:
  - Ensure ports 80/443 are open on the VPS/firewall.
  - Keep Cloudflare DNS records as DNS only (gray) until Let’s Encrypt is issued.
  - Check DevTools Console for Mixed Content warnings; all assets must be loaded over HTTPS.

5) (Optional) Enable Cloudflare proxy after cert issuance
- Turn the orange cloud (Proxy) on for the A/CNAME you want proxied.
- Cloudflare → SSL/TLS → set SSL mode to “Full (strict)”.
- Re‑verify the site is secure with a lock icon.

Cloudflare settings checklist
- SSL/TLS
  - Mode: Full (strict) when proxying.
  - Always Use HTTPS: On (optional; Traefik already redirects).
  - HSTS: Optional; enable only after HTTPS is fully working.
- Caching
  - Avoid caching HTML. Default “Standard” is fine.
- Speed
  - Auto Minify: optional.
  - Rocket Loader: recommend Off for React/Next.js.
- Security
  - WAF/Bot settings: start conservative; tighten later if needed.
  - Disable features like Email Obfuscation for the app host.

DNSSEC
- Optional. Not required for HTTPS/WebOTP.
- If enabled, Cloudflare will show a DS record to paste at your registrar.

Mixed content notes
- Certificates must match the domain; avoid raw IPs.
- Every asset (images, fonts, scripts) must be requested via `https://`.

Optional app environment variable
- Consider adding `APP_URL=https://app.yourdomain.tld` in Coolify to standardize absolute URLs if you introduce emails or external links later.


## Authentication and Sessions

- OTP via Twilio Verify. The `send` route validates authorized numbers and initiates an OTP.
- The `verify` route checks the OTP and issues a JWT stored in the HTTP‑only cookie `session_token`.
- `middleware.ts` enforces:
  - Daily OTP (ZA timezone) via `otpDay` claim in JWT
  - Role guard for admin paths (non‑admins redirected to `/`)
- Ensure `JWT_SECRET` is set and periodically rotated.


## CORS and R2

App serves and shares images from R2. Ensure cross‑origin GET is allowed or use the Worker.

Option A: R2 CORS (Dashboard → R2 → Bucket → CORS)
- AllowedOrigins: your app domains (http://localhost:3000, https://inventory.example.com)
- AllowedMethods: GET, HEAD
- AllowedHeaders: Range, Content-Type
- ExposeHeaders: Content-Length, Content-Type, Accept-Ranges

Option B: Cloudflare Worker (`workers/r2-cors-worker.js`)
- Bind R2 bucket as `ASSETS` or set `PUBLIC_R2_BASE` and add CORS headers in responses.
- Deploy with Wrangler and route your image domain (e.g. images.example.com/*) to the worker.

Set `R2_PUBLIC_URL` to your image base domain so the upload API returns public URLs correctly.


## File Uploads Pipeline

- Route: `app/api/uploads/route.ts`
- Behavior:
  - Accepts `multipart/form-data` with field `file`
  - If `R2_BUCKET` and `R2_PUBLIC_URL` are set, uploads to R2 using `@aws-sdk/client-s3` with the S3-compatible `S3Client` from `lib/s3.js`
  - Fallback in dev: saves to `public/uploads` locally if R2 envs are not present

Checklist:
- Confirm `R2_ENDPOINT`, keys, bucket and public URL.
- Ensure CORS is configured for your app domain(s).


## Security Hardening Checklist

- JWT and Cookies
  - `JWT_SECRET` set to strong random value, rotate periodically
  - `session_token` cookie is `HttpOnly` and `Secure` in production
  - `sameSite: lax` to reduce CSRF risk

- Principle of least privilege
  - MongoDB user with minimal roles for this database
  - R2 access keys restricted to the one bucket (if possible)

- Secrets management
  - Store all env vars in the platform’s encrypted secret store or server’s .env readable only by the app user
  - Never commit secrets to git

- Network and TLS
  - Force HTTPS; redirect HTTP to HTTPS at the reverse proxy level
  - If using Cloudflare in front, enable proxying and set cache rules for `images.example.com`

- CORS
  - Restrict AllowedOrigins to specific prod domains where possible

- Logging and Monitoring
  - Stream server logs from your platform (Coolify → logs)
  - Monitor Twilio Verify errors/rate; consider alerting
  - Uptime monitor (e.g., Uptime Kuma) for app URL

- Rate limiting (optional enhancement)
  - Add per-IP rate limiting on OTP routes to mitigate abuse

- Backups
  - Use `scripts/backup-mongo.sh` to schedule daily `mongodump` backups; optionally upload to R2 (see below)


## Database Backups (cron)

Script: `scripts/backup-mongo.sh`
- Requirements: `mongodump`, `tar`, `gzip` (and `awscli` v2 if uploading to R2)
- Env vars:
  - Required: `MONGODB_URI`
  - Optional: `BACKUP_DIR` (default /var/backups/mcinv), `RETAIN_DAYS` (default 7)
  - Optional R2 upload: `UPLOAD_TO_R2=true`, `R2_BUCKET`, `R2_ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `R2_PREFIX`
- Example cron (UTC):
  - `10 2 * * * /bin/bash /app/scripts/backup-mongo.sh >> /var/log/backup-mongo.log 2>&1`


## Deploy Steps Summary (Coolify on Contabo)

1) Connect repo in Coolify as an Application
2) Configure build:
   - Node 20 base image
   - Build: `pnpm install --frozen-lockfile && pnpm run build`
   - Start: `pnpm run start`
   - Port: 3000
   - Environment variables: In the Coolify application configuration, navigate to the "Environment Variables" section and add each environment variable as a key-value pair (e.g., `JWT_SECRET=your_secret`). Refer to the “Environment Variables (Production)” section above for the required variables.
3) Attach domain: `https://inventory.example.com`
4) Point DNS A record to VPS IP; wait for propagation
5) Set up MongoDB allow‑list for VPS IP and validate `MONGODB_URI`
6) Configure R2 bucket + public domain + CORS or Worker
7) Configure Twilio Verify service in production and test OTP
8) Deploy; verify `/` loads over HTTPS with no console errors


## Mobile Testing Checklist

- iOS Safari / Android Chrome over production HTTPS domain
- Login with real number authorized in your Users collection
- Verify OTP via SMS arrives and `verify` succeeds
- Upload car images; ensure image URLs resolve from `R2_PUBLIC_URL`
- Share images using Web Share (test multiple selected images)
- Confirm daily OTP behavior (logout/relogin on next day ZA time)
- Validate role restrictions: non‑admin blocked from `/admin` paths


## Troubleshooting

- OTP send fails
  - Check Twilio credentials and Verify Service SID
  - Confirm the phone number exists in `User` collection and is in E.164 format

- Uploads fail
  - Check `R2_*` envs present and correct
  - Check R2 bucket CORS and that `R2_PUBLIC_URL` is the domain where images are publicly available

- Mongo connection errors
  - Ensure VPS IP is allow‑listed in MongoDB
  - Verify `MONGODB_URI` and network reachability

- CORS errors in console fetching images
  - Validate CORS headers (R2 CORS or Worker)
  - Confirm AllowedOrigins include your production domain


## References in Repo

- Mongo: `lib/mongodb.ts`
- R2 client: `lib/s3.js`
- Upload API: `app/api/uploads/route.ts`
- Twilio OTP: `app/api/auth/otp/send/route.ts`, `app/api/auth/otp/verify/route.ts`
- JWT and middleware: `middleware.ts`
- Worker template: `workers/r2-cors-worker.js`
- Existing deployment notes: `deploy.md`

## Authoritative References (Up-to-date)

- Next.js
  - Deployment: https://nextjs.org/docs/app/building-your-application/deploying
  - Production checklist: https://nextjs.org/docs/app/building-your-application/optimizing/production-checklist
  - Middleware: https://nextjs.org/docs/app/building-your-application/routing/middleware

- MongoDB / Mongoose
  - MongoDB Node.js Driver: https://www.mongodb.com/docs/drivers/node/current/
  - Mongoose Docs: https://mongoosejs.com/docs/

- Twilio Verify (SMS OTP)
  - Verify API Overview: https://www.twilio.com/docs/verify/api
  - Twilio Node Helper Library: https://www.twilio.com/docs/libraries/node

- AWS SDK for JavaScript v3 (S3 Client)
  - S3 Client Docs: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/
  - SDK v3 Guide: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/welcome.html

- Cloudflare R2 and Workers
  - R2 Overview: https://developers.cloudflare.com/r2/
  - R2 CORS: https://developers.cloudflare.com/r2/buckets/cors/
  - Workers Docs: https://developers.cloudflare.com/workers/
  - Wrangler (CLI): https://developers.cloudflare.com/workers/wrangler/
