# Umbrella

Dual-sided AI legal super platform — consumer legal guidance, lawyer OS, and marketplace bridge.

## Repositories

| Folder | Stack | Purpose |
|--------|-------|---------|
| [`legal_web/`](legal_web/) | Next.js 14, TypeScript, Tailwind, shadcn/ui | Public site, consumer dashboard, lawyer OS, admin console |
| [`legal_backend/`](legal_backend/) | NestJS, Prisma, PostgreSQL, Redis, BullMQ | APIs, auth, AI gateway, billing, jobs |
| [`legal_app/`](legal_app/) | Flutter | Consumer + lawyer mobile app |

**Spec:** [`PRODUCTION-SPEC.md`](legal_web/public/docs/PRODUCTION-SPEC.md)

See **[DEV-WORKFLOW.md](legal_web/public/docs/DEV-WORKFLOW.md)** for full setup, env files, and smoke checks.

> **Real API only:** Set `NEXT_PUBLIC_USE_MOCK_DATA=false` in `legal_web/.env.local`. The web app proxies to the NestJS backend — there is no mock API layer in production paths.

### 1. Infrastructure

```bash
docker compose up -d
```

Starts PostgreSQL (with pgvector) on `5432` and Redis on `6379`.

### 2. Backend

```bash
cd legal_backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run start:dev
```

In a **second terminal**, start the background worker (required for OCR, embeddings, long AI jobs, and report generation):

```bash
cd legal_backend
npm run start:worker
```

API: http://localhost:4000  
Health: http://localhost:4000/api/v1/health

### 3. Web

```bash
cd legal_web
cp .env.local.example .env.local
npm install
npm run dev
```

Web: http://localhost:3000

### 4. Mobile

```bash
cd legal_app
flutter pub get
flutter run
```

## Environment

- Web: `legal_web/.env.example` → `.env.local`
- Backend: `legal_backend/.env.example` → `.env`
- App: `legal_app/.env.example` (via `--dart-define` or config)

## Development workflow

1. Implement a small slice in backend → web → app
2. Start Redis + worker alongside the API (`npm run start:worker`)
3. Run lint/build: `npm run lint && npm run build` (web/backend), `flutter analyze` (app)
4. Smoke-test wired flows end-to-end with `NEXT_PUBLIC_USE_MOCK_DATA=false`
5. Commit incrementally

## Coverage tiers

| Tier | Jurisdictions | What users get |
|------|---------------|----------------|
| **Deep** | India (IN), United States (US), Kenya (KE), United Kingdom (GB) | Hand-authored profiles, statute/case connectors, citation-gated verified research |
| **Best-effort** | All other countries (e.g. Uganda) | Common-law/civil-law framing, live web where configured, analytical/doctrine mode when local RAG is thin |

Marketing “available globally” means the product runs worldwide; it does **not** mean equal primary-law depth everywhere. Deep tiers expand as connectors and corpora land (see `legal_backend/corpus/ug/README.md` for the Uganda plan).
