# Production Smoke Test Results

**Run date:** 2026-06-23 (post Phase 9 deploy)  
**Environment:** Production (`umbrella.okaylegal.ai`, `legal-api.odaflow.com`)  
**Deploy:** `legal_backend` `3f8bf3c`, `legal_web` `0c29993`, `legal_app` `46c7414` pushed to `main`

Status key: **PASS** | **FAIL** | **BLOCKED** (needs auth/device) | **PARTIAL**

## Automated probes (unauthenticated)

Script: `./scripts/post-deploy-smoke.sh`  
**Result: 11/11 PASS** (2026-06-23, re-run after deploy push)

| Check | Result | Evidence |
|-------|--------|----------|
| `GET /api/v1/health` | **PASS** | HTTP 200 |
| `GET /api/v1/health/readiness` | **PASS** | HTTP 200 (DB, Redis, AI configured) |
| Web issue checker | **PASS** | HTTP 200 |
| Web sign-in | **PASS** | HTTP 200 |
| Web pricing | **PASS** | HTTP 200 |
| Public issue-checker schema | **PASS** | HTTP 200 |
| Web admin dashboard | **PASS** | HTTP 200 |
| Web app dashboard | **PASS** | HTTP 200 |
| API pricing plans | **PASS** | HTTP 200 |
| `GET /api/v1/search/unified?q=test` (no auth) | **PASS** | HTTP 401 — route exists, auth enforced |
| Auth login route | **PASS** | POST with empty body returns 400/401/422 |

## Authenticated probes

Script: `./scripts/post-deploy-smoke-auth.sh`  
**Result: BLOCKED** — requires `TEST_EMAIL`, `TEST_PASSWORD`, optional `TEST_TENANT_ID`, `TEST_MATTER_ID`

```bash
TEST_EMAIL=... TEST_PASSWORD=... \
  API_URL=https://legal-api.odaflow.com \
  ./scripts/post-deploy-smoke-auth.sh
```

| Check | Result | Notes |
|-------|--------|-------|
| Auth login → JWT | **BLOCKED** | No test credentials in CI env |
| Unified search (auth) | **BLOCKED** | Needs firm JWT |
| Outcome benchmarks | **BLOCKED** | Needs JWT + `TEST_MATTER_ID` |
| Integration sync retry | **BLOCKED** | Needs JWT + OAuth-connected provider |

## Post-deploy checklist (QA-MATRIX lines 145–170)

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Apply migration | **PARTIAL** | `20260623180000_invoice_metadata` in deploy commit; run `npm run prisma:migrate deploy` on Swarm host after image rollout |
| 2 | Seed | **BLOCKED** | Requires deploy shell access |
| 3 | Start Redis + worker | **PARTIAL** | Readiness shows Redis ok; worker not exposed via HTTP — verify `docker service ps legal_worker` on host |
| 4 | Backend health | **PASS** | Automated probe |
| 5 | Unified search (auth) | **BLOCKED** | Needs test account |
| 6 | Outcome benchmarks (auth) | **BLOCKED** | Needs test account + matter |
| 7 | Integration retry (auth) | **BLOCKED** | Needs test account |
| 8 | Web: sign-up → matter → automation | **BLOCKED** | Manual E2E |
| 9 | Web: research citations | **BLOCKED** | Manual E2E |
| 10 | Web: global search badges | **BLOCKED** | Manual E2E |
| 11 | Web: outcome vs firm average | **BLOCKED** | Manual E2E |
| 12 | Web: integrations sync log + retry | **BLOCKED** | Manual E2E; real OAuth sync shipped in deploy |
| 13 | Web: portal client upload | **BLOCKED** | Manual E2E |
| 14 | Web: legal-forms → issue checker | **BLOCKED** | Manual E2E |
| 15 | Web: portal invoice pay | **BLOCKED** | Manual E2E |
| 16–22 | Mobile checks | **BLOCKED** | Requires device + test accounts |
| 23 | End-to-end full funnel | **BLOCKED** | Manual E2E |
| 24 | Admin: dashboard + AI costs | **BLOCKED** | Requires SUPER_ADMIN session |

**Verified count:** 4 PASS + 2 PARTIAL + 18 BLOCKED (automated unauthenticated suite green)

## Deploy verification

| Item | Status |
|------|--------|
| Backend pushed to `main` | **DONE** (`3f8bf3c`) |
| Web pushed to `main` | **DONE** (`0c29993`) → Vercel redeploy |
| Mobile portal fix pushed | **DONE** (`46c7414`) |
| Swarm `prisma migrate deploy` | **PENDING** on production host |
| Swarm worker replica | **PENDING** verify on host |

## Code shipped in this deploy

- Prod fail-closed: eSign, AI mocks, OCR, outcome analytics
- Integration OAuth sync service (replaces stub-only path)
- Clio migration job persistence via `AgentJob` + web polling
- OpenSearch dual-write: `search.index` worker, firm-entity indexing, unified search fallback
- Milestone/contingency invoice metadata + web create flow
- Contract tests: `integrations-sync.spec.ts`, expanded `ai-credits.spec.ts`
- Smoke scripts: fixed 401 expectation + auth script

## Remaining manual verification

Run blocked rows with firm lawyer, consumer, and SUPER_ADMIN test accounts after Swarm migration + worker confirm.
