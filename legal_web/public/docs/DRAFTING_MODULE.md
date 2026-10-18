# Drafting Module — Complete Technical Reference

> Last reviewed: Jun 27, 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Three Pipelines at a Glance](#2-three-pipelines-at-a-glance)
3. [India AI Draft — Primary Path](#3-india-ai-draft--primary-path)
   - [API Surface](#31-api-surface)
   - [v1 Pipeline (Legacy)](#32-v1-pipeline-legacy)
   - [v2 Pipeline (Active)](#33-v2-pipeline-active)
   - [Engine Routing Logic](#34-engine-routing-logic)
4. [Platform Drafting v3 — Section Workspace](#4-platform-drafting-v3--section-workspace)
5. [Drafting Sessions / Template Path](#5-drafting-sessions--template-path)
6. [AI Models Used](#6-ai-models-used)
7. [Every Blocking Step — Latency Map](#7-every-blocking-step--latency-map)
8. [Verification & Quality Checks](#8-verification--quality-checks)
9. [Form Catalog & Discovery](#9-form-catalog--discovery)
10. [Queue & Job System](#10-queue--job-system)
11. [Frontend — Web & Flutter](#11-frontend--web--flutter)
12. [Complete User Journey](#12-complete-user-journey)
13. [Known Issues & Gaps](#13-known-issues--gaps)
14. [Key File Index](#14-key-file-index)

---

## 1. Overview

The drafting system powers AI-generated court documents, notices, contracts, and catalog forms. It has **three independent pipelines** that share a common LLM gateway, credit system, and verification layer but have different execution models and UX targets.

```
User enters facts / picks a form
        │
        ▼
[India AI Draft]──────[Platform v3 Workspace]──────[Template Session]
     (primary)           (matter-linked)              (field-based)
  Sync HTTP req        Sync + polling               Sync HTTP req
  India courts         Section editor               Doc automation
```

---

## 2. Three Pipelines at a Glance

| | India AI Draft | Platform v3 | Drafting Sessions |
|---|---|---|---|
| **Primary use** | Curated India court forms, notices | Matter-linked section-by-section docs | Template / field-based documents |
| **Execution** | Synchronous HTTP (up to 600 s) | Synchronous + WorkflowRun polling | Synchronous HTTP |
| **Async queue?** | No (shadow v2 only) | No (WorkflowRun is tracking, not execution) | BullMQ for lead drafts only |
| **LLM passes** | 1–6 (v1), batched parallel (v2) | N sequential (one per section) | 1 per field set |
| **Key service** | `IndiaDraftService` / `DraftEngineV2Service` | `DraftOrchestrationService` | `DraftingSessionService` |
| **Maturity** | Production, well-tested | Less mature (Gemini refs broken) | Stable |

---

## 3. India AI Draft — Primary Path

### 3.1 API Surface

**Base:** `POST /ai/india-draft/*`
**Controller:** `legal_backend/src/ai/india-draft/india-draft.controller.ts`

| Endpoint | Purpose | Credits |
|---|---|---|
| `POST /ai/india-draft/generate` | Full document generation — v2 or v1 | 15–75 credits |
| `POST /ai/india-draft/fill-blanks` | AI-fill `{{placeholder}}` gaps | 5 credits |
| `POST /ai/india-draft/edit` | Selection edit / check law / add citations | 5–15 credits |
| `POST /ai/india-draft/export` | Styled HTML for PDF/DOCX export | 0 credits |
| `POST /ai/india-draft/extract-context` | PDF/DOCX/image text extraction | 0 credits |
| `POST /ai/india-draft/regenerate-section` | v2 only — single section repair | 10 credits |
| `GET /ai/drafts` | Draft history list | — |
| `PATCH /ai/drafts/:id` | Update draft title / status | — |
| `DELETE /ai/drafts/:id` | Delete draft | — |
| `PATCH /ai/drafts/:id/link-to-client` | Attach draft to client record | — |

---

### 3.2 v1 Pipeline (Legacy)

All steps run **sequentially in a single HTTP request**. This is the worst-case latency path.

```
POST /ai/india-draft/generate
        │
        ▼
1.  Matter Intelligence (optional)
        │  → infers document kind from raw facts
        ▼
2.  Procedural Router
        │  → DraftProceduralRouterService
        │  → determines forum, jurisdiction, limitation
        ▼
3.  Pre-draft dependency gate
        │  → throws 400 if required inputs missing
        ▼
4.  Prompt assembly
        │  → DU drafting rules constant
        │  → format-specific system prompt (india-draft-prompts.ts)
        │  → statute grounding + verified authority blocks
        │  → pre-checklist block
        │  → router / gate context blocks
        ▼
5.  Credit balance check
        │  → assertSufficientBalance() — throws 402 if low
        ▼
6.  Pass 1 — Structure (LLM call #1)
        │  → model selected by complexity tier (see §6)
        │  → 3,500–7,000 token window
        ▼
7.  Continuation loop (up to 3 extra LLM calls)
        │  → triggered when output appears truncated
        │  → 15 credits each additional call
        ▼
8.  Pass 2 — Enrichment (LLM call #2)
        │  → skipped for express / skeleton / bundle fast-path
        │  → always uses claude-sonnet-4-6
        ▼
9.  Verification pass
        │  → IndiaDraftVerificationService → DraftVerificationService
        │  → see §8 for full check list
        ▼
10. Regeneration loop (up to 2 more LLM passes)
        │  → triggered when verification score < threshold
        │  → re-runs verification after each regen
        ▼
11. Credit recording + history save
        │  → persists CourtDraftRecord to DB
        ▼
12. Accuracy gate + structure audit
        │  → DraftAccuracyGateService — certification label
        │  → DraftStructureAuditService
        ▼
13. Shadow v2 (optional, non-blocking)
        │  → fire-and-forget background compare run
        └──▶ Return draft to client
```

**v1 model selection** — `india-draft.service.ts` lines 289–319:

| Complexity label | Pass 1 model |
|---|---|
| `EXPRESS` / notice | `claude-sonnet-4-6` |
| `PREMIUM` / complex | `claude-opus-4-8` |
| `STANDARD` | `claude-sonnet-4-6` |
| `SIMPLE` | `deepseek-chat` (if configured) else `gpt-5.4-mini` |
| Pass 2 / regen always | `claude-sonnet-4-6` |

> **Cycle margin guard:** if tenant has consumed ≥ 80% of their AI budget, `PREMIUM` is silently downgraded to `AUTO` before the model is selected.

---

### 3.3 v2 Pipeline (Active)

Runs when `DRAFT_ENGINE_V2=true` or `DRAFT_ENGINE_V2_PER_KIND=true` matches the document kind.
**Service:** `legal_backend/src/ai/drafting-v2/draft-engine-v2.service.ts`

```
POST /ai/india-draft/generate  (v2 path)
        │
        ▼
Stage 1 — Matter Intelligence (blocking if MI enabled)
        │  → MatterIntelligencePipelineService
        ▼
Stage 2 — Planning
        │  → PlanningEngineService — no LLM, deterministic
        ▼
Stage 3 — Legal Graph
        │  → LegalGraphService — statute → section dependency graph
        ▼
Stage 4 — Retrieval  ◀─────────── PARALLEL ──────────▶
        │  IndiaDraftGroundingService                  │
        │  DraftResearchGroundingService                │
        │  → DeepResearch ReAct loop (0–6 steps)       │
        └───────────────────────────────────────────────┘
        ▼
Stage 5 — Rule Engine
        │  → RuleEngineService — jurisdiction / limitation rules
        ▼
Stage 6 — Outline
        │  → OutlineBuilderService — section dependency ordering
        ▼
Stage 7 — Evidence Validation
        │  → EvidenceValidationService — fact–claim consistency
        ▼
Stage 8 — Section Generation  (BATCHED PARALLEL within dependency waves)
        │
        │  Wave 1: sections with no dependencies → all in parallel
        │  Wave 2: sections depending on wave 1 → all in parallel
        │  Wave N: ...
        │
        │  Per section:
        │    → SectionGeneratorService (LLM call — model by tier, see §6)
        │    → ConfidenceEngineService (score)
        │    → SectionVerifierService (verify)
        │    → TargetedRepairService (if score < threshold, another LLM call)
        ▼
Stage 9 — Confidence Aggregation
        ▼
Stage 10 — Verification
        │  → full DraftVerificationService run on assembled doc
        ▼
Stage 11 — Targeted Repair (if sections fail)
        ▼
Stage 12 — Final Assembly + History Save
        └──▶ Return to client
```

**v2 section model tiers** — `section-generator.service.ts` lines 64–99:

| Tier | Section types | Model |
|---|---|---|
| Premium | `grounds`, `arguments`, `legal_grounds` | `claude-opus-4-8` |
| Mid | `facts`, `law`, `prayer`, `relief` | `claude-sonnet-4-6` |
| Cheap | `heading`, `schedule`, `verification`, `signature`, `definitions` | `gpt-5.4-mini` or `deepseek-chat` |

---

### 3.4 Engine Routing Logic

```typescript
// draft-engine-v2.service.ts lines 64–102
isDraftEngineV2Enabled()        // DRAFT_ENGINE_V2 === 'true' → all drafts use v2
shouldUseV2ForKind(kind)        // DRAFT_ENGINE_V2_PER_KIND=true + V2_PREFERRED_KINDS set
```

`IndiaDraftService.generateDraft` (lines 124–203) tries v2 first; on per-kind failure it falls back to v1. A background "shadow mode" (`DRAFT_ENGINE_V2_SHADOW`) runs v2 after v1 returns for quality comparison — non-blocking, not returned to user.

---

## 4. Platform Drafting v3 — Section Workspace

**Service:** `legal_backend/src/platform/drafting/draft-orchestration.service.ts`
**API base:** `POST/GET /drafting/workspaces/*`

### 4.1 Ten-stage orchestration

```
POST /drafting/workspaces
        │
        ▼
1.  createWorkspace       → provisions DraftWorkspaceV3 record
        ▼
2.  runProcedural         → ProceduralGateService deterministic checks
        │  forum, limitation, standing, remedy, notice requirements
        ▼
3.  buildPlanAndOutline   → DraftPlannerService
        │  keyword-based issue extraction + section templates
        ▼
4.  generateAllSections   → ⚠ FULLY SEQUENTIAL — one section at a time
        │  each section waits for all prior sections (continuity context)
        ▼
5.  verifySections        → deterministic heuristics (no LLM)
        ▼
6.  runAdversarialReview  → AdversarialReviewService
        │  → counsel + judge reviews run in PARALLEL (Promise.all)
        │  → skipped for low/medium riskLevel
        ▼
7.  repairSections        → TargetedRepairService
        │  → sequential per section, max 3 repair attempts each
        ▼
8.  getFilingReadiness    → score ≥ 70 + zero critical failures required
        ▼
9.  finalize              → workspace status → ready
        ▼
10. export                → generate download URL, upload to storage
```

### 4.2 v3 Models

| Service | Model | Note |
|---|---|---|
| `generateAllSections` | `gemini-2.0-flash` | **BROKEN** — LLM gateway blocks Google; falls back to placeholder content |
| Adversarial review | `gpt-5.4-mini` | Working |
| Targeted repair | `gpt-5.4-mini` | Working |

> **Critical bug:** `selectModelForSectionType()` references `gemini-2.0-flash` / `gemini-2.0-flash-lite` but `LlmCompletionService` explicitly rejects Google providers. Sections generate placeholder content instead of real AI output.

### 4.3 v3 Validation Gates

| Check | Location | Effect |
|---|---|---|
| CourtDraftRecord existence | `createWorkspace` | 404 |
| Procedural blockers present | `runProcedural` | Status stays `planning`, blocks generation |
| Sections still `repair_needed` | `finalize` | 400 `VERIFICATION_FAILED` |
| Workspace must be `ready` | `export` | 400 |
| Section approval min 10 chars | State machine | 400 |
| Invalid state transition | State machine | 400 |
| Max 3 repairs per section | `targeted-repair` | Section skipped, not retried |

---

## 5. Drafting Sessions / Template Path

**Service:** `DraftingSessionService`
**Queue:** BullMQ `LEAD_DRAFT_GENERATE` job (for lead/intake drafts only — other sessions are synchronous)

Template-based drafting uses field extraction → template merge → optional AI fill-blanks.
Not the primary court document path. Used for contracts, intake forms, NDA generation.

---

## 6. AI Models Used

| Model | Provider | Used for | Status |
|---|---|---|---|
| `claude-opus-4-8` | Anthropic | v1 complex/premium, v2 premium sections (grounds, arguments) | Active |
| `claude-sonnet-4-6` | Anthropic | v1 express/standard/pass2/regen, v2 mid sections (facts, law, prayer) | Active |
| `claude-haiku-4-5` | Anthropic | LLM fallback chain | Active (fallback) |
| `gpt-5.4-mini` | OpenAI | v3 adversarial/repair, v2 cheap sections, fill-blanks fallback | Active |
| `gpt-5.5` / `gpt-5.5-pro` | OpenAI | Quality feedback escalation target (routing after 10+ edits) | Active |
| `deepseek-chat` | DeepSeek | v1 simple drafts, fill-blanks (when `DEEPSEEK_API_KEY` set) | Optional |
| `gemini-2.0-flash` | Google | v3 section generation **in code** | **BROKEN — blocked by gateway** |
| `gemini-2.0-flash-lite` | Google | v3 cheap sections **in code** | **BROKEN — blocked by gateway** |
| `whisper-1` | OpenAI | Audio transcription (voice input, not drafting) | Active |

**Non-LLM external services:**
- `LegalRetrievalOrchestrator` — case law and authority retrieval
- `DeepResearchAgentService` — ReAct reasoning loop (up to 10 steps)
- `BareActLookupService` — statute section verification against corpus
- `CitationVerificationService` — citation format and existence checks
- `SubstanceVerificationService` — claim substance checks
- `SentenceAuditService` — sentence-level legal accuracy
- `DocumentIngestService` — PDF/DOCX text extraction
- Storage gateway — export upload

---

## 7. Every Blocking Step — Latency Map

### India v1 (worst case, all sequential, single HTTP request)

| Step | Approx time | Skippable? |
|---|---|---|
| Matter Intelligence pipeline | 2–5 s | Yes (flag) |
| Statute + research grounding (parallel) | 3–10 s | No |
| Pre-checklist evaluation | <1 s | No |
| Pass 1 LLM (3.5k–7k tokens) | 8–25 s | No |
| Continuation loops ×3 | +8–25 s each | Only if truncated |
| Pass 2 enrichment LLM | 8–20 s | Yes (express mode) |
| Verification — retrieval + bare-act loops | 5–15 s | No |
| Verification — unified checks | 2–5 s | No |
| Regeneration loops ×2 + re-verify each | +25–45 s each | Only on fail |
| Accuracy gate + structure audit | <1 s | No |
| DB persist | <1 s | No |
| **Total (happy path, standard doc)** | **~35–80 s** | |
| **Total (worst case, complex + regen)** | **~180–600 s** | |

### India v2 (section wave model)

| Step | Pattern | Approx time |
|---|---|---|
| MI + planning + legal graph | Sequential | 3–8 s |
| Parallel retrieval (both grounders) | Parallel | 5–15 s |
| Rule engine + outline | Sequential | 1–3 s |
| Section waves (depends on depth) | Parallel within wave | 15–60 s total |
| Per-section verify + repair | Per wave, per section | +5–15 s per fail |
| Final assembly + verify + history | Sequential | 3–8 s |
| **Total (standard)** | | **~30–90 s** |

### Platform v3 (sequential sections — major bottleneck)

| Step | Pattern | Approx time |
|---|---|---|
| createWorkspace | Single DB write | <1 s |
| runProcedural | Deterministic | <1 s |
| buildPlanAndOutline | No LLM | 1–2 s |
| generateAllSections (N sections) | **Strictly sequential** | N × 8–20 s |
| verifySections | Sequential heuristic | 1–3 s |
| adversarialReview | Parallel (2 LLM calls) | 5–15 s |
| repairSections | Sequential, max 3 per section | variable |
| **Total (8 sections, no repair)** | | **~70–170 s** |

### Deep research path (worst case)

ReAct agent runs up to `maxDeepResearchSteps` steps where each step is an LLM call + retrieval:
- Simple docs: 0 steps
- Standard: up to 3 steps (~15–30 s extra)
- Complex: up to 6 steps (~30–60 s extra)

---

## 8. Verification & Quality Checks

### 8.1 `DraftVerificationService` (India path)

Runs after every generation and after each regeneration loop.

| Check | Mechanism | LLM? |
|---|---|---|
| Statute normalization (IPC→BNS, CrPC→BNSS) | Rule-based map | No |
| Section Finder crosswalk fixes | DB/corpus lookup | No |
| Bare-act section lookup (per citation) | Sequential loop — `BareActLookupService` | No |
| Legal authority retrieval | `LegalRetrievalOrchestrator` | No |
| Similar case ranking | Vector search | No |
| Section mismatch correction | `SectionMismatchService` | Sometimes |
| Citation format + existence | `CitationVerificationService` | No |
| Substance checks | `SubstanceVerificationService` | No |
| Sentence-level audit | `SentenceAuditService` | No |
| Strip unverified citations | Regex sanitize | No |
| Legal safety blocklist | String match | No |
| Accuracy gate | `DraftAccuracyGateService` — certification label | No |

### 8.2 `ProceduralGateService` (v3 platform path)

Deterministic pre-generation checks — no LLM:

| Check | What it validates |
|---|---|
| Forum check | Whether the chosen court has jurisdiction |
| Limitation check | Whether the filing is within the limitation period |
| Standing check | Whether the petitioner has locus standi |
| Remedy check | Whether the claimed remedy is available in this forum |
| Notice requirement | Whether a pre-suit/statutory notice is required first |

### 8.3 `VerificationService` (v3 platform — post-generation)

Deterministic heuristics only — no LLM:

| Category | Checks |
|---|---|
| Structural | Unfilled `{{placeholders}}`, heading length, verification language, prayer language |
| Formatting | Broken citation references, excessive whitespace |
| Logical | Contradiction patterns between sections |
| Factual | Speculative language in facts section (`"allegedly"`, `"reportedly"` etc.) |

Filing readiness requires **score ≥ 70** and **zero critical failures**.

### 8.4 `AdversarialReviewService` (v3 platform)

Runs only for `riskLevel` = high or critical.

| Review type | Model | What it checks |
|---|---|---|
| Opposing counsel review | `gpt-5.4-mini` | Weaknesses the other side can exploit |
| Judge review | `gpt-5.4-mini` | Whether the filing meets court standards |

Both run in parallel (`Promise.all`).

### 8.5 `QualityFeedbackService` (adaptive routing)

Monitors user edits after AI generation:
- Records edit distance from `DraftSectionStateMachineService.recordUserEdit`
- After 10+ edit events, updates `AiModelAlias` routing
- Can recommend downgrade to `gpt-5.4-mini` (cost) or upgrade to `gpt-5.5` (quality)

---

## 9. Form Catalog & Discovery

### 9.1 Catalog

- **591 India forms** seeded from `legal_backend/src/legal-forms/catalog.generated.ts`
- Browsable at `/app/legal-forms` with intent search
- **Search:** `GET /legal-forms/intent-search` — token-based + semantic
- **Draft kind:** `india_form_catalog` routes to `buildIndiaCatalogFormPrompt()` factory

### 9.2 Draft Intent Resolution

**Service:** `legal_backend/src/ai/draft-intent/draft-intent.service.ts`

User types a natural language query → resolves to one of:
1. A curated `kind` (e.g. `bail_application`, `maintenance_petition`)
2. An official catalog form row
3. A bundle filing URL (multiple related documents)

### 9.3 Flutter Search (`form_search.dart`)

Client-side search against the curated format list:
1. Tokenize query — strip stopwords
2. Expand domain synonyms (maintenance, bail, writ, divorce, etc.)
3. Score against `indiaDraftFormats` + `usDraftQuickKinds`
4. Levenshtein fuzzy match for tokens ≥ 5 chars
5. Threshold score ≥ 0.25, return top 12

---

## 10. Queue & Job System

| Mechanism | Used for drafting? | Details |
|---|---|---|
| **Synchronous HTTP** | Primary | India draft generate, v3 stages, most sessions |
| **WorkflowRun polling** | v3 progress tracking only | Frontend polls every 3–4 s — not async execution |
| **BullMQ** | Lead drafts only | `LEAD_DRAFT_GENERATE`, `DRAFT_DOCUMENT` (copilot/summary) |
| **Shadow v2** | Quality comparison | Fire-and-forget after v1 returns — not returned to user |

**Why no queue for India draft?** The frontend holds an open HTTP connection (up to 600 s for filing-grade docs). In production, the web app calls the backend directly via `NEXT_PUBLIC_WS_URL` to bypass Vercel's 300 s function timeout.

---

## 11. Frontend — Web & Flutter

### 11.1 Web Pages & Components

| File | Role |
|---|---|
| `legal_web/app/app/india-drafting/draft/page.tsx` | Main generate page — calls `generateIndiaDraft`, v2 section panel, 120 s / 600 s timeouts |
| `legal_web/components/india-drafting/IndiaDraftOutputPanel.tsx` | Draft output + verification audit panel |
| `legal_web/components/india-drafting/india-drafting-workspace.tsx` | Format catalog browser (picks a kind) |
| `legal_web/components/matters/india-drafting-workspace.tsx` | Matter-linked v3 section editor, workflow polling, approve/export |
| `legal_web/components/india-drafting/india-draft-editor.tsx` | Questionnaire → template merge → fill-blanks → selection edit |
| `legal_web/components/drafting/accuracy/DraftGenerationProgress.tsx` | Animated progress steps (different for v1 vs v2) |
| `legal_web/lib/api/india-drafting.ts` | API client; long generates bypass Vercel via direct backend URL |

### 11.2 Frontend Timeouts

| Mode | Timeout |
|---|---|
| Express / notice | 120 s |
| Filing-grade / premium | 600 s |

### 11.3 Flutter App

| File | Role |
|---|---|
| `legal_app/lib/core/drafting/form_search.dart` | Client-side curated + US format search |
| `legal_app/lib/core/drafting/draft_navigation.dart` | URL parsing, draft set persistence in SharedPreferences, field hint extraction |
| `legal_app/lib/core/drafting/action_context_prompts.dart` | Context prompts for strategy action steps |

Flutter routes to `/lawyer/docu-draft/draft` with query params that map to India draft kinds.

---

## 12. Complete User Journey

### India AI Draft (most common path)

```
1. DISCOVER
   ├── Legal forms search → /app/legal-forms
   ├── Draft intent panel → natural language → kind resolution
   ├── Curated catalog browse → /app/india-drafting
   └── Flutter form_search → searchCuratedFormats()

2. NAVIGATE
   └── /app/india-drafting/draft?kind=bail_application&label=...
       optional: &autoGenerate=1, &bundleId=..., &setIndex=...

3. ENTER FACTS
   ├── Case details text area
   ├── Client, court, opposing party fields
   └── Optional attachment → POST /ai/india-draft/extract-context (PDF/image)

4. CREDIT GATE
   ├── Frontend wallet check
   └── Backend assertSufficientBalance() → 402 if insufficient

5. GENERATE
   └── POST /ai/india-draft/generate
       ├── v2 path (if enabled): 12-stage pipeline, section waves
       └── v1 path: sequential 13-step pipeline
       Both: up to 600 s synchronous HTTP

6. REVIEW OUTPUT
   ├── Verification audit panel (citations, statutes)
   ├── Procedural determination block
   ├── v2: section panel with per-section confidence scores
   └── Citation appendix

7. EDIT
   ├── Selection-based edit → POST /ai/india-draft/edit
   └── Fill remaining blanks → POST /ai/india-draft/fill-blanks

8. SAVE
   └── Auto-persisted to CourtDraftRecord (draftId returned in generate response)

9. EXPORT
   └── POST /ai/india-draft/export → styled HTML → client-side PDF/DOCX

10. LINK
    └── PATCH /ai/drafts/:id/link-to-client → attaches to client record
```

---

## 13. Known Issues & Gaps

### Critical

| Issue | Location | Impact |
|---|---|---|
| **v3 section generation uses broken Gemini model names** | `draft-orchestration.service.ts` `selectModelForSectionType()` | v3 sections produce placeholder content, not real AI output |
| **v3 `generateAllSections` is fully sequential** | `draft-orchestration.service.ts` lines 391–394 | O(N) latency — 8 sections × 15 s = 120 s minimum, no parallelism |

### Architectural

| Issue | Impact |
|---|---|
| No background job for India draft generate | Single HTTP connection must stay open up to 600 s; any proxy timeout kills the request |
| Two "India drafting workspace" components with identical names | Confusing — `components/india-drafting/` is format picker; `components/matters/` is the v3 editor |
| Shadow v2 doubles LLM spend when `DRAFT_ENGINE_V2_SHADOW=true` | Cost risk in high-volume usage |
| Cycle margin guard silently downgrades model | Users on premium tier get sonnet-quality output without warning |
| DeepResearch ReAct loop has no hard timeout | A stuck research loop can consume the full HTTP window |

### Performance

| Issue | Approx impact |
|---|---|
| Bare-act lookup loop is sequential per citation | +1–3 s per unique statute reference in the draft |
| v1 continuation loops (up to 3) re-call the same LLM | +25–75 s if the model consistently truncates |
| v3 adversarial review runs even when not needed | +10–15 s for high-risk docs that don't need both counsel + judge |
| Research grounding runs deep ReAct for complex docs | +30–60 s before generation even starts |

---

## 14. Key File Index

### Backend

| Area | Path |
|---|---|
| India draft controller | `legal_backend/src/ai/india-draft/india-draft.controller.ts` |
| India draft service (v1 + routing) | `legal_backend/src/ai/india-draft/india-draft.service.ts` |
| v2 engine | `legal_backend/src/ai/drafting-v2/draft-engine-v2.service.ts` |
| v2 section generator | `legal_backend/src/ai/drafting-v2/section-generator.service.ts` |
| v2 targeted repair | `legal_backend/src/ai/drafting-v2/targeted-repair.service.ts` |
| Kind-specific prompts | `legal_backend/src/ai/india-draft/india-draft-prompts.ts` |
| Catalog form prompt factory | `legal_backend/src/ai/india-draft/india-catalog-prompt.factory.ts` |
| Legal accuracy protocol | `legal_backend/src/ai/drafting/legal-accuracy-protocol.ts` |
| Research grounding | `legal_backend/src/ai/drafting/draft-research-grounding.service.ts` |
| Statute grounding | `legal_backend/src/ai/drafting/india-draft-grounding.service.ts` |
| Draft verification | `legal_backend/src/ai/drafting/draft-verification.service.ts` |
| Accuracy gate | `legal_backend/src/ai/drafting/draft-accuracy-gate.service.ts` |
| LLM gateway | `legal_backend/src/ai/llm-completion.service.ts` |
| Model costs config | `legal_backend/src/ai/model-costs.config.ts` |
| Quality feedback | `legal_backend/src/ai/feedback/quality-feedback.service.ts` |
| Draft intent resolution | `legal_backend/src/ai/draft-intent/draft-intent.service.ts` |
| v3 orchestration | `legal_backend/src/platform/drafting/draft-orchestration.service.ts` |
| v3 procedural gate | `legal_backend/src/platform/drafting/procedural-gate.service.ts` |
| v3 adversarial review | `legal_backend/src/platform/drafting/adversarial-review.service.ts` |
| v3 targeted repair | `legal_backend/src/platform/drafting/targeted-repair.service.ts` |
| v3 section state machine | `legal_backend/src/platform/drafting/draft-section-state-machine.service.ts` |
| v3 verification | `legal_backend/src/platform/verification/verification.service.ts` |
| Legal forms service | `legal_backend/src/legal-forms/legal-forms.service.ts` |
| Legal forms catalog seed | `legal_backend/src/legal-forms/catalog.generated.ts` |

### Frontend (Web)

| Area | Path |
|---|---|
| Main generate page | `legal_web/app/app/india-drafting/draft/page.tsx` |
| Format catalog browser | `legal_web/components/india-drafting/india-drafting-workspace.tsx` |
| Matter v3 section editor | `legal_web/components/matters/india-drafting-workspace.tsx` |
| Output + verification panel | `legal_web/components/india-drafting/IndiaDraftOutputPanel.tsx` |
| Draft editor (questionnaire) | `legal_web/components/india-drafting/india-draft-editor.tsx` |
| Progress animation | `legal_web/components/drafting/accuracy/DraftGenerationProgress.tsx` |
| API client | `legal_web/lib/api/india-drafting.ts` |
| Curated format list | `legal_web/lib/india-drafting/formats.ts` |

### Flutter App

| Area | Path |
|---|---|
| Form search | `legal_app/lib/core/drafting/form_search.dart` |
| Draft navigation | `legal_app/lib/core/drafting/draft_navigation.dart` |
| Action context prompts | `legal_app/lib/core/drafting/action_context_prompts.dart` |

---

*Generated from codebase exploration — Jun 27, 2026*
