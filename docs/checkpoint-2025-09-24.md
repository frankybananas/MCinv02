# MCinv02 Checkpoint — 2025-09-24

This document captures the current state of the codebase and deployment so a new LLM/teammate can continue seamlessly.

## 1) High-level status

- The app (Next.js 15.2.4) is deployed at: https://htg.lotlynx.app
- Vector DB is Qdrant, deployed in Coolify as a Service (not publicly exposed)
- We added a built-in diagnostics endpoint to verify Qdrant connectivity: `/api/diagnostics/qdrant`
- We implemented an Admin toggle to enable/disable the matching engine per user and enforced it in APIs.

## 2) Recent feature changes (code pointers)

- **Quick input examples popover**
  - File: `app/components/client-request-quick.tsx`
  - Behavior: when the input is focused and empty, a popover shows example queries; it hides as soon as the user types; clicking an example fills the input.

- **Quick parser enhancements**
  - File: `app/components/client-request-quick.tsx`
  - Added SA-specific brand/model detection; color/body-type parsing and synonyms; summary now includes colors/body types.

- **Request creation resilience**
  - File: `app/api/clients/[id]/requests/route.ts`
  - Embedding, vector upsert, and vector search are wrapped in try/catch so a request saves even if OpenAI/Qdrant are unavailable.

- **Qdrant diagnostics endpoint**
  - File: `app/api/diagnostics/qdrant/route.ts`
  - Steps:
    - GET `QDRANT_URL/readyz`
    - `ensureCollections()` for `cars` and `client_requests`
    - Round-trip: upsert a dummy request vector and search it back
  - Success JSON shows: readyz ok, ensureCollections ok, roundTrip ok

- **Admin toggle for Matching**
  - API: `app/api/admin/users/route.ts`
    - Added `PATCH` to update `matchingEnabled` (admin-only).
  - UI: `app/components/admin/user-list.tsx`
    - Matching column with a checkbox toggle; updates via PATCH and reloads list.
  - Enforcement:
    - Requests POST: `app/api/clients/[id]/requests/route.ts` — gates embeddings/vector ops for non-privileged users if `matchingEnabled === false`.
    - Matches GET: `app/api/clients/[id]/matches/route.ts` — returns `[]` for non-privileged users if matching disabled.

## 3) Environment variables (required)

Set these in Coolify for the MCinv application:

- `MONGODB_URI` — Mongo connection
- `JWT_SECRET` — session validation (auth APIs rely on this)
- `OPENAI_API_KEY` — required for embeddings and explanations
- `OPENAI_EMBEDDING_MODEL` — defaults to `text-embedding-3-small`
- `OPENAI_EMBEDDING_DIM` — should be `1536`
- `OPENAI_REASONING_MODEL` — defaults to `gpt-4o-mini`
- `QDRANT_URL` — internal hostname for the Qdrant service, e.g. `http://qdrant:6333` or the exact service name Coolify shows (e.g. `http://qdrant-<stack-id>:6333`)
- `QDRANT_API_KEY` — set if Qdrant requires it (same key you configured on Qdrant)

Local dev tips (Windows): `curl.exe http://localhost:6333/readyz` or `iwr http://localhost:6333/readyz` (PowerShell alias warning).

## 4) Coolify networking (how MCinv reaches Qdrant)

- Qdrant is a Service, MCinv is an Application.
- Application views don’t show a "Service Stack" panel; they are auto-attached to the server’s default Docker network.
- Ensure both MCinv and Qdrant are on the same Coolify Server (host).
- In Qdrant → Configuration → Service Stack:
  - Copy the Service Name. Optionally add a Network Alias `qdrant`.
- In MCinv env:
  - Set `QDRANT_URL` to `http://qdrant:6333` (if alias set) or to `http://<service-name>:6333`.
- Redeploy MCinv and verify at `https://htg.lotlynx.app/api/diagnostics/qdrant`.

## 5) How to verify Qdrant is working (prod)

1. In Coolify, confirm both services are on the same server and Qdrant is running.
2. In MCinv env, set a reachable internal `QDRANT_URL` and the correct `QDRANT_API_KEY` (if required) and `OPENAI_EMBEDDING_DIM=1536`.
3. Redeploy MCinv.
4. Hit `/api/diagnostics/qdrant` on the live app — should return `{ ok: true, steps: [...] }` with all steps ok.

## 6) Current known items / next steps

- Confirm Qdrant internal DNS hostname from Coolify and update `QDRANT_URL` accordingly (alias `qdrant` recommended).
- Once diagnostics is green, test creating a Quick request with matching enabled to see matches populate.
- Optional: add a small Admin Diagnostics card that fetches `/api/diagnostics/qdrant` and displays health.
- Optional: add strict payload filters (e.g., color/body-type) to `lib/vector-store.ts` search if you want hard constraints beyond embeddings.

## 7) Quick examples the UI shows now

- White/silver only Toyota Hilux 2020+ under R450k
- Looking for Cross, min year 2022, max budget R480k (Toyota present → Corolla Cross; VW present → T‑Cross)
- Any silver SUV under 300k
- Kia Seltos 2021+, white only
- P‑Series bakkie, 2022+, under R500k
- Haval Jolion white, 2023+
- Hyundai i20 or Grand i10, 2020+, hatch

## 8) Key files touched recently

- `app/components/client-request-quick.tsx`
- `app/api/clients/[id]/requests/route.ts`
- `app/api/clients/[id]/matches/route.ts`
- `app/api/diagnostics/qdrant/route.ts`
- `app/api/admin/users/route.ts`
- `app/components/admin/user-list.tsx`
- `lib/embeddings.ts`, `lib/vector-store.ts`

## 9) Support notes

- User isolation: non-admin/manager users are restricted by `createdByPhone`; see existing patterns in clients, deliveries, and matches.
- Matching can be toggled off per user; privileged roles bypass the toggle.
- When embedding or vector store calls fail, we still create the request and log errors.
