# Feature Analysis & Product Capabilities

## Executive Summary
MCinv02 (branded as "LotLynx") is a mobile-first, AI-powered dealership management system designed for high-velocity sales teams. Unlike legacy desktop-bound DMS platforms, this solution is built as a Progressive Web App (PWA) to empower sales agents on the floor.

## Core Pillars

### 1. Intelligent Inventory Management
*   **Real-time Stock List**: Instant access to vehicle details, pricing, and status (In Stock, Reserved, Sold).
*   **Media Pipeline**: Multi-image uploads with automatic optimization, resizing, and storage via Cloudflare R2.
*   **Status Lifecycle**: Strict state management ensuring accurate availability tracking across the team.
*   **"Do Not Advertise" Control**: Granular control over which stock is pushed to public marketing channels.

### 2. AI-Powered Demand Matching (Unique Selling Proposition)
*   **Natural Language Parsing**: Uses Google Gemini AI to translate messy client notes (e.g., "looking for a white hilux under 400k") into structured database queries.
*   **Automated Matching Engine**: Background processes constantly cross-reference new stock against client requests.
*   **Scoring System**: Transparent "Match Score" (0-100) helps sales agents prioritize hot leads.
*   **Proactive Notifications**: Alerts agents when a new car matches one of their client's needs.

### 3. Integrated CRM (Client Relationship Management)
*   **User Isolation**: Security model where agents own their client data, preventing friction in competitive sales floors.
*   **Interaction History**: Timeline of calls, notes, and preferences.
*   **Structured "Looking For" Requests**: Multi-criteria demand tracking per client.

### 4. Marketing Automation
*   **WhatsApp Status Generator**: One-click generation of professional, composed images with price/details overlay, optimized for WhatsApp Status sharing (a primary sales channel in this market).
*   **Facebook Integration (Ready-to-Deploy)**: Database models and Authentication infrastructure are in place for direct-to-Facebook posting. *Note: UI and final posting logic are specified but require final implementation.*

### 5. Delivery & Recon Tracking
*   **Automated Workflows**: Converting a car to "Reserved" automatically triggers a delivery record.
*   **Reconditioning Tracking**: Track repair tasks (mag repairs, paint, service) needed before handover.
*   **Financial & Admin**: Track payment proof, finance applications, and invoicing status.

### 6. Security & Operations
*   **Role-Based Access Control (RBAC)**: Granular permissions for Admin, Manager, Sales, and Recon roles.
*   **Device Security**: OTP-based login with device session management (7-day strict re-auth).
*   **Audit Logging**: Comprehensive tracking of login events and sensitive actions.

## Development Maturity
*   **Test Coverage**: Extensive unit and integration testing suite (Jest).
*   **Documentation**: Professional-grade documentation for all major features (Architecture, API, Deployment).
*   **CI/CD Ready**: Configured for automated testing and deployment.
