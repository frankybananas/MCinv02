# MCinv02 (LotLynx Inventory) — Employer Overview

**Project type**: Full-stack Progressive Web App (PWA) for automotive dealerships

**Live environment**: https://htg.lotlynx.app

---

## Summary

MCinv02 (branded in-app as **LotLynx**) is a mobile-first dealership operations app that helps sales teams manage:

- **Vehicle inventory** (with images, status changes, and searchable metadata)
- **Clients** (with interaction history and structured “looking for” requests)
- **Deliveries** (recon tasks, document tracking, and ownership-based visibility)
- **Marketing workflows** (WhatsApp sharing, marketing-only access, “Do Not Advertise” controls)
- **Automation** (cron-driven jobs for matching, cleanup, and operational maintenance)

The project demonstrates end-to-end product development: UI/UX, API design, persistence, authentication, authorization, background processing, cloud storage, testing, and CI.

---

## What the app does (end-user workflows)

### 1) Authenticate quickly on mobile
- **OTP login** via SMS using Twilio Verify.
- **7-day device sessions** using a JWT in an HttpOnly cookie (PWA-friendly).

### 2) Manage car inventory
- **Create and edit cars** (make/model/year/price/specs/notes).
- **Multi-image upload** with server-side processing and cloud storage.
- **Status lifecycle** for operational flow (e.g., in-stock → coming → reserved → sold).

### 3) Manage clients and capture demand
- **Client CRUD** with user isolation.
- **Interaction history** and notes.
- **Structured “Looking For” requests** per client (multiple requests supported).

### 4) Match client requests to stock (AI-assisted)
- Users can enter free-text requirements (example: “White Corolla Cross 2020+ under R480k”).
- **Gemini AI parsing** structures that free text into filters.
- A **deterministic scoring engine** evaluates each available car and creates matches above a threshold.
- Matches surface through **badges, lists, and notifications**.

### 5) Track deliveries and recon
- When a car is marked **reserved**, a **delivery record is created automatically**.
- Deliveries support recon tracking, document management, and scheduled milestones.

### 6) Marketing tools
- **Marketing page access is controlled per-user** (feature gate).
- **WhatsApp sharing** generates shareable content suitable for WhatsApp Status.
- **Do Not Advertise** flag prevents specific vehicles from showing up in marketing workflows.

### 7) Admin and operational tooling
- **User management** (create/update/delete, roles, feature flags).
- **Storage monitoring** and **automated cleanup** to reduce cost and keep the system performant.

---

## Key features (highlights)

- **Full-stack Next.js app** using the App Router with route handlers (API endpoints) and Edge middleware.
- **Mobile-first UI** built with React, TypeScript, TailwindCSS, and Radix/shadcn UI primitives.
- **Secure auth** (Twilio OTP + JWT HttpOnly cookie sessions).
- **RBAC** with role hierarchy (`user`, `recon`, `manager`, `admin`) and permission checks.
- **User isolation (multi-tenancy)** so users only see their own clients/requests/deliveries.
- **Cloud media pipeline** (image upload, resizing, thumbnails, storage in Cloudflare R2).
- **Background automation** via authenticated cron endpoints.
- **AI-assisted matching** (Gemini parsing + explainable scoring instead of opaque vector search).
- **Comprehensive automated testing** (Jest + React Testing Library + mongodb-memory-server).
- **CI pipeline** (typecheck, lint, test, build) using GitHub Actions with `pnpm`.

---

## Architecture (high level)

### System components
- **Frontend**: Next.js 15 + React 19 (TypeScript)
- **Backend**: Next.js Route Handlers (API routes)
- **Database**: MongoDB + Mongoose
- **Storage**: Cloudflare R2 (S3-compatible) for images and documents
- **Auth provider**: Twilio Verify (SMS OTP)
- **AI provider**: Google Gemini (gemini-1.5-flash) for request parsing
- **Background jobs**: Coolify cron calling secured API endpoints (Bearer token)

### Data flow (typical request)
```
Client (PWA/Web) -> Next.js UI
                -> Next.js API Route Handler
                -> MongoDB (primary data)
                -> R2 (images/documents)
                -> External services (Twilio / Gemini) when needed

Coolify Cron -> /api/cron/* (Bearer CRON_SECRET) -> MongoDB updates + automation
```

---

## Security and access control

- **Authentication**
  - OTP verification via Twilio.
  - JWT session stored as **HttpOnly cookie** (reduces XSS exposure).
  - PWA-friendly cookie configuration (`sameSite: 'lax'`).

- **Rate limiting / abuse prevention**
  - Progressive OTP blocking with escalating cooldown windows.

- **Authorization**
  - Centralized RBAC utilities.
  - Role-gated admin and recon capabilities.
  - Marketing access controlled via a per-user feature flag.

- **Tenant isolation**
  - Clients and requests are isolated using a per-user identifier (e.g., `createdByPhone`).
  - Deliveries are isolated per salesperson.

- **Operational security**
  - Cron endpoints require a server-side `CRON_SECRET`.
  - CORS restricted via `ALLOWED_ORIGIN` configuration.

---

## Reliability and engineering practices

- **Testing**
  - Unit and integration tests for API routes and UI components.
  - In-memory MongoDB for deterministic test runs.

- **CI**
  - GitHub Actions pipeline runs:
    - TypeScript typecheck
    - ESLint
    - Jest test suite + coverage
    - Next.js build

- **Observability**
  - Structured auth/audit logging for security-relevant events.

---

## What I built (scope of work)

- **End-to-end product implementation**
  - Implemented the full stack: UI, API routes, database models, and integrations.

- **Authentication and security hardening**
  - Built OTP authentication with session management and device/session controls.
  - Added progressive rate limiting and security event logging.
  - Implemented RBAC and role-gated admin functionality.

- **Core domain modules**
  - Inventory management (CRUD + images + status lifecycle).
  - Client management + structured “Looking For” requests.
  - Delivery tracking with automatic delivery creation when inventory status changes.

- **Automation**
  - Implemented cron-driven processing for matching and maintenance workflows.

- **AI integration (practical and explainable)**
  - Integrated Gemini to convert free-text requirements into structured filters.
  - Implemented a scoring-based matching engine that is transparent and testable.

- **Quality and maintainability**
  - Built a significant automated test suite.
  - Added CI checks to keep the codebase stable.

---

## Links

- **Live demo**: https://htg.lotlynx.app
- **Codebase**: (add your repository URL here)
- **Additional specs**:
  - `docs/ai-vehicle-matching-system/`
  - `docs/facebook-posting-feature/` (design/spec work)

---

## Tech stack (detailed)

- **Frontend**
  - Next.js 15, React 19, TypeScript
  - TailwindCSS, shadcn/ui, Radix UI

- **Backend**
  - Next.js Route Handlers
  - MongoDB + Mongoose

- **Integrations**
  - Twilio Verify (OTP)
  - Cloudflare R2 (S3-compatible storage)
  - Google Gemini (AI parsing)

- **Testing / tooling**
  - Jest, React Testing Library, mongodb-memory-server
  - ESLint
  - GitHub Actions CI
