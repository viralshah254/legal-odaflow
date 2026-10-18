# Umbrella — Backend

NestJS API: auth, AI gateway, billing, marketplace, jobs.

## Quick start

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

Starts **both** the API (`nest start --watch`) and background **job workers** (meeting transcription, OCR, notifications, etc.). You should see `[api]` and `[worker]` lines in the terminal.

**Production is unchanged** — Docker runs `node dist/main.js` (API) and `node dist/jobs/workers/worker.main.js` (worker) as separate services. Only local `npm run dev` / `npm run start:dev` use `concurrently`.

API-only (no workers): `npm run dev:api`

API: `http://localhost:4000/api/v1/health`

## Legal forms catalog (Find & Draft)

After reseeding the forms catalog, embed forms for semantic search:

```bash
npm run legal-forms:embed
```

`legal-forms:reseed` runs embed automatically unless `LEGAL_FORMS_SKIP_EMBED=true`. Requires `OPENAI_API_KEY` and `AI_ENABLE_RAG=true`.

See monorepo [DEV-WORKFLOW.md](https://github.com/viralshah254/legal-odaflow/blob/main/DEV-WORKFLOW.md) for full local stack (Postgres, Redis, worker).
