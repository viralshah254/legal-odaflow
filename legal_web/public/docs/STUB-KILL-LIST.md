# Stub & Mock Kill List

**Generated:** 2026-05-29  
**Scope:** `legal_backend/`, `legal_web/`, `legal_app/`  
**Search patterns:** `stub`, `mock`, `development_stub`, `ALLOW_MOCK`, `seti_mock`, `pi_mock`, `ecourts`, `us-docket-stub`  
**Owner roadmap:** Series A Competitive Parity Roadmap — Prompts **1–38**; Series B Dominance Roadmap — Prompts **39–50** (see [Prompt ownership index](#prompt-ownership-index))  
**Quality gates:** [PRODUCTION-DEFINITION-OF-DONE.md](PRODUCTION-DEFINITION-OF-DONE.md), `npm run check:no-mock` ([legal_backend/scripts/check-no-mock.sh](legal_backend/scripts/check-no-mock.sh))

---

## Summary

| Package | Production-path stubs | Dev-only / test | Indirect (consumes backend mocks) |
|---------|----------------------:|----------------:|----------------------------------:|
| `legal_backend` | 14 | 3 | — |
| `legal_web` | 2 | 1 | 2 |
| `legal_app` | 0 | 0 | 3 flows |

**Classification key**

| Class | Meaning |
|-------|---------|
| `must_be_live_in_prod` | Production must use real adapters; missing env must **fail** (or return explicit error), not synthetic data |
| `dev_only_ok` | Acceptable in local/staging when keys unset; must not ship misleading data to end users in prod |

---

## legal_backend

### AI gateway & policy

| File | Symbol / behavior | Live mode env vars | Owner prompt # | Class | QA-MATRIX |
|------|-------------------|-------------------|----------------|-------|-----------|
| [legal_backend/src/ai/ai-policy.service.ts](legal_backend/src/ai/ai-policy.service.ts) | `assertOpenAiConfigured()` — throws in prod if no key unless override | `OPENAI_API_KEY`, `NODE_ENV=production`, `ALLOW_MOCK_AI=false` (default) | **26**, **38** | `must_be_live_in_prod` | Backend AI gateway `[x]`; Post-deploy: research query |
| [legal_backend/src/ai/ai-policy.service.ts](legal_backend/src/ai/ai-policy.service.ts) | `shouldUseMockResponses()` — returns true when no key and (`NODE_ENV≠production` OR `ALLOW_MOCK_AI=true`) | `OPENAI_API_KEY`, `ALLOW_MOCK_AI` | **26**, **38** | `must_be_live_in_prod` | Same as above |
| [legal_backend/src/ai/ai-gateway.service.ts](legal_backend/src/ai/ai-gateway.service.ts) | `generateMockPreview()` — consumer issue checker / preview markdown with “Mock Legal Knowledge Base” citations | `OPENAI_API_KEY` (+ routing: `AI_*_MODEL`) | **26**, **38** | `must_be_live_in_prod` | Web: research + copilot `[x]`; Mobile: issue checker |
| [legal_backend/src/ai/ai-gateway.service.ts](legal_backend/src/ai/ai-gateway.service.ts) | `generateMockResearch()` — lawyer research memo stub | `OPENAI_API_KEY`, `AI_ENABLE_LEGAL_RESEARCH=true` | **26**, **27**, **38** | `must_be_live_in_prod` | Web: research citations `[x]` |
| [legal_backend/src/ai/ai-gateway.service.ts](legal_backend/src/ai/ai-gateway.service.ts) | Inline fallbacks: `provider: 'mock'`, `modelName: 'mock-matter-summary-v1'`, `mock-document-draft-v1`, `mock-{taskType}-v1` when OpenAI unavailable | `OPENAI_API_KEY` | **26**, **28**, **38** | `must_be_live_in_prod` | Matter AI tab; copilot |
| [legal_backend/src/health/health.service.ts](legal_backend/src/health/health.service.ts) | `getAiHealth()` message: “mock responses enabled” when key missing | `OPENAI_API_KEY` | **38** | `dev_only_ok` | Post-deploy: `GET /health` |

### Court & litigation

| File | Symbol / behavior | Live mode env vars | Owner prompt # | Class | QA-MATRIX |
|------|-------------------|-------------------|----------------|-------|-----------|
| [legal_backend/src/court/court.service.ts](legal_backend/src/court/court.service.ts) | `ecourtsLookup()` — `provider: 'ecourts-india-stub'` with synthetic parties/hearings; **prod throws** if `ECOURTS_API_URL` unset | `ECOURTS_API_URL` | **29** | `must_be_live_in_prod` | Phase 4: eCourts stub `[x]`; Live connectors `[ ]` |
| [legal_backend/src/court/court.service.ts](legal_backend/src/court/court.service.ts) | `usDocketSync()` — fallback entries `source: 'us-docket-stub'`, `STUB-DOCKET-001`, `provider: 'us-docket-stub'` when CourtListener returns nothing | `COURTLISTENER_API_TOKEN` or `COURTLISTENER_TOKEN` | **30** | `must_be_live_in_prod` | Phase 4: US docket stub `[x]`; Live connectors `[ ]` |
| [legal_backend/src/court/court.controller.ts](legal_backend/src/court/court.controller.ts) | `POST ecourts/lookup` — exposes stub/live behavior above | (via service) | **29** | `must_be_live_in_prod` | Web court tab `[x]` |

### Integrations

| File | Symbol / behavior | Live mode env vars | Owner prompt # | Class | QA-MATRIX |
|------|-------------------|-------------------|----------------|-------|-----------|
| [legal_backend/src/integrations/integrations.service.ts](legal_backend/src/integrations/integrations.service.ts) | `connect()` sets `config.mode: 'development_stub'` when OAuth env not configured; **prod throws** if OAuth missing | Per provider: `GOOGLE_OAUTH_*`, `MICROSOFT_*`, `ZOOM_*`, `DOCUSIGN_*`, `QUICKBOOKS_*` (see `OAUTH_ENV_KEYS`) | **16**, **17**, **19**, **20** | `must_be_live_in_prod` | Phase 2: integrations stub `[x]`; Calendar OAuth `[ ]` |

### Payments & subscriptions

| File | Symbol / behavior | Live mode env vars | Owner prompt # | Class | QA-MATRIX |
|------|-------------------|-------------------|----------------|-------|-----------|
| [legal_backend/src/payments/stripe.service.ts](legal_backend/src/payments/stripe.service.ts) | `createPaymentIntent()` — `pi_mock_*`, `cs_mock_*`, `mock: true` when `STRIPE_SECRET_KEY` empty | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | **7**, **21**, **25**, **38** | `must_be_live_in_prod` | Post-deploy: portal invoice pay |
| [legal_backend/src/payments/stripe.service.ts](legal_backend/src/payments/stripe.service.ts) | `createCustomer()` — `cus_mock_*` without secret key | `STRIPE_SECRET_KEY` | **7**, **25** | `must_be_live_in_prod` | Lawyer trial payment method |
| [legal_backend/src/payments/stripe.service.ts](legal_backend/src/payments/stripe.service.ts) | `createSetupIntent()` — `seti_mock_*` clientSecret / setupIntentId | `STRIPE_SECRET_KEY` | **7**, **25** | `must_be_live_in_prod` | Web: PlanUsagePanel (see web) |
| [legal_backend/src/payments/razorpay.service.ts](legal_backend/src/payments/razorpay.service.ts) | `createPaymentIntent()` — `order_mock_*`, `checkout.razorpay.com/mock/*` | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | **7**, **21**, **25**, **38** | `must_be_live_in_prod` | Post-deploy: portal invoice pay |
| [legal_backend/src/payments/mpesa.provider.ts](legal_backend/src/payments/mpesa.provider.ts) | `createPaymentIntent()` — `mpesa_mock_*`, `mock: true` when `MPESA_*` incomplete | `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL` | **7**, **25** | `must_be_live_in_prod` | Kenya payments (spec) |
| [legal_backend/src/subscriptions/subscriptions.service.ts](legal_backend/src/subscriptions/subscriptions.service.ts) | `createStripeCheckoutSession()` — `cs_mock_*`, fake checkout URL when no Stripe key | `STRIPE_SECRET_KEY`, `APP_URL` | **25**, **38** | `must_be_live_in_prod` | Mobile: subscription checkout WebView |
| [legal_backend/src/subscriptions/subscriptions.service.ts](legal_backend/src/subscriptions/subscriptions.service.ts) | `createCheckoutStub()` — deprecated alias → `createCheckout()` (no separate stub logic) | Same as checkout | **25** | `dev_only_ok` | Naming cleanup in **38** |

### OCR & documents

| File | Symbol / behavior | Live mode env vars | Owner prompt # | Class | QA-MATRIX |
|------|-------------------|-------------------|----------------|-------|-----------|
| [legal_backend/src/ocr/azure-ocr.service.ts](legal_backend/src/ocr/azure-ocr.service.ts) | `extractTextFromUrl()` returns `[OCR mock] Configure AZURE_OCR_*` string instead of extraction | `AZURE_OCR_ENDPOINT`, `AZURE_OCR_API_KEY` (code); `.env.example` also lists `AZURE_DOCUMENT_INTELLIGENCE_*` — align on deploy | **12** | `must_be_live_in_prod` | Phase 1: OCR full-text `[ ]` |
| [legal_backend/src/jobs/workers/ocr.worker.ts](legal_backend/src/jobs/workers/ocr.worker.ts) | Worker calls `azureOcr.extractTextFromUrl()` — inherits mock text into DB | Same as OCR service | **12** | `must_be_live_in_prod` | Document intelligence phase |

### Outcome analytics

| File | Symbol / behavior | Live mode env vars | Owner prompt # | Class | QA-MATRIX |
|------|-------------------|-------------------|----------------|-------|-----------|
| [legal_backend/src/matter-outcome/matter-outcome.service.ts](legal_backend/src/matter-outcome/matter-outcome.service.ts) | `buildMockAnalysis()` / `parseStructuredOutput()` fallback — heuristic bands when AI JSON parse fails | `OPENAI_API_KEY` (via `CASE_OUTCOME_ANALYSIS` gateway task) | **26**, **38** | `must_be_live_in_prod` | Phase 5 outcome `[x]`; Mobile outcome tab `[ ]` |

### Public API & migration

| File | Symbol / behavior | Live mode env vars | Owner prompt # | Class | QA-MATRIX |
|------|-------------------|-------------------|----------------|-------|-----------|
| [legal_backend/src/public-api/public-api.service.ts](legal_backend/src/public-api/public-api.service.ts) | `getHealth()` `version: '1.0.0-stub'` | Public API v1 release | **35** | `dev_only_ok` | Public API / webhooks `[ ]` |
| [legal_backend/src/public-api/public-api.service.ts](legal_backend/src/public-api/public-api.service.ts) | `testWebhook()` — “Webhook test stub” (no outbound delivery) | Webhook signing + queue (**35**) | **35** | `must_be_live_in_prod` | Automations webhooks `[ ]` |
| [legal_backend/src/public-api/issue-checker-schema.controller.ts](legal_backend/src/public-api/issue-checker-schema.controller.ts) | Static OpenAPI schema for Custom GPT (comment: “schema stub”) | Live public API + auth (**35**) | **35** | `dev_only_ok` | Consumer issue checker |
| [legal_backend/src/migration/migration.service.ts](legal_backend/src/migration/migration.service.ts) | Import job completes with “stub worker; connect BullMQ” | `REDIS_URL`, BullMQ workers | Post-**38** (MegaSpec Phase 5) | `dev_only_ok` | Support/migration gap |

### CI gate (meta)

| File | Symbol / behavior | Live mode env vars | Owner prompt # | Class | QA-MATRIX |
|------|-------------------|-------------------|----------------|-------|-----------|
| [legal_backend/scripts/check-no-mock.sh](legal_backend/scripts/check-no-mock.sh) | Fails CI if mock markers appear outside allowlist | N/A (process) | **38** | — | DoD: `check:no-mock` |
| Allowlist | `ai-gateway.service.ts`, `ocr.worker.ts`, `razorpay.service.ts`, `stripe.service.ts`, `payments.service.ts`, `health.service.ts` | Intentional until killed | **7**, **12**, **26**, **38** | — | — |

### Test-only (excluded from kill priority)

| File | Symbol / behavior | Owner prompt # | Class |
|------|-------------------|----------------|-------|
| [legal_backend/src/billing/trust.service.spec.ts](legal_backend/src/billing/trust.service.spec.ts) | `jest.fn().mockResolvedValue` | — | Test fixture |

---

## legal_web

| File | Symbol / behavior | Live mode env vars | Owner prompt # | Class | QA-MATRIX |
|------|-------------------|-------------------|----------------|-------|-----------|
| [legal_web/lib/analytics/events.ts](legal_web/lib/analytics/events.ts) | `trackEvent()` — no-op PostHog “stub” when key unset | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | **25** | `dev_only_ok` | Consumer funnel polish |
| [legal_web/components/credits/PlanUsagePanel.tsx](legal_web/components/credits/PlanUsagePanel.tsx) | Detects `seti_mock` / uses `pm_mock_*` for save payment method | Backend: `STRIPE_SECRET_KEY` | **7**, **25** | `must_be_live_in_prod` | Billing/subscription |
| [legal_web/lib/api/court.ts](legal_web/lib/api/court.ts) | `ecourtsLookup()` client — displays backend stub/live payload | `ECOURTS_API_URL` (backend) | **29** | `must_be_live_in_prod` | Court tab `[x]` |
| [legal_web/app/app/matters/[matterId]/court/page.tsx](legal_web/app/app/matters/[matterId]/court/page.tsx) | eCourts lookup UI — renders stub data from API | Same | **29**, **30** | `must_be_live_in_prod` | Phase 4 court UI `[x]` |
| [legal_web/app/app/settings/integrations/page.tsx](legal_web/app/app/settings/integrations/page.tsx) | Connect UI — shows `development_stub` connections from API | OAuth env per provider (backend) | **16**–**20** | `must_be_live_in_prod` | Integrations stub `[x]` |
| [legal_web/.env.example](legal_web/.env.example) | `NEXT_PUBLIC_USE_MOCK_DATA=false` — **no runtime references in `lib/` or `app/`** (enforced in docs/CI only) | Keep `false` | **38** | `dev_only_ok` | Phase 0: real API `[x]` |
| [legal_web/e2e/invoice-pay-mock.spec.ts](legal_web/e2e/invoice-pay-mock.spec.ts) | Playwright describe “Portal invoice pay mock” — smoke routing only | E2E against env with real payment keys | **38** | Test-only | Post-deploy portal pay `[ ]` |

### MEGASPEC-documented gaps (no `stub`/`mock` string in code)

| Area | Documented behavior | Owner prompt # | Class | QA-MATRIX |
|------|---------------------|----------------|-------|-----------|
| `/app/accounting/payments` | Reconciliation UI called out as stub in [MEGASPEC-ALIGNMENT.md](legal_web/MEGASPEC-ALIGNMENT.md) — route may be absent or partial | **7** | `must_be_live_in_prod` | Online payments partial |
| Intake booking / questionnaires | “booking page stub; questionnaires stub” (MEGASPEC Phase 2) | **23** | `must_be_live_in_prod` | Intake pipeline `[ ]` |

---

## legal_app

No direct `stub` / `mock` / `development_stub` matches in `legal_app/lib/`. The mobile client **inherits** backend payment and AI behavior:

| Flow | Indirect stub source | Live mode env vars (backend) | Owner prompt # | Class | QA-MATRIX |
|------|---------------------|------------------------------|----------------|-------|-----------|
| [legal_app/lib/features/consumer/subscription/subscriptions_screen.dart](legal_app/lib/features/consumer/subscription/subscriptions_screen.dart) | Checkout WebView opens `cs_mock_*` / Razorpay mock URLs | `STRIPE_SECRET_KEY` / `RAZORPAY_*` | **25**, **37** | `must_be_live_in_prod` | Mobile checkout `[x]` smoke |
| [legal_app/lib/features/consumer/lawyer_review/lawyer_review_screen.dart](legal_app/lib/features/consumer/lawyer_review/lawyer_review_screen.dart) | Payment intent checkout URL from mock gateways | Same + marketplace ledger (**21**) | **21**, **37** | `must_be_live_in_prod` | Lawyer review pay E2E `[ ]` |
| [legal_app/lib/features/credits/widgets/credit_usage_meter.dart](legal_app/lib/features/credits/widgets/credit_usage_meter.dart) | `openPaymentCheckout()` for credits | Same | **25** | `must_be_live_in_prod` | Subscriptions |
| Copilot / issue checker / reports | AI text from `generateMock*` when `OPENAI_API_KEY` unset | `OPENAI_API_KEY` | **26**, **37** | `must_be_live_in_prod` | Matter AI chips `[ ]`; issue checker `[x]` |

---

## Prompt ownership index

Each stub row above maps to the prompt that **removes or hard-gates** it for production.

| Prompt # | Title | Stubs killed |
|----------|-------|--------------|
| 1 | Stub kill list (this doc) | — |
| 2 | Parity matrix | — |
| 3–6 | Billing PM parity | — (no mock strings; feature gaps) |
| 7 | Dunning + reconciliation | Stripe/Razorpay/M-Pesa `*_mock_*`, `seti_mock`, PlanUsagePanel |
| 8 | Trust reconciliation | — |
| 9–10 | Playbooks + matter UX | — |
| 11–12 | DMS + OCR live | `[OCR mock]` |
| 13–15 | Doc automation + passive time | — |
| 16–20 | OAuth integrations live | `development_stub` |
| 21 | Marketplace pay E2E | Payment mocks for review fees |
| 22–23 | Intake + booking | MEGASPEC intake stubs |
| 24–25 | Consumer forms + checkout | Analytics stub; subscription checkout mocks |
| 26 | Firm memory in gateway | AI `generateMock*`, outcome fallbacks |
| 27–28 | Law library + bulk review | AI research mocks |
| 29 | eCourts live | `ecourts-india-stub` |
| 30 | US docket live | `us-docket-stub` |
| 31–32 | Evidence + Word add-in | — |
| 33–36 | Enterprise + audit | Public API stubs |
| 37 | Mobile parity | Indirect payment/AI mocks |
| 38 | Production hardening | All remaining; `check:no-mock`; prod env validation |
| 39 | Skip link + landmarks | — |
| 40 | Radix toast system | — |
| 41 | Onboarding wizard | — |
| 42 | Command palette actions | — |
| 43 | Morning brief API | — |
| 44 | Copilot @agent orchestration | — |
| 45 | Firm outcome benchmarks | Outcome heuristic fallbacks (when AI parse fails) |
| 46 | Unified search web | — |
| 47 | Integration retry dashboard | `development_stub` sync paths |
| 48 | OpenSearch migration | — |
| 49 | Migration worker + CI tests | Migration stub worker message |
| 50 | Portal v2 uploads | — |

---

## Production kill order (recommended)

1. **Payments** (**7**, **21**, **25**) — fail closed in `NODE_ENV=production` when provider keys missing  
2. **AI** (**26**, **38**) — disallow `ALLOW_MOCK_AI` in prod; remove `generateMock*` from user-facing paths  
3. **Court** (**29**, **30**) — require `ECOURTS_API_URL` and CourtListener token in prod  
4. **Integrations** (**16**–**20**) — already throws in prod without OAuth; remove `development_stub` status display  
5. **OCR** (**12**) — fail job when Azure credentials missing  
6. **Public API** (**35**) — versioned API + real webhook delivery  

---

## Sign-off (Prompt 38)

- [ ] `cd legal_backend && npm run check:no-mock` passes with shrinking allowlist  
- [ ] Post-deploy smoke in [QA-MATRIX.md](QA-MATRIX.md) § Post-deploy — all `[x]`  
- [ ] No row in this doc remains `must_be_live_in_prod` without prod env guard or live adapter  

### Resolved in platform connectivity audit (2026-06-23)

| Item | Resolution |
|------|------------|
| eSign mock fallback | Prod fail-closed in `esign.service.ts` |
| AI mock responses in prod | `shouldUseMockResponses()` never true in production |
| OCR empty completion | Throws when Azure unset; worker marks FAILED |
| Outcome heuristic fallback | Prod throws on unparsable AI JSON |
| Integration email/scheduler stubs | `IntegrationSyncService` + OAuth calendar/email sync |
| Court UI blind success | Provider-aware toast on eCourts lookup |
| Integrations CONNECTED badge | Stub mode badge + warning in settings UI |
| Document review follow-ups | Wired to `runLegalResearch` API |
| Mobile portal fake reply | Removed; tap opens case messages when metadata present |
| Reports coming-soon KPIs | Placeholder card removed |
