# Deployment Guide (Dev ➜ Production)

This document tracks actions and settings needed when moving from localhost/dev to production.

## 1) Environment Variables (server)
- __JWT_SECRET__: long, random string (rotate on prod). Do NOT reuse dev secret.
- __MONGODB_URI__: production MongoDB cluster (with IP allow-list + auth).
- __TWILIO_ACCOUNT_SID__, __TWILIO_AUTH_TOKEN__, __TWILIO_VERIFY_SERVICE_SID__: production Twilio Verify service.
- __R2_PUBLIC_URL__: publicly accessible base URL for car images (Cloudflare R2 custom/public URL).

Store these securely (platform secrets manager). Never commit to git.

## 2) Domains and HTTPS
- Use the final production domain (e.g., `https://inventory.example.com`).
- Ensure HTTPS is active (certs/managed SSL). Web Share API requires HTTPS (or localhost).
- Update any app configs referencing origin if needed.

## 3) CORS for R2 Image Hosting (Required for image sharing)
Images are fetched as blobs in the browser to attach as files via Web Share API. Your R2 bucket must allow cross-origin GET.

- In Cloudflare Dashboard ➜ R2 ➜ Your bucket ➜ Settings ➜ CORS ➜ Add rule:
```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-prod-domain.com"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range", "Content-Type"],
    "ExposeHeaders": ["Content-Length", "Content-Type", "Accept-Ranges"],
    "MaxAgeSeconds": 86400
  }
]
```
- For quick testing you can temporarily use `"AllowedOrigins": ["*"]`.
- If serving via a Worker/custom domain, return CORS headers on image responses:
  - `Access-Control-Allow-Origin: http://localhost:3000` (and prod domain)
  - `Access-Control-Allow-Methods: GET, HEAD`
  - `Access-Control-Allow-Headers: Range, Content-Type`
  - `Access-Control-Expose-Headers: Content-Length, Content-Type, Accept-Ranges`

## 4) WhatsApp/Image Sharing Specifics
- Mobile browsers (iOS Safari/Android Chrome) support Web Share with files. Desktop may not.
- The app shares images in batches (up to 30 files per share sheet) and then opens WhatsApp with a text message.
- Ensure R2 CORS works; otherwise, images won’t attach and only text will send.

## 5) Cookie/Session Considerations
- Session cookie: `session_token` (HTTP-only). Confirm cookie domain/path for prod.
- Daily OTP: enforced by `otpDay` in JWT; middleware checks per-request in ZA timezone (Africa/Johannesburg).

## 6) Timezone
- Primary usage timezone is Africa/Johannesburg. Verify any server/container TZ or rely on explicit toLocaleString timezone usage (already implemented in middleware).

## 7) Logging & Monitoring
- Add server logs (API routes) to your platform logging. Consider alerting for 4xx/5xx spikes.
- Track OTP failures and Twilio errors.

## 8) Security Checklist
- Ensure all admin-only APIs protected (middleware role check).
- Rotate `JWT_SECRET` if compromised.
- MongoDB user with least privilege; IP allow-list.
- Twilio keys stored as secrets.

## 9) Pre-Flight Testing
- Test login/OTP with production Twilio service.
- Test Web Share on real phones over HTTPS domain.
- Test image sharing with many files (CORS OK, multiple batches).
- Test daily OTP expiry across midnight (ZA timezone).

## 10) Rollback
- Keep previous deployment available for quick rollback.
- Back up database before migrations.

## 11) Post-Launch
- Verify favicon/manifest assets resolve under the production domain.
- Verify image load performance (R2 public bucket or CDN in front).
- Confirm admin flows and permissions.

---

# Contabo VPS + Coolify Deployment Steps

These steps assume a fresh Contabo Cloud VPS and Coolify managing Dockerized apps with Traefik as reverse proxy.

## A) Server bootstrap
- __Provision VPS__: Ubuntu 22.04/24.04, 2+ vCPU, 4+ GB RAM.
- __DNS__: Create an A record for your domain to the VPS public IP, e.g.:
  - `inventory.example.com` ➜ A ➜ <your-vps-ip>
  - Optional: use Cloudflare DNS to manage records/SSL. Keep “proxied” enabled if you want Cloudflare in front.
- __Firewall__: Allow 80, 443 (HTTP/HTTPS). SSH restricted to your IP(s).

## B) Install Coolify
- Follow Coolify docs (one-liner install). It sets up Docker + Traefik and a dashboard.
- Point your browser to the VPS hostname/IP and finish setup.

## C) App deployment in Coolify
- __Add Resource__ ➜ __Application__ ➜ __Git Repository__ (connect GitHub or provide repo URL).
- __Build__: Node 20 LTS base image.
  - Build command: `npm ci && npm run build`
  - Start command: `npm run start`
  - Exposed port: `3000`
  - Set `NODE_ENV=production`, `NEXT_TELEMETRY_DISABLED=1`.
- __Environment variables__: add all from the “Environment Variables” section of this doc.
- __Domains__:
  - Attach `https://inventory.example.com` in Coolify. Traefik will provision Let’s Encrypt TLS automatically.
  - Ensure DNS A record exists and propagated.
- __Resources__: No persistent volumes required for the Next.js server itself; MongoDB and R2 are external.

