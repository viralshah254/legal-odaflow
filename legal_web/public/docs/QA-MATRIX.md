# QA Matrix — Transformation Spec

Status key: `[x]` verified in CI or manual smoke; `[ ]` not yet verified.

## Phases 0–5 (operational plan)

### Phase 0 — Platform wiring
- [x] Web app source of truth in `legal_web/` (root `app/` duplicate removed)
- [x] Reports page wired to `GET /analytics/reports/firm`
- [x] Queues page wired to `GET /analytics/queues/work`
- [x] Sidebar includes Documents, Trust, Automations, Reports
- [x] README documents worker process and real API (no mock)
- [x] `NEXT_PUBLIC_USE_MOCK_DATA=false` enforced in dev workflow

### Phase 1 — Core firm OS
- [x] Matter CRUD with timeline, documents, tasks, collaborators
- [x] Time tracking timers and entries API
- [x] Trust accounts with disbursement guard (no negative balance)
- [x] Billing/invoices and portal invoice pay flow
- [x] Client portal sign-in, progress, document requests, messages
- [x] Calendar events and task management
- [x] Matter playbooks CRUD UI
- [x] Pre-bill review and LEDES export
- [x] DMS version history and OCR full-text search UI

### Phase 2 — Operations & integrations
- [x] Automations rules engine (trigger + conditions + actions)
- [x] Integrations module (OAuth-ready; prod requires env credentials)
- [x] Calendar/email OAuth sync (Google/Outlook) — connect + sync log
- [x] Unified communications inbox (`/app/inbox`)
- [x] Webhook subscriptions + outbound delivery

### Phase 3 — Document automation & marketplace
- [x] Lawyer lead create/accept/reject/convert API
- [x] Consumer 15-section full report endpoint
- [x] Marketplace lawyer profiles and review requests
- [x] Document merge-field assembly engine
- [x] Marketplace payments E2E (revenue share ledger on review pay)

### Phase 4 — Court & legal intelligence
- [x] Court module: `CourtCase`, hearings, filings, docket entries
- [x] India eCourts CNR lookup stub (`POST /court/ecourts/lookup`)
- [x] US docket sync stub (`POST /court/us-docket/sync`)
- [x] Web court tab UI (`/app/matters/[id]/court`)
- [x] Live eCourts / CourtListener (env-gated; prod requires API keys)
- [x] Evidence vault chain-of-custody UI (`/evidence`, matter diligence tab)
- [x] SSO config on tenant (`ssoConfig` JSON) + settings page

### Phase 5 — Outcome analytics
- [x] `MatterOutcomeAnalysis` model and CRUD API
- [x] AI generation via `CASE_OUTCOME_ANALYSIS` task type
- [x] Web outcome page with bands, factors, portal publish
- [x] Firm reports: outcome analyses pending review count
- [x] Portal outcome summary endpoint (lawyer-approved only)
- [x] `OUTCOME-ANALYTICS.md` spec summary
- [x] Mobile outcome tab
- [x] Playwright E2E: matter → outcome → portal

## Series B — UX, AI, scale (Prompts 39–50)

### Phase 7 — UX excellence
- [x] Skip link + main landmark on app shell
- [x] Radix toast system (no `alert()` pattern)
- [x] Onboarding 6-step wizard (`/app/onboarding`)
- [x] Command palette create actions

### Phase 8 — Autonomous AI
- [x] Proactive morning brief API + copilot Insights tab
- [x] Copilot @agent orchestration
- [x] Unified search `GET /search/unified` + web entity badges
- [x] Firm outcome benchmarks API + vs firm average on outcome page

### Phase 9 — Scale & ecosystem
- [x] Integration retry dashboard (sync logs + manual retry)
- [x] Portal v2 partial: client document upload for doc requests
- [x] Consumer form library fill flow (`/legal-forms` → issue checker / generate)
- [x] OpenSearch migration path documented + abstraction (`OPENSEARCH-MIGRATION.md`, `search.index` worker, env-gated)
- [x] Migration BullMQ worker + Clio CSV importer (AgentJob persistence + web poll)
- [x] Integration + AI credit contract tests in CI
- [x] Advanced billing (contingency/milestone line items + metadata validation)

## Backend

