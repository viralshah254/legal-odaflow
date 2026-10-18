# Umbrella Platform — Gap Matrix

**Version:** 1.1.0
**Date:** 2026-07-27
**Owner:** Engineering
**Purpose:** Tracks the delta between the current implementation state and the target state described in the Umbrella Engineering Handbook.

> **Legend:**
> - ✅ **Implemented** — Feature exists, is production-ready, and matches handbook intent.
> - 🟡 **Partial** — Feature exists but is incomplete, has known gaps, or diverges from the handbook target state.
> - 🔴 **Stub** — Module or class exists in code but has no real implementation (returns mock data or throws not-implemented).
> - ⬜ **Missing** — No code exists; this is a net-new build item.

---

## 1. Backend Modules (NestJS — `legal_backend/src/`)

| Module | Status | Notes |
|--------|--------|-------|
| `auth` | ✅ | JWT + Firebase Auth, guards, decorators |
| `tenants` | ✅ | Multi-tenant isolation, tenant context propagation |
| `users` | ✅ | User CRUD, profile management |
| `matters` | ✅ | Full CRUD, matter parties, notes, timeline, budget |
| `matter-intelligence` | 🟡 | Mi feature flags present; handbook Ch. 04 requires durable fact lifecycle, contradiction detection, and issue graph — all missing |
| `matter-brain` | 🟡 | Background analysis jobs exist; WorkflowRun not durable (see key gaps) |
| `matter-autonomy` | 🟡 | Cron-triggered jobs exist; no orchestration retry or dead-letter handling |
| `ai` (core) | 🟡 | `ai-gateway.service.ts`, `model-router`, `ai-policy.service.ts`, cost tracking via `ai-usage-recorder.service.ts` — missing canonical `LegalRequestContext` (see key gaps) |
| `ai/india-draft` | ✅ | Production India v1 drafting pipeline; full section generation + verification |
| `ai/drafting-v2` | 🟡 | Section generator + verifier present; gated by `DRAFT_ENGINE_V2`; `DraftWorkspace` not yet canonical entity (see key gaps) |
| `ai/us-draft` | 🟡 | Simpler pipeline exists; no section-level verification loop |
| `ai/legal-research` | 🟡 | Canonical `ResearchWorkspace` sessions, ordered `AIOutput` revisions, independent manual citation review, and `SavedResearch` filing snapshots exist behind staged flags. Server-side document promotion and a complete citation relationship/treatment graph remain open. |
| `ai/verification` | 🟡 | Citation verifier exists; hallucination rate not tracked; no systematic calibration |
| `ai/citations` | 🟡 | Citation parsing; missing relationship graph between citations |
| `ai/draft-intent` | ✅ | Intent classification for drafting workflows |
| `ai/matter-intelligence` (subdir) | 🟡 | Feature flags only; brain services call these but stub logic present |
| `ai/copilot` | 🟡 | CopilotPlan + tools registry; not all tools wired to real data sources |
| `ai/react-agent` | 🔴 | ReAct agent loop stub; not connected to production tool set |
| `ai/ml` | 🔴 | ML inference stub; no real model serving |
| `ai/model-router` | ✅ | Dynamic model selection, fallback chains, policy enforcement |
| `ai/costs` | ✅ | Cost tracking per inference call |
| `legal-forms` | ✅ | Form catalog, legal forms templates, intake |
| `drafting-session` | 🟡 | Templates and session management; not connected to canonical `DraftWorkspace` |
| `document-automation` | 🟡 | Template fill pipeline; no version diffing |
| `documents` | ✅ | Document CRUD, upload, storage |
| `ocr` | ✅ | OCR pipeline, queue consumer |
| `search` | 🟡 | OpenSearch lexical + pgvector semantic; hybrid ranking not implemented |
| `legal-search` | 🟡 | Legal-domain search; jurisdiction filtering incomplete |
| `embeddings` | ✅ | Embedding generation, storage |
| `knowledge-graph` (via `firm-memory`) | 🔴 | Handbook Ch. 05 describes full entity/relationship graph; only flat firm memory exists |
| `firm-memory` | 🟡 | Read-only retrieval; write-path for learning preferences missing (see key gaps) |
| `consumers` | ✅ | Consumer classification, issue checker pipeline |
| `consumer-reports` | ✅ | Consumer report generation |
| `clients` | ✅ | Client CRUD, firm-client relationships |
| `portal` | ✅ | Client portal API, document sharing |
| `billing` | ✅ | Stripe webhooks, subscription tiers |
| `ai-credits` | ✅ | AICreditLedger, credit consumption, balance checks |
| `subscriptions` | ✅ | Subscription plan management |
| `payments` | ✅ | Payment processing, invoices |
| `notifications` | 🟡 | Dispatch queue exists; push notification delivery incomplete on mobile |
| `automations` | ✅ | End-to-end pipeline: events → BullMQ worker → notifications/tasks. practiceArea condition matching fixed (taxonomy mismatch resolved); actions normalised to array; last-run status visible on UI cards. v2 approval/webhook nodes present in schema but not yet executed (by design). |
| `playbooks` | 🟡 | Playbook CRUD; execution engine stub |
| `tasks` | ✅ | Task CRUD, assignment, due dates |
| `calendar` | 🟡 | Calendar events; no court deadline calculation logic |
| `court-deadlines` | 🔴 | Stub module; handbook Ch. 54 requires jurisdiction-aware deadline computation |
| `meetings` | 🟡 | Meeting records; transcription intelligence not implemented |
| `timeline` (matter) | ✅ | Matter timeline events |
| `esign` | 🟡 | eSign integration; no fallback provider |
| `storage` | ✅ | S3-compatible + local dev abstraction |
| `templates` | ✅ | Template library |
| `integrations` | 🔴 | Stub; connector platform not built |
| `migration` | 🟡 | Import pipeline queue exists; full onboarding wizard not built |
| `audit` | ✅ | Audit trail, event logging |
| `analytics` | 🟡 | Privacy-allowlisted research lifecycle events now cover revisions, question answers, citation decisions, filing, and unsafe export attempts; broader calibrated AI quality dashboards remain open (see quality-baselines.md). |
| `eval` | 🟡 | Deterministic legal evals are wired, including three calibrated matrimonial cases (happy, good-faith/unproved edge, adverse/condonation/pinpoint-gap hard). Live model and longitudinal production evaluation coverage remain incomplete. |
| `security` | ✅ | RBAC, permission guards, scoped access |
| `gdpr` | 🟡 | Deletion pipeline; data portability export incomplete |
| `anonymization` | 🟡 | PII stripping; completeness not verified |
| `kyc` | 🟡 | Identity check integration; incomplete |
| `conflicts` | 🟡 | Conflict check stub; not connected to matter/client graph |
| `governance` | 🟡 | Governance records; handbook Ch. 32 requirements partially met |
| `country-compliance` | 🟡 | Jurisdiction flags exist; full regulatory matrix not implemented |
| `legal-compliance` | 🟡 | Compliance checks; incomplete rule set |
| `court` | 🟡 | Court records; no filing integration |
| `fir` | 🟡 | FIR analysis pipeline; India-specific, partially implemented |
| `monitors` | 🟡 | Alert monitors exist; legal update monitoring (Ch. 28) not wired to sources |
| `referrals` | ✅ | Referral tracking, marketplace handoff |
| `marketplace` | 🟡 | Lawyer matching; scoring algorithm stub |
| `training-datasets` | 🟡 | Dataset curation; training consent gating |
| `training-consent` | ✅ | Consent capture |
| `series-a` | ✅ | Series-A metrics endpoint |
| `health` | ✅ | Health check endpoint |

