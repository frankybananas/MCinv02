# MCinv02 - Car Inventory Management System

> A full-stack Progressive Web App for automotive dealerships to manage inventory, clients, deliveries, and marketing with AI-powered vehicle matching.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://htg.lotlynx.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)

<!-- Add screenshot after taking one -->
<!-- ![Dashboard Screenshot](docs/screenshots/dashboard.png) -->

## ✨ Features

### Core Functionality
- 🚗 **Car Inventory Management** - Full CRUD with multi-image upload, status tracking (In-Stock → Coming → Reserved → Sold), and complete audit logs
- 👥 **Client Management** - Customer database with interaction history, notes, and user-isolated data
- 📦 **Delivery Tracking** - Document management, recon task checklists, finance bank tracking, and completion workflows
- 📱 **PWA Support** - Installable mobile app with offline-capable features

### Security & Authentication
- 🔐 **OTP Authentication** - SMS-based login via Twilio with progressive rate limiting (exponential backoff)
- 🛡️ **Role-Based Access Control** - Four-tier system (Admin → Manager → Recon → User) with granular permissions
- 🔒 **Security Hardening** - JWT in HttpOnly cookies, CORS restrictions, input validation, audit logging

### AI & Automation
- 🤖 **AI Vehicle Matching** - OpenAI embeddings + Qdrant vector search to match client requests with inventory
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
| **Backend** | Next.js API Routes (47+ endpoints), Edge Middleware |
| **Database** | MongoDB 6.17 with Mongoose 8.16 ODM |
| **Authentication** | JWT (jose), Twilio Verify SMS OTP |
| **Storage** | Cloudflare R2 (S3-compatible), Sharp image processing |
| **AI/ML** | OpenAI Embeddings (text-embedding-3-small), Qdrant Vector DB |
| **Testing** | Jest 29, React Testing Library, mongodb-memory-server |
| **DevOps** | GitHub Actions, Coolify (self-hosted PaaS) |

## 📁 Project Structure

```
├── app/
│   ├── api/              # 47+ API routes
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
│   ├── auth-session.ts   # JWT session handling
│   ├── rbac.ts           # Role-based access control
│   ├── validation.ts     # Input sanitization
│   ├── rate-limit.ts     # Progressive rate limiting
│   └── ...
├── models/               # 18 MongoDB schemas
├── middleware.ts         # Edge auth + role enforcement
├── __tests__/            # Jest test suites
└── docs/                 # Technical documentation
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20.x or higher
- pnpm 8.x or higher
- MongoDB instance (local or Atlas)
- Twilio account with Verify service
- Cloudflare R2 bucket (or S3-compatible storage)

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

See [`.env.example`](.env.example) for all required and optional variables.

**Required:**
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for signing JWTs (min 32 chars)
- `TWILIO_*` - Twilio credentials for OTP
- `R2_*` - Cloudflare R2 storage credentials

**Optional:**
- `OPENAI_API_KEY` - For AI vehicle matching
- `GOOGLE_GEMINI_API_KEY` - For content generation

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
```

## 🏗️ Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **MongoDB over PostgreSQL** | Flexible schema accommodates varied vehicle specifications without migrations |
| **JWT in HttpOnly cookies** | Stateless auth without localStorage XSS vulnerability |
| **OTP over passwords** | Mobile-first UX, eliminates password management burden |
| **OpenAI embeddings** | Semantic vehicle matching beyond keyword search |
| **Edge middleware** | Auth checks at edge for faster response times |
| **Progressive rate limiting** | Exponential backoff prevents brute force without blocking legitimate users |

## 📚 Documentation

- [Architecture Overview](docs/main-integration-spec.md)
- [Authentication & Security](docs/AUTH-SECURITY-AUDIT.md)
- [Feature Specifications](docs/)
- [API Reference](docs/API.md) *(coming soon)*

## 🔒 Security

This application implements several security measures:

- **Authentication**: JWT tokens with 7-day expiry, HttpOnly cookies, SameSite=Strict
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