- [x] Auth login/register and tenant-scoped access controls
- [x] Matter creation triggers playbook auto-tasks
- [x] Automation rules evaluate trigger + conditions + actions
- [x] Notifications inbox and mark-read endpoints
- [x] Trust disbursement refuses negative balance
- [x] Training consent defaults to DENIED
- [x] Training consent withdrawal revokes dataset items
- [x] Country compliance policies seeded (IN/US/KE/GB/EU)
- [x] AI credit ledger debits on gateway calls
- [x] Consumer full report (15 sections) endpoint
- [x] Matter brain aggregation endpoint
- [x] Lawyer lead create/accept/reject/convert

## Web (legal_web)

- [x] Automations page JSON builder: create/edit/enable rule
- [x] Research page: hybrid mode + keyword boost + citations panel
- [x] Copilot chat: citations panel renders source labels
- [x] LegalDisclaimer on consumer AI surfaces
- [x] Public terms / privacy / data-consent / legal-disclaimer pages
- [x] Firm + consumer data-consent settings pages
- [x] Consumer case report (15 sections) page
- [x] Consumer lawyer-review flow page
- [x] Matter strategy + opponent-analysis pages
- [x] Admin: compliance, costs, training-datasets, legal-sources, ai-logs, audit

## Mobile (legal_app)

- [x] Sign-in supports classic + Firebase flows
- [x] Lawyer bottom nav (home/matters/tasks/inbox) works
- [x] Matter detail tabs show timeline and documents
- [x] Lawyer tasks, alerts, time log screens load API data
- [x] Notifications inbox loads and mark-all-read works
- [x] Consumer portal shows progress/messages/payments cards
- [x] FCM foreground notification snackbar appears
- [x] LegalDisclaimer widget on consumer AI screens
- [x] Data consent + settings screens
- [x] Subscriptions screen lists plans and opens checkout WebView
- [x] Reports screen renders 15-section full report viewer
- [x] Lawyer review payment E2E (intent + checkout WebView)
- [x] Leads inbox accept/reject/convert actions
- [x] Matter AI chips call copilot API
- [x] Sentry initialized when `SENTRY_DSN` is set
- [x] Feature flags respected via `AppConfig`

## Release

- [x] Flutter analyze passes (CI)
- [x] Flutter unit tests pass (CI)
- [x] Flutter release APK builds (CI)
- [x] Seed script provisions multi-country tenants/lawyers/automations/compliance
- [x] Android release signing wired in `build.gradle.kts` (requires `key.properties`)
- [x] iOS production APNs entitlement in `Runner.entitlements`
- [x] Deployment runbook in DEPLOYMENT.md (incl. mobile section)
- [x] Backend + web production builds green (CI)
- [x] Contract tests pass (incl. mobile API paths)

## Post-deploy smoke (run against live env)

Run this checklist after each production deploy. Mark items only after manual verification against staging/production.

**Automated probe run (2026-06-23):** See [PROD-SMOKE-RESULTS.md](PROD-SMOKE-RESULTS.md).

- [ ] Apply migration: `npm run prisma:migrate deploy` in legal_backend (includes `20260623180000_invoice_metadata`)
- [ ] Seed: `npm run prisma:seed`
- [ ] Start Redis + worker: verify `legal_worker` replica on Swarm host
- [x] Backend health: `GET /api/v1/health` returns 200
- [x] Backend readiness: DB + Redis + AI providers ok (`GET /api/v1/health/readiness`)
- [x] Backend: unified search route protected (`GET /api/v1/search/unified?q=test` → 401 without auth)
- [ ] Backend: outcome benchmarks `GET /api/v1/matters/:id/outcome/benchmarks` (auth)
- [ ] Backend: integration retry `POST /api/v1/integrations/gmail/sync` (auth)
- [ ] Web: sign-up → create matter → automation rule visible
- [ ] Web: research query returns citations panel
- [ ] Web: global search shows entity type badges
- [ ] Web: matter outcome page shows vs firm average card
- [ ] Web: integrations settings shows sync log + retry button
- [ ] Web: portal client uploads document for doc request
- [ ] Web: `/legal-forms` → issue checker + generate draft links
- [ ] Web: portal invoice pay redirect (Stripe/Razorpay stub)
- [ ] Mobile: sign-in (consumer + lawyer test accounts)
- [ ] Mobile: issue checker → preview report → reports 15-section viewer
- [ ] Mobile: subscription checkout WebView loads
- [ ] Mobile: lawyer review pay + request submitted
- [ ] Mobile: lawyer leads accept → convert to matter
- [ ] Mobile: matter AI chip returns copilot response
- [ ] Mobile: push notification received on device (release/TestFlight build)
- [ ] End-to-end: sign-up → matter → agent job → notification → portal pay → consent toggle