---

## 2. Web Routes Coverage (`legal_web/app/app/`)

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard` | ✅ | Main dashboard |
| `/matters` | ✅ | Matter list, detail, create |
| `/india-drafting` | ✅ | India v1 + v2 drafting flows |
| `/us-drafting` | ✅ | US drafting flow |
| `/document-drafting` | ✅ | Generic document drafting |
| `/legal-forms` | ✅ | Form catalog and completion |
| `/research` | 🟡 | Follow-on context, reloadable revisions, explicit matter context, manual citation review, marked unsafe export, and filing flows exist behind staged backend flags. Citation graph view and server-side document promotion remain missing. |
| `/document-review` | 🟡 | Review UI exists; redline export incomplete |
| `/documents` | ✅ | Document library |
| `/clients` | ✅ | Client management |
| `/portal` | ✅ | Client portal |
| `/billing` | ✅ | Billing dashboard |
| `/copilot` | 🟡 | Copilot chat; tool execution UI incomplete |
| `/ai-command-center` | 🟡 | AI usage dashboard; cost breakdown partial |
| `/automations` | ✅ | Automation builder; recipe cards show live last-run status (Active & ran / Last run failed / Never run); practice-area recipes now correctly match |
| `/calendar` | 🟡 | Calendar view; no court deadline overlay |
| `/meetings` | 🟡 | Meeting list; no intelligence surface |
| `/tasks` | ✅ | Task management |
| `/templates` | ✅ | Template library |
| `/intake` | 🟡 | Client intake flow; conditional logic incomplete |
| `/onboarding` | 🟡 | Onboarding wizard; enterprise import not wired |
| `/settings` | ✅ | User and firm settings |
| `/team` | ✅ | Team management |
| `/analytics` / `/reports` | 🟡 | Basic analytics; AI quality metrics missing |
| `/queues` | ✅ | Queue monitoring (dev/admin) |
| `/evidence` | 🔴 | Route exists; no AI intelligence surface |
| `/vault` | 🔴 | Personal vault stub |
| `/trust` | 🔴 | Trust & safety stub |
| `/section-finder` | 🟡 | Legal section lookup; limited jurisdiction support |
| `/saved-drafts` | ✅ | Saved draft library |
| `/law-library` | 🟡 | Legal sources; stale content not surfaced |
| `/agents` | 🔴 | Agentic workspace UI stub |
| `/fir-analysis` | 🟡 | FIR analysis; India-specific, partial |
| `/home` | ✅ | Home/landing |
| `/profile` | ✅ | User profile |
| `/referrals` | ✅ | Referral tracking |
| `/leads` | 🟡 | Lead management; no scoring |
| `/monitors` | 🟡 | Alert monitors; legal update feed incomplete |
| `/finance` | 🟡 | Finance overview; outside counsel billing incomplete |
| `/time` | 🟡 | Time tracking; no billing integration |
| `/esign` | 🟡 | eSign flow; limited provider support |
| `/accounting` | 🔴 | Stub |
| `/consumer-reports` | ✅ | Consumer report viewer |

---

## 3. Mobile Features Coverage (`legal_app/lib/features/`)

| Feature | Status | Notes |
|---------|--------|-------|
| `auth` | ✅ | Login, registration, Firebase Auth |
| `onboarding` | 🟡 | Onboarding screens; incomplete flow |
| `settings` | ✅ | User settings |
| `lawyer` | 🟡 | Lawyer portal features; partial |
| `consumer` | 🟡 | Consumer intake and Q&A; partial |
| `credits` | 🟡 | Credit balance display; purchase flow incomplete |
| `splash` | ✅ | Splash screen |
| Push notifications | 🟡 | Infrastructure exists; delivery incomplete |
| Offline-first | 🔴 | No offline support; handbook Ch. 17 requires it |
| Document upload | 🔴 | Not implemented on mobile |
| Research (mobile) | 🔴 | Not implemented |
| Drafting (mobile) | 🔴 | Not implemented |
| Matter view (mobile) | 🔴 | Not implemented |

---

## 4. AI Providers

| Provider | Status | Notes |
|----------|--------|-------|
| **OpenAI** | ✅ | GPT-4o, GPT-4-turbo via `llm-completion.service.ts`; cost tracked |
| **Anthropic** | 🟡 | Claude models configured in model router; cost tracking wired; red-teaming (Ch. 69) not done |
| **Google** | 🟡 | Gemini configured in model router; function calling not fully tested |

---

## 5. Queue Infrastructure

| Queue | Status | Notes |
|-------|--------|-------|
| `ocr-processing` | ✅ | OCR job pipeline, retry, DLQ |
| `ai.high_priority` | ✅ | High-priority AI inference jobs |
| `ai.low_priority` | ✅ | Background AI inference jobs |
| `notifications.dispatch` | 🟡 | Queue exists; email + push delivery incomplete |
| `automations.execute` | ✅ | Queue and worker fully wired; executes send_notification, create_task, enqueue_agent_job actions |
| `legal.ingest` | 🟡 | Queue exists; source ingestion pipeline partial |
| `migration.import` | 🟡 | Queue exists; data migration pipeline partial |
| `search.index` | 🟡 | Queue exists; delta indexing not fully implemented |

---

## 6. Database

| Concern | Status | Notes |
|---------|--------|-------|
| **Engine** | ✅ | PostgreSQL |
| **ORM** | ✅ | Prisma |
| **Model count** | ✅ | ~105 models |
| **Multi-tenancy** | ✅ | `tenantId` on all tenant-scoped models |
| **Soft delete** | 🟡 | Present on major models; not consistent across all |
| **Audit fields** | 🟡 | `createdAt`/`updatedAt` present; `updatedBy` inconsistent |
| **pgvector** | ✅ | Semantic embedding storage |
| **Full-text indexes** | 🟡 | Some; not systematically applied |
| **Row-level security** | 🔴 | Not enabled; tenancy enforced at application layer only |

---

## 7. Search Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| **OpenSearch (lexical)** | 🟡 | Configured; delta indexing incomplete; legal source index partially populated |
| **pgvector (semantic)** | ✅ | Embedding generation + retrieval working |
| **Hybrid ranking** | 🔴 | No fusion layer combining lexical + semantic scores |
| **Query expansion** | 🔴 | Not implemented |
| **Jurisdiction filtering** | 🟡 | Filter exists; not applied consistently |

---

## 8. Storage

| Component | Status | Notes |
|-----------|--------|-------|
| **S3-compatible (production)** | ✅ | Abstraction in `storage` module |
| **Local dev (filesystem)** | ✅ | Local adapter for development |
| **Signed URL generation** | ✅ | Pre-signed URLs for secure access |
| **Encryption at rest** | 🟡 | Delegated to S3 bucket policy; not explicitly verified in code |
| **Retention policy enforcement** | 🔴 | No automated document retention/deletion |

---

## 9. Key Gaps (High Priority)

These gaps represent the most significant deviations from the handbook's target state. They should be addressed before any feature that depends on them is built.

### GAP-001 — `LegalRequestContext` Missing

**Handbook reference:** Ch. 02 — Legal Intelligence Engine
**Current state:** Tenant ID and user ID are propagated through decorator-injected request context. There is no unified `LegalRequestContext` object that carries jurisdiction, matter context, feature flags, AI cost budget, and source preferences.
**Impact:** Every AI feature must manually re-derive jurisdiction and matter context from the raw request. Cross-feature intelligence sharing is impossible without it.
**Required:** Define `LegalRequestContext` as a typed, injectable class. Populate it in the global auth guard. Make it available via `@InjectContext()` decorator in all AI services.

---

### GAP-002 — `WorkflowRun` Not Durable

**Handbook reference:** Ch. 38 — Agentic Workspaces and Orchestration
**Status: CLOSED** — `agentic-workflow.worker.ts` now checkpoints `stepResults` after every step, restores partial state on retry, skips already-completed steps, and reports BullMQ progress. BullMQ exponential back-off retry is configured on the worker. Intent router (`routeIntent()`) added and shared by copilot and upload flows.

---

### GAP-003 — `DraftWorkspace` Not Canonical

**Handbook reference:** Ch. 07 — Document Drafting v3
**Current state:** India v1 drafting writes to `DraftingSession`. V2 drafting writes to a different structure. US drafting has its own model. There is no single canonical `DraftWorkspace` entity that all drafting pipelines write to.
**Impact:** The frontend must know which drafting engine produced a draft to render it correctly. Cross-engine draft comparison is impossible. The legal forms catalog cannot share a unified draft output model.
**Required:** Define `DraftWorkspace` as the canonical output model. Migrate all drafting engines to write to it. Deprecate engine-specific output models.

---

### GAP-004 — Fact Lifecycle Missing

**Handbook reference:** Ch. 04 — Matter Intelligence
**Current state:** Matter intelligence jobs extract insights and write them to the matter record, but there is no `Fact` model with status (proposed → verified → contradicted → retracted), source citations, or confidence scores.
**Impact:** The matter brain cannot track which facts have been verified, which are contradicted by new evidence, or which are stale. The issue graph cannot be grounded in verified facts.
**Required:** Introduce `Fact`, `FactSource`, and `FactContradiction` models. Wire the matter brain to create and update facts rather than overwrite matter fields.

---

### GAP-005 — Contradiction Detection Missing

**Handbook reference:** Ch. 04 — Matter Intelligence, Ch. 12 — Verification Engine
**Current state:** The verification engine checks citations for existence but does not compare claims across sources for logical contradictions.
**Impact:** If two sources make contradictory legal claims, both are silently returned to the user. The system cannot flag them.
**Required:** Add a contradiction detector to the verification pipeline. Flag `FactContradiction` records for user review.

---

### GAP-006 — Knowledge Graph Is a Stub

**Handbook reference:** Ch. 05 — Knowledge Graph
**Current state:** `firm-memory` provides flat key-value retrieval. There is no graph of entities (Person, Organisation, Contract, Clause, Precedent, Jurisdiction) with typed relationships.
**Impact:** Precedent lookup, conflict checking, and cross-matter intelligence all require a traversable entity graph. Without it, these features are impossible at the quality level described in the handbook.
**Required:** Implement the entity model from Ch. 05. Start with Person, Organisation, Matter, Document, and Clause as seed entity types. Wire the knowledge graph to the research and drafting pipelines.

---

### GAP-007 — Legal Memory Is Read-Only

**Handbook reference:** Ch. 11 — Legal Memory
**Current state:** `firm-memory` can retrieve stored preferences and historical outputs. There is no write-path that learns from user edits, accepted/rejected suggestions, or matter outcomes.
**Impact:** The platform cannot improve its outputs based on firm-specific patterns. Each session starts from zero context.
**Required:** Implement the memory write-path: capture user edits, accepted drafts, and rejected suggestions as training signals. Gate behind `training-consent` before writing.

---

### GAP-008 — Hybrid Search Ranking Missing

**Handbook reference:** Ch. 20 — Search and RAG
**Status: CLOSED** — `HybridSearchService.search()` now implements Reciprocal Rank Fusion (RRF, k=60) across all retrieval paths (OpenSearch BM25/kNN, pgvector keyword, pgvector semantic). Each path contributes a ranked list; RRF fuses them into a single score. Metadata is merged from later-retrieved docs. Knowledge graph entity extraction is tracked separately.

---

## 10. Summary Scorecard

| Layer | Implemented | Partial | Stub/Missing | Total |
|-------|-------------|---------|--------------|-------|
| Backend modules | ~35 | ~30 | ~10 | ~75 |
| Web routes | ~18 | ~20 | ~8 | ~46 |
| Mobile features | ~4 | ~4 | ~8 | ~16 |
| Queue backends | 3 | 5 | 0 | 8 |
| AI providers | 1 | 2 | 0 | 3 |
| Search components | 1 | 2 | 2 | 5 |
| Storage components | 3 | 1 | 1 | 5 |

---

*This document should be updated whenever a gap is closed. Link to the PR that addressed the gap in the Notes column.*
