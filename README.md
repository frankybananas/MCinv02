# MCinv02 - Car Inventory Management System

> A full-stack Progressive Web App for automotive dealerships to manage inventory, clients, deliveries, and marketing with AI-powered vehicle matching.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://htg.lotlynx.app)
[![CI](https://github.com/frankybananas/MCinv02/actions/workflows/ci.yml/badge.svg)](https://github.com/frankybananas/MCinv02/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)

## ✨ Features

### Core Functionality
- 🚗 **Car Inventory Management** - Full CRUD with multi-image upload (Cloudflare R2), status tracking (In-Stock → Coming → Reserved → Sold), and audit logs
- 👥 **Client Management** - Customer database with interaction history and structured “Looking For” requests (user-isolated)
- 📦 **Delivery Tracking** - Deliveries auto-created when a car is reserved, with recon tracking and completion workflows
- 📱 **PWA Support** - Installable mobile app (standalone)

### Security & Authentication
- 🔐 **OTP Authentication** - SMS-based login via Twilio with progressive rate limiting (exponential backoff)
- 🛡️ **Role-Based Access Control** - Four-tier system (Admin → Manager → Recon → User) with granular permissions
- 🔒 **Security Hardening** - JWT in HttpOnly cookies, CORS restrictions, input validation, audit logging

### AI & Automation
- 🤖 **AI Vehicle Matching** - Gemini AI (gemini-1.5-flash) parses natural language into filters, then a weighted scoring engine matches against inventory (cron-driven)
- 📊 **Smart Notifications** - Automated alerts for new matches, delivery deadlines, and status changes
- 🧹 **Automated Cleanup** - 30-day archive system for sold cars with image preservation

### Marketing Tools
- 📲 **WhatsApp Sharing** - Generate shareable car listings for WhatsApp Status
- 🏷️ **Do Not Advertise** - Flag cars to exclude from marketing materials
- 📈 **Marketing Dashboard** - Dedicated view for marketing-enabled users

## 🛠️ Tech Stack

| Category | Technologies |
|----------|-------------|
| **Frontend** | Next.js 15, React 19, TypeScript 5, Tailwind CSS, shadcn/ui, Radix UI |
| **Backend** | Next.js API Routes (53 endpoints), Edge Middleware |
| **Database** | MongoDB 6.17 with Mongoose 8.16 ODM |
| **Authentication** | JWT (jose), Twilio Verify SMS OTP |
| **Storage** | Cloudflare R2 (S3-compatible) via AWS SDK, Sharp image processing |
| **AI/ML** | Google Gemini (gemini-1.5-flash) via @google/generative-ai, deterministic scoring |
| **Testing** | Jest 29, React Testing Library, mongodb-memory-server |
| **DevOps** | GitHub Actions, Coolify (self-hosted PaaS) |

## 📁 Project Structure

```
├── app/
│   ├── api/              # 53 API routes
│   │   ├── auth/         # OTP send/verify, session management
│   │   ├── cars/         # CRUD, status changes, image upload
│   │   ├── clients/      # Client management, requests
│   │   ├── deliveries/   # Delivery tracking, documents
│   │   └── admin/        # User management, storage monitoring
│   ├── components/       # 25+ React components
│   │   ├── dashboard.tsx # Main inventory view
│   │   ├── car-detail.tsx
│   │   ├── delivery-detail.tsx
│   │   └── ...
│   └── types.ts          # TypeScript interfaces
├── lib/
│   ├── ai/               # Gemini AI parser & client
│   ├── matching/         # Vehicle match engine & scoring
│   ├── etoyota/          # eToyota sync integration
│   ├── auth-session.ts   # JWT session handling
│   ├── rbac.ts           # Role-based access control
│   ├── validation.ts     # Input sanitization
│   ├── rate-limit.ts     # Progressive rate limiting
│   └── ...
├── components/           # shadcn/ui primitives + theme provider
├── models/               # 22 MongoDB schemas
├── middleware.ts         # Edge auth + role enforcement
├── __tests__/            # Jest test suites
├── scripts/              # Admin scripts, migrations, MongoDB backup
├── workers/              # Cloudflare R2 CORS worker
└── docs/                 # Technical documentation
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x or higher
- pnpm 8.x or higher
- MongoDB instance (local or Atlas)
- Twilio account with Verify service
- Cloudflare R2 bucket (or S3-compatible storage)
- (Optional) Google Gemini API key (for AI matching)
- (Optional) Facebook App credentials (for Facebook integration)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mcinv02.git
cd mcinv02

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Environment Variables

Start with [`.env.example`](.env.example):

```bash
cp .env.example .env.local
```

Then set the following (grouped by feature).

**Core (required):**

- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for signing JWTs (min 32 chars)

**Twilio Verify (required for login):**

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`

**Cloudflare R2 (required for car images):**

- `R2_PUBLIC_URL` - Public base URL where images are served from
- `R2_BUCKET_NAME` - Bucket name used for car images (e.g. `pictures/...`)
- `R2_ENDPOINT` - S3 endpoint (e.g. `https://<accountId>.r2.cloudflarestorage.com`)
- `CLOUDFLARE_ACCESS_KEY_ID` - R2 access key
- `CLOUDFLARE_SECRET_ACCESS_KEY` - R2 secret key

Note: some legacy docs/env templates refer to `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`; the current S3 client uses `CLOUDFLARE_ACCESS_KEY_ID`/`CLOUDFLARE_SECRET_ACCESS_KEY`.

**Cron jobs (required if enabled):**

- `CRON_SECRET` - Bearer token used to authenticate scheduled job endpoints

**AI Vehicle Matching (required for parsing/matching):**

- `GOOGLE_GEMINI_API_KEY`

**Facebook integration (optional):**

- `NEXT_PUBLIC_BASE_URL` - Public app URL (used for OAuth callbacks)
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `FACEBOOK_TOKEN_ENCRYPTION_KEY` - 64 hex characters (32 bytes)
- `FACEBOOK_GRAPH_API_VERSION` - Optional (defaults to `v18.0`)

**Other optional:**

- `ALLOWED_ORIGIN` - API CORS allowlist (defaults to `https://htg.lotlynx.app`)
- `NEXT_PUBLIC_APP_VERSION` - Exposed app version (defaults to `package.json`)

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# With coverage report
pnpm test:coverage

# CI mode (for pipelines)
pnpm test:ci

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## ⏱️ Scheduled Jobs (Cron)

This repo exposes HTTP endpoints intended to be called by Coolify/cron-job.org/etc.

- **AI matching**: `POST /api/cron/match-requests` (also supports `GET`)
  - Header: `Authorization: Bearer ${CRON_SECRET}`
  - Recommended schedule: `*/2 * * * *`
- **Sold car cleanup**: `POST /api/admin/cleanup-sold-cars`
  - Header: `Authorization: Bearer ${CRON_SECRET}`
  - Recommended schedule: `0 2 * * *`
- **Session cleanup**: `GET /api/cron/cleanup-sessions`
  - No auth in code: restrict access at the platform/edge
  - Recommended schedule: daily

## 🏗️ Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **MongoDB over PostgreSQL** | Flexible schema accommodates varied vehicle specifications without migrations |
| **JWT in HttpOnly cookies** | Stateless auth without localStorage XSS vulnerability |
| **OTP over passwords** | Mobile-first UX, eliminates password management burden |
| **Gemini AI JSON parsing** | Converts natural language “Looking For” notes into structured filters |
| **Deterministic scoring (0-100)** | Keeps matching explainable and avoids a vector database dependency |
| **Cron-driven background processing** | Scheduled endpoints handle parsing/matching and cleanup (Coolify cron) |
| **Edge middleware** | Auth checks at edge for faster response times |
| **Progressive rate limiting** | Exponential backoff prevents brute force without blocking legitimate users |

## 📚 Documentation

- [Architecture Overview](docs/main-integration-spec.md)
- [Authentication & Security](docs/AUTH-SECURITY-AUDIT.md)
- [AI Vehicle Matching System](docs/ai-vehicle-matching-system/00-QUICK-START.md)
- [Storage Monitoring & Cleanup (Deployment)](docs/DEPLOYMENT-STORAGE-SYSTEM.md)
- [Deployment Notes](deploy.md)
- [Employer Overview](docs/EMPLOYER-OVERVIEW.md)
- [All Documentation](docs/)

## 🔒 Security

This application implements several security measures:

- **Authentication**: JWT tokens with 7-day expiry, HttpOnly cookies, SameSite=Lax
- **Rate Limiting**: MongoDB-backed rate limiting for OTP endpoints with progressive blocking
- **Input Validation**: Zod schemas, ObjectId validation, string sanitization
- **RBAC**: Centralized permission system with role hierarchy
- **Audit Logging**: All authentication events logged for compliance

See [AUTH-SECURITY-AUDIT.md](docs/AUTH-SECURITY-AUDIT.md) for the full security analysis.

## 🤝 Contributing

This is a portfolio project. Feel free to fork and adapt for your own use.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with ❤️ using Next.js, TypeScript, and MongoDB**
