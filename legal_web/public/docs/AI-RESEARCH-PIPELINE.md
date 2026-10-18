# AI Legal Research Pipeline

**Last updated:** 2026-06-27  
**Covers:** `/app/research` page — from query entry to final output, including citation audit, model selection, and identified performance bottlenecks.

---

## Table of Contents

1. [Architecture at a Glance](#1-architecture-at-a-glance)
2. [Frontend — Research Page](#2-frontend--research-page)
3. [API Layer](#3-api-layer)
4. [Main Orchestration — `runLawyerLegalResearch`](#4-main-orchestration--runlawyerlegalresearch)
5. [Legal Retrieval](#5-legal-retrieval)
6. [Deep Research — ReAct Agent](#6-deep-research--react-agent)
7. [Synthesis — LLM Generation](#7-synthesis--llm-generation)
8. [Verification Pipeline](#8-verification-pipeline)
9. [Citation Audit](#9-citation-audit)
10. [Output Format](#10-output-format)
11. [AI Models & Costs](#11-ai-models--costs)
12. [Why It's Slow — Bottleneck Analysis](#12-why-its-slow--bottleneck-analysis)
13. [Key File Index](#13-key-file-index)

---

## 1. Architecture at a Glance

```
User types query
      │
      ▼
/app/research (Next.js)
      │  POST /api/v1/ai/research  (max 300s)
      ▼
NestJS POST /ai/research  (ai.controller.ts)
      │
      ▼
AiGatewayService.runLawyerLegalResearch()      ← orchestrates all stages
      │
      ├─ 1. Classify query (heuristic ± LLM)
      ├─ 2. Resolve AI model
      ├─ 3. Load prior authorities (matter context)
      ├─ 4. LegalRetrievalOrchestrator.retrieve()
      │       ├─ BareActLookup / HybridSearch / FirmMemory
      │       └─ Live connectors: IndiaKanoon / CourtListener / Tavily
      ├─ 5. [DEEP only] DeepResearchAgentService.runDeepResearch()
      │       └─ ReActAgentService.runWithTools()  ← up to 6 LLM steps
      ├─ 6. FirmMemory + SimilarCases
      ├─ 7. [Cache check]
      ├─ 8. generateResearchWithOpenAi()           ← main LLM synthesis
      ├─ 9. LegalResearchVerificationService       ← may trigger regen
      ├─ 10. LegalCitationVerifierService          ← citation audit
      ├─ 11. SectionMismatchService
      ├─ 12. Persist (prisma.aIOutput)
      └─ Return full JSON to frontend
```

**Transport:** synchronous HTTP JSON — the page waits for the full response. No SSE or WebSocket. Async jobs (via `/ai/research/async`) use HTTP polling every 2 s.

---

## 2. Frontend — Research Page

**File:** `legal_web/app/app/research/page.tsx`

### The two research modes

| UI label | `researchMode` param | What changes |
|---|---|---|
| **Fast Answer** | `FAST` | Uses cheaper model; FAST prompt; appends unverified disclaimer |
| **Verified Research** | `DEEP` | Forces premium synthesis model; runs full ReAct agent; stricter citation rules; shows "Verified" badge |

Default is **Verified Research** (`DEEP`). If the user hits a premium credit error, the UI auto-falls back to `FAST + AUTO`.

### AI model picker

Component: `AiModelPicker` / `useAiModel()` context.

| Picker | Effect |
|---|---|
| **Auto** | Backend uses `AI_REASONING_MODEL` (currently `gpt-5.5`) |
| **Premium** | User picks from available premium models (Sonnet, Opus, GPT-5.5 Pro); Verified Research forces Opus-class anyway |

### Language selector (India only)

Component: `BilingualLanguagePicker`.  
Primary pills: **English** / **Hindi**. "More" dropdown: Tamil, Telugu, Bengali, etc. (all mapped to `"hi"` output).

> **Known gap:** The `outputLanguage` param is sent by the frontend but the sync controller does not wire it into the gateway. Actual output language today derives from `Accept-Language` / the UI locale cookie. The picker alone does not work until `outputLanguage` is threaded through `ai.controller.ts → runLawyerLegalResearch → buildLocalePromptInstruction`.

### Voice input

`VoiceDictationButton` — Web Speech API, Whisper fallback. Sets lang to `hi-IN` when India + Hindi is selected. Appends final transcript to the query box.

### Topic browse chips

- Suggested queries come from `listTaskPatterns({ targetFeature: "research" })`.
- "Browse by topic" chips open a `PromptLibraryModal` filtered by legal domain.

### Credits shown before search

Floor: **30 credits** (`FEATURE_CREDIT_COSTS.LEGAL_RESEARCH`). Actual charge is token-based (can be more). Cached results cost **0 credits**.

### Progress UI

`LegalResearchProgress` is cosmetic/timer-based on the sync page — it has no real backend phase signals. Real phased progress is only available on the async `[jobId]` page.

---

## 3. API Layer

### Sync endpoint (used by main page)

```
POST /ai/research          → ai.controller.ts → runLawyerLegalResearch()
```

**Next.js proxy:** `legal_web/app/api/v1/ai/research/route.ts`
- Rate limit: 20 req / min / IP
- `maxDuration: 300` seconds (Vercel ceiling)
- Body limit: 64 KB

### Key DTO fields (`LegalResearchDto`)

| Field | Required | Notes |
|---|---|---|
| `query` | yes | min 3 chars backend, min 10 frontend |
| `countryCode` | yes | `IN`, `US`, etc. |
| `jurisdiction` | no | state / region |
| `researchMode` | no | `FAST` \| `DEEP`; defaults `FAST` in gateway |
| `aiModelMode` | no | `AUTO` \| `PREMIUM` |
| `premiumModelId` | no | only when `PREMIUM` |
| `matterId` | no | links matter for firm-memory + authority thread |
| `priorContext` | no | follow-up / refinement string |
| `outputLanguage` | no | `hi` \| `hinglish` — **not wired on sync path yet** |

### Async endpoint

```
POST /ai/research/async    → BullMQ job LEGAL_RESEARCH_MEMO
                           → research.worker.ts → same runLawyerLegalResearch()
```

Frontend polls `GET /ai/research/jobs/:id` every 2 s. Partial draft is written to the job before citation audit completes so the UI can show "Draft ready" earlier.

---

## 4. Main Orchestration — `runLawyerLegalResearch`

**File:** `legal_backend/src/ai/ai-gateway.service.ts`

All 19 stages run sequentially as a single `await` chain:

| # | Stage | Description |
|---|---|---|
| 1 | **Classify** | `LegalResearchClassifierService.classifyAsync()` — domain, issue type, jurisdiction, `requiresCurrentLawCheck`. Uses LLM if heuristic confidence < 0.7. |
| 2 | **Model route** | `AiModelResolverService.resolveForTask(LEGAL_RESEARCH, forDeepAnalysis)` |
| 3 | **Prior authorities** | `AuthorityThreadService.loadChain()` from matter (if `matterId`) |
| 4 | **Retrieve** | `LegalRetrievalOrchestrator.retrieve()` + authority ranking |
| 4b | **Gap escalation** | If bare-act section missing, optional short ReAct even in FAST mode |
| 5 | **Deep agent** | `DeepResearchAgentService.runDeepResearch()` — DEEP mode only |
| 6 | **Firm memory + similar cases** | `FirmMemoryService.search()` (8 hits); `SimilarCasesService.extractAndRank()` |
| 7 | **Corrections** | Admin-approved correction prompt blocks loaded |
| 8 | **Cache check** | Redis key: `ai:research` + `RESEARCH_SYSTEM_VERSION` (`v6-20260614`) |
| 9 | **Credit / budget** | `creditEnforcement.assertSufficientBalance()` + policy check |
| 10 | **Generate** | `generateResearchWithOpenAi()` — main LLM synthesis |
| 11 | **Compliance** | `complianceGuard.sanitizeOutput()` |
| 12 | **Verify** | `LegalResearchVerificationService.verifyAndPublish()` — may trigger one regen LLM call |
| 13 | **Authority bundle** | `AuthorityThreadService.saveBundle()` |
| 14 | **Citation audit** | `LegalCitationVerifierService.verifyLegalResearchOutput()` |
| 15 | **Section cross-check** | `SectionMismatchService.checkAndCorrect()` |
| 16 | **Sanitize** | `sanitizeResearchOutputMarkdown()` |
| 17 | **Persist** | `prisma.aIOutput.create` + citations + usage log |
| 18 | **Done** | Return result + `creditsUsed` to controller |

---

## 5. Legal Retrieval

**File:** `legal_backend/src/legal-search/legal-retrieval-orchestrator.service.ts`

```
retrieve(input)
  │
  ├─ LegalSearchPlanService.buildSearchPlan()
  │     Expands query into up to 10 variants using statute registry,
  │     jurisdiction overlays, practiceArea.
  │
  ├─ [Cache check]
  │
  ├─ For each query variant (sequential):
  │     KnowledgeStackService.search()
  │       ├─ BareActLookupService (exact § pin or fuzzy)
  │       ├─ HybridSearchService (OpenSearch BM25+kNN + embedding fallback)
  │       └─ FirmMemoryService (6 hits, skip on exact pin)
  │
  ├─ supplementWithLiveConnectors()   if < 3 primary authorities
  │     ├─ IndiaKanoon   — up to 4 queries × 5 results  (IN only)
  │     ├─ CourtListener — up to 3 queries              (US)
  │     └─ Tavily web   — up to 3 queries × 6 results  (all)
  │
  └─ LegalRerankerService.rerank()
        Lexical overlap + source-tier boost → top 5 returned
```

### Source tiers

| Tier | Examples |
|---|---|
| `primary` | Bare acts, official legislation |
| `seed` | Internal curated corpus |
| `case_law` | IndiaKanoon, CourtListener |
| `web` | Tavily (India Code, PRS, legislation sites) |

### Retrieval constants

- `MIN_AUTHORITIES = 3` — triggers live supplementation if below
- `RERANK_POOL = 20` — candidates before rerank
- `RERANK_TOP = 5` — final authorities passed to LLM

---

## 6. Deep Research — ReAct Agent

**Files:**
- `legal_backend/src/legal-search/deep-research-agent.service.ts` — `runDeepResearch()`
- `legal_backend/src/ai/react-agent.service.ts` — `runWithTools()` / `runLoop()`

Only runs in **Verified Research (`DEEP`)** mode (and optionally on bare-act gap escalation in FAST).

### How it works

1. Merges `priorAuthorities` from gateway retrieval.
2. Runs **base retrieval** again (duplication — see bottlenecks §12).
3. Builds enriched query via `buildAuthorityContextBlock()`.
4. Calls `ReActAgentService.runWithTools(query, tools, { maxSteps: 6 })`.
5. Agent loops: **Thought → Action → Observation → repeat** until it issues `FINAL_ANSWER` or `maxSteps` is hit.
6. Returns `{ finalAnswer, authorities, toolsUsed, sufficiencyPassed, steps }`.

The `finalAnswer` text from ReAct is **not** the user-facing memo — the agent primarily discovers and expands the authority set. The actual memo is generated in step §7.

### ReAct step parameters

| Param | Default | Hard cap |
|---|---|---|
| `maxSteps` | **6** | **10** |
| Per-step inter-step delay | **400 ms** | — |
| Per-step `maxTokens` | **1,200** | — |
| Per-step `temperature` | **0.1** | — |

At 6 steps × (LLM latency + 400 ms), this alone can add **10–30 s** to DEEP requests.

### Available tools

| Tool | What it calls |
|---|---|
| `search_statute` | `BareActLookupService.lookupSection()` |
| `search_corpus` | `HybridSearchService.search()` |
| `search_cases` | `IndiaKanoonConnector.search()` (IN only) |
| `search_matter` | Prisma matter facts + `FirmMemoryService` |
| `evaluate_sufficiency` | Internal heuristic (forum, procedure, statute coverage) |
| `fetch_primary_passage` | `prisma.legalAuthority` full text |
| `fetch_statute_text` | `StatuteFetchConnector.fetchText()` (external URL) |
| `search_web` | `TavilySearchConnector.search()` (if Tavily key configured) |

---

## 7. Synthesis — LLM Generation

**Function:** `generateResearchWithOpenAi()` (inside `ai-gateway.service.ts`)

The main memo LLM call. One call for FAST, one call for DEEP (possibly a second if verification triggers regeneration).

### Prompt construction

The system prompt is assembled from multiple layers in order:

1. `MASTER_LEGAL_RESEARCH_PROMPT` — base instructions, structure, format
2. `CITATION_DISCIPLINE_PROMPT` — citation format rules (SCC/AIR for India)
3. `LEGAL_MEMO_STRUCTURE_PROMPT` — output sections
4. `buildLocalePromptInstruction(locale)` — language instruction
5. Jurisdiction overlay — state-specific rules
6. Verified Research hard rule: "only cite authorities in the RETRIEVED AUTHORITIES block"
7. Authority context block — up to top-5 retrieved authorities with full text (up to 2,000 chars each)
8. Firm memory snippets
9. Similar cases block
10. Admin corrections block
11. FAST mode adds disclaimer instruction

### Model parameters

| | FAST | DEEP (Verified) |
|---|---|---|
| Input budget | 64,000 tokens | 64,000 tokens |
| Output budget | 9,000 tokens | **14,000 tokens** |
| `reasoningEffort` | `"high"` | `"xhigh"` |

### Output structure (instructed)

1. Short direct answer (2–3 sentences)
2. Legal analysis with sub-sections
3. Applicable authorities (linked citations)
4. Practical next steps
5. Limitations / caveats
6. Follow-up question sentinel: `FOLLOW_UP_QUESTIONS_JSON: ["q1","q2","q3"]` — stripped before display

---

## 8. Verification Pipeline

**File:** `legal_backend/src/legal-search/legal-research-verification.service.ts`  
**Function:** `verifyAndPublish()`

Runs after generation, before citation audit. May trigger **one additional generation call** if checks fail.

### Sub-checks (all sequential)

| Check | Service |
|---|---|
| Citation match | `CitationVerificationService.verifyCitations()` |
| Bare-act substance | `SubstanceVerificationService.checkBareActSubstance()` |
| Output classify | `VerifyClassifierService.classify()` |
| Sanity | `LegalSanityCheckService.check()` |
| Sentence audit | `SentenceAuditService.audit()` |
| Section alignment | `SectionAlignmentService.check()` — for bare-act section queries |
| Current law | `CurrentLawCheckerService` — adds treatment note if `requiresCurrentLawCheck` |

If enough checks fail, a second `generateResearchWithOpenAi()` call is made with a corrective prompt. This is the main cause of unexpectedly long FAST-mode responses.

---

## 9. Citation Audit

**File:** `legal_backend/src/ai/legal-research/legal-citation-verifier.service.ts`  
**Function:** `verifyLegalResearchOutput()`

Runs for **both** FAST and DEEP modes. Does not modify the memo text — produces structured metadata only.

### Steps

1. Extract case citations using regex patterns (SCC, AIR, All ER, US Reports, etc.).
2. Extract statute citations (BNSS, BNS, CrPC, IPC, etc.).
3. Fuzzy-match extracted citations against retrieved authorities.
4. Unmatched citations → query `LegalAuthorityRecord` in DB.
5. Classify each claim as `supported` / `unsupported`.
6. Compute `sourceQuality`:

| Value | Meaning |
|---|---|
| `OFFICIAL_PRIMARY` | All citations from primary-tier sources |
| `MIXED_PRIMARY_SECONDARY` | Mix of tiers |
| `SECONDARY_ONLY` | No primary sources used |
| `INSUFFICIENT` | Too few verified sources |

7. Return `CitationAuditResult` — stored on `aIOutput.citationAudit`.

### Frontend display

`ResearchVerificationCard`:
- "X of Y citations verified" count
- `sourceQuality` badge
- List of unsupported claims
- Clicking a case opens its `sourceUrl` (IndiaKanoon link, CourtListener, etc.)

---

## 10. Output Format

### Response JSON (returned to frontend)

```typescript
{
  outputMarkdown: string          // full memo
  citations: Array<{
    authorityId: string
    sourceName: string
    sourceUrl: string | null
    citation: string              // "AIR 1978 SC 179"
    confidence: number            // 0–1
  }>
  citationAudit: CitationAuditResult
  verified: boolean
  sourceQuality: string
  legalDomain: string
  jurisdiction: string
  creditsUsed: number
  followUpQuestions: string[]     // parsed from LLM sentinel
  similarCases: SimilarCase[]
}
```

### Markdown structure

- `##` / `###` headings rendered by `AnswerSection` component
- Bullets, numbered lists, tables all supported
- FAST mode gets disclaimer footer block appended
- Unverified-citation warning blockquote when verification found issues

### Similar cases panel

`SimilarCasesService.extractAndRank()` returns up to 8 case-law authorities with:
- `sourceUrl` — clickable external link (IndiaKanoon, CourtListener)
- `bindingWeight`: `binding` / `persuasive` / `informational`
- `verificationStatus`: `verified` / `needs_verification` / `source_only`

### Hindi output (current behaviour)

The `outputLanguage` frontend picker sends `hi` / `hinglish` but the **sync controller does not forward it** to the gateway. Hindi output today only works if the user's browser/app UI locale is `hi`, because the gateway reads `Accept-Language` via `resolveRequestLocale()`.

**Fix needed:** thread `dto.outputLanguage → input.outputLanguage → buildLocalePromptInstruction()`.

### Post-processing

- `sanitizeResearchOutputMarkdown()` — strips per-item "Citation needs verification" noise (`research-output-sanitizer.ts`)
- Follow-up question sentinel stripped
- Compliance guard sanitization

---

## 11. AI Models & Costs

### Model selection per stage

| Stage | Mode | Model env var | Default model |
|---|---|---|---|
| Main synthesis | FAST + AUTO | `AI_REASONING_MODEL` | **gpt-5.5** |
| Main synthesis | FAST + PREMIUM | user-selected | claude-sonnet-4-6 |
| Main synthesis | DEEP (Verified) | `deepAnalysisPremiumModelId` | **claude-opus-4-8** |
| ReAct agent steps | DEEP | `AI_MID_MODEL` | **gpt-5.5** |
| Gap escalation ReAct | FAST | `AI_CHEAP_MODEL` | **gpt-5.4-mini** |
| MI classify (optional) | both | OpenAI | gpt-5.4-mini class |
| Verification regen | both | same as synthesis | same |

### Provider cost ($/1M tokens)

| Model | Input | Output | Used for |
|---|---|---|---|
| gpt-5.4-mini | $0.40 | $1.60 | Cheap classify, gap ReAct |
| gpt-5.5 | $5.00 | $30.00 | AUTO synthesis + mid ReAct |
| gpt-5.5-pro | $30.00 | $180.00 | User PREMIUM option |
| claude-opus-4-8 | premium tier | — | Default DEEP synthesis |
| claude-sonnet-4-6 | premium tier | — | PREMIUM picker option |

### LLM call count

| Stage | FAST | DEEP |
|---|---|---|
| MI classify | 0–1 | 0–1 |
| ReAct steps | 0 | **1–6** |
| Main synthesis | 1 | 1 |
| Verification regen | 0–1 | 0–1 |
| Citation audit | 0 (DB/regex) | 0 |
| **Total** | **1–3** | **2–9** |

### Credits charged

- Floor: **30 credits** (`AI_CREDIT_COSTS.LEGAL_RESEARCH`)
- Actual: `max(30, token-based)` via `debitForTokenUsage()`
- Plan tier affects credits per token: Enterprise pays fewer credits than Starter for the same call

---

## 12. Why It's Slow — Bottleneck Analysis

### Sequential pipeline (no parallelism today)

Every stage awaits the previous one. The full chain is a single linear `await` sequence inside `runLawyerLegalResearch`. Stages that could easily run in parallel are not:

```
classify → retrieve → deep-agent → firm-memory → similar-cases 
→ generate → verify → audit → section-check → persist
```

### Top bottlenecks

| Bottleneck | Typical impact | Notes |
|---|---|---|
| **ReAct agent (DEEP)** | +10–30 s | Up to 6 sequential LLM calls × (model latency + 400ms sleep). Hard cap 10 steps. |
| **Duplicate retrieval** | +2–5 s | Gateway retrieves, then deep agent retrieves again independently. |
| **Sequential query variants** | +2–8 s | Up to 10 query variants run one-by-one in `KnowledgeStackService`. |
| **Sequential live connectors** | +3–15 s | India Kanoon (4 queries), CourtListener (3), Tavily (3) — all sequential per variant. |
| **Large prompt assembly** | +0.5–1 s | 64k input budget; authority text up to 2,000 chars × 5 authorities; jurisdiction overlays. |
| **DEEP synthesis model** | +5–20 s | `claude-opus-4-8` with `reasoningEffort: "xhigh"` is intentionally slow/thorough. |
| **Verification regen (occasional)** | +5–15 s | One extra synthesis call when checks fail — adds full synthesis latency again. |
| **Sequential verification sub-checks** | +0.5–2 s | 6 verification sub-services all await each other. |
| **No streaming to frontend** | perceived impact | User sees a blank/spinner until full JSON returns. First token arrives 30+ s later on DEEP. |

### Timeouts

| Layer | Limit |
|---|---|
| Next.js proxy | **300 s** (`maxDuration`) |
| `runLawyerLegalResearch` | **None** |
| ReAct per step | **None** (only rate-limit catch) |
| Deep research in draft module | 45 s (separate codepath — not this page) |

### Parallelization opportunities (not yet implemented)

1. **Query variant retrieval** — run `KnowledgeStackService.search()` across all variants with `Promise.all`.
2. **Live connector supplementation** — run IndiaKanoon / CourtListener / Tavily in parallel.
3. **Dedup retrieval** — pass gateway-retrieved authorities into deep agent instead of re-retrieving.
4. **Parallel post-gen stages** — run citation audit and section cross-check concurrently after synthesis.
5. **Parallel verification sub-checks** — most of the 6 sub-checks are independent.
6. **Streaming response** — stream synthesis tokens via SSE so the user sees content arriving instead of a blank screen.
7. **Async by default** — move all DEEP requests to the async job path; return `jobId` immediately and poll. The async path already has partial-draft delivery.

---

## 13. Key File Index

| Concern | Path |
|---|---|
| Frontend research page | `legal_web/app/app/research/page.tsx` |
| Async job polling UI | `legal_web/app/app/research/[jobId]/page.tsx` |
| API client | `legal_web/lib/api/ai.ts` |
| Next.js proxy | `legal_web/app/api/v1/ai/research/route.ts` |
| NestJS controller | `legal_backend/src/ai/ai.controller.ts` |
| Request DTO | `legal_backend/src/ai/dto/legal-research.dto.ts` |
| **Main orchestrator** | `legal_backend/src/ai/ai-gateway.service.ts` → `runLawyerLegalResearch` |
| Query classifier | `legal_backend/src/ai/legal-research/legal-research-classifier.service.ts` |
| **Retrieval orchestrator** | `legal_backend/src/legal-search/legal-retrieval-orchestrator.service.ts` |
| Knowledge stack | `legal_backend/src/legal-search/knowledge-stack.service.ts` |
| Hybrid search | `legal_backend/src/legal-sources/search/hybrid-search.service.ts` |
| India Kanoon connector | `legal_backend/src/legal-sources/connectors/india-kanoon.connector.ts` |
| CourtListener connector | `legal_backend/src/legal-sources/connectors/courtlistener.connector.ts` |
| Tavily connector | `legal_backend/src/legal-sources/connectors/tavily-search.connector.ts` |
| **Deep research agent** | `legal_backend/src/legal-search/deep-research-agent.service.ts` |
| **ReAct agent** | `legal_backend/src/ai/react-agent.service.ts` |
| Main synthesis | `generateResearchWithOpenAi()` in `ai-gateway.service.ts` |
| Verification | `legal_backend/src/legal-search/legal-research-verification.service.ts` |
| **Citation audit** | `legal_backend/src/ai/legal-research/legal-citation-verifier.service.ts` |
| Section mismatch | `legal_backend/src/ai/legal-research/section-mismatch.service.ts` |
| Output sanitizer | `legal_backend/src/ai/legal-research/research-output-sanitizer.ts` |
| Model router | `legal_backend/src/ai/model-router/model-router.service.ts` |
| Model costs | `legal_backend/src/ai/model-costs.config.ts` |
| Credit costs | `legal_backend/src/ai-credits/credit-costs.ts` |
| Async worker | `legal_backend/src/jobs/workers/research.worker.ts` |
| Progress UI component | `legal_web/components/legal-research/legal-research-progress.tsx` |
| Verification card UI | `legal_web/components/research/research-verification-card.tsx` |
| Similar cases UI | `legal_web/components/research/similar-cases-panel.tsx` |
| AI model picker | `legal_web/components/credits/AiModelPicker.tsx` |