## D) MongoDB (managed/external)
- Use a managed MongoDB (e.g., Atlas) or self-hosted instance (managed backups recommended).
- Update `MONGODB_URI` in Coolify environment.
- Allow the VPS IP in MongoDB network access.

## E) Image CDN (R2 + Cloudflare)
- __R2 bucket__: store car images.
- __Public access__: Create an R2 custom/public domain (Cloudflare). Point `images.example.com` (CNAME) per Cloudflare instructions.
- __CORS__: apply the JSON rule in the section above for localhost and your prod domain.
- __Caching/CDN__: In Cloudflare, create a Cache Rule to cache `images.example.com/*` aggressively with a long TTL. Optionally add a Worker for fine-grained headers or resizing later.

## F) Logging & Monitoring
- __App logs__: View in Coolify per deployment (Docker logs). Set retention in the platform.
- __Centralized logs (optional)__: deploy a managed Loki stack or use a SaaS (e.g., Logtail/Datadog). Configure shipping with a sidecar/agent.
- __Metrics/uptime__: add an uptime monitor (e.g., Uptime Kuma) pinging `https://inventory.example.com/`.
- __Twilio__: monitor Verify errors; consider webhooks or alerts.

## G) Rollback Strategy
- __Immutable builds__: tag releases (e.g., `v1.0.0`). Coolify builds images per commit.
- __Rollback__: in Coolify, redeploy a previous commit/image tag.
- __Database backups__: schedule daily `mongodump` to offsite storage (S3/R2). Test restore with `mongorestore`.
- __R2__: enable object versioning (optional) or keep local originals.

Example backup via cron (Coolify - Cronjob service):
```
# Environment variables to set in the cron job:
# MONGODB_URI, BACKUP_DIR, RETAIN_DAYS, (optional) UPLOAD_TO_R2, R2_BUCKET, R2_ENDPOINT,
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, R2_PREFIX

# Run every day at 02:10 UTC
10 2 * * * /bin/bash /app/scripts/backup-mongo.sh >> /var/log/backup-mongo.log 2>&1
```
The script lives at `scripts/backup-mongo.sh`. Ensure it’s executable (`chmod +x`).

## H) Security hardening
- __JWT secret rotation__: plan a rotation window; log out sessions if needed.
- __Traefik__: auto HTTPS via Let’s Encrypt; force HTTPS redirection enabled by default.
- __Headers__: Next.js already sets sane defaults; consider adding `Content-Security-Policy` later.
- __Admin guard__: already enforced in `middleware.ts` by role.

## I) Build/Runtime specifics for this repo
- Next.js `15.2.4`. `next.config.mjs` sets `images.unoptimized=true` and exposes API CORS for `*` under `/api/*`.
- Start with `npm run start` (serves on port 3000). Ensure Coolify maps 443 ➜ Traefik ➜ 3000.
- Requires Node 20 runtime.
- OTP via Twilio Verify; ensure correct production Verify Service SID.

## K) Cloudflare DNS and Cache Rules (examples)

__DNS__ (Cloudflare):
- `inventory.example.com` ➜ A ➜ `<VPS_IP>` (Proxy: on if you want CF in front)
- `images.example.com` ➜ CNAME ➜ R2/CF public hostname (as provided by Cloudflare)

__Cache Rule__ (Cloudflare):
- If Hostname matches `images.example.com`
- Then: Cache level = Cache everything; Edge TTL = 7d; Browser TTL = 1d (tune as needed)

## L) Cloudflare Worker for R2 CORS (optional)

A Worker template is provided at `workers/r2-cors-worker.js`. Two options:
- Bind R2 bucket as `ASSETS` and serve objects with proper CORS headers.
- Or set `PUBLIC_R2_BASE` to proxy an existing public domain and add CORS headers.

Deploy with Wrangler:
```
wrangler init r2-cors
# Edit wrangler.toml to bind R2 or set vars
wrangler deploy
```
Then route `images.example.com/*` to the Worker in Cloudflare.

## J) Pre-prod checklist (Coolify)
- __Env vars__: set all, double-check values.
- __Build__: succeeds on Node 20.
- __Health__: homepage loads over HTTPS, no console errors.
- __Auth__: OTP flow works end-to-end with Verify Service (SMS arrives, verify succeeds).
- __Sharing__: On a real phone over HTTPS domain, images attach and text opens in WhatsApp.

## M) GitHub Actions & Coolify CI/CD Integration

The repository includes an automated CI/CD pipeline (`.github/workflows/ci.yml`) that runs typechecking, linting, 545 unit/integration tests, and production build checks on every push and pull request.

### Setting up CI-Gated Deploy to Coolify:
1. In your Coolify dashboard, navigate to your **MCinv02 Application** -> **Webhooks**.
2. Copy the **Deploy Webhook** URL (e.g., `https://your-coolify-domain.com/api/v1/deploy?uuid=...`).
3. In your GitHub repository, go to **Settings** -> **Secrets and variables** -> **Actions**.
4. Click **New repository secret**:
   - **Name**: `COOLIFY_WEBHOOK_URL`
   - **Value**: paste the Coolify Deploy Webhook URL.
5. Whenever you push to `main`, GitHub Actions will first run all quality checks and tests. Only when they all pass will it automatically trigger Coolify to pull and redeploy the latest code.

