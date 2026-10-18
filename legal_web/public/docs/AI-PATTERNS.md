# Umbrella AI Patterns Registry

**Architecture:** Harvey "factory line" model — 15 horizontal AI patterns, each mapping to one or more backend agents and one or more UI entry points. Chain patterns to compose higher-order workflows.

---

## Pattern Catalogue

| # | Pattern | Agent(s) | UI Entry Point(s) | Status |
|---|---------|----------|-------------------|--------|
| 1 | [Case law research](#1-case-law-research) | `research-agent` | `/app/research`, Copilot `@research`, matter AI tab | Shipped |
| 2 | [Regulatory research](#2-regulatory-research) | `research-agent`, legal-sources connectors | `/app/research?source=regulations`, Knowledge Source Picker | Shipped |
| 3 | [Clause extraction](#3-clause-extraction) | `diligence-agent` | Document review, Workflow sheet, Vault search | Shipped |
| 4 | [Compare/contrast cases](#4-comparecontrast-cases) | `research-agent` | Similar cases panel, Copilot `@compare` | Shipped |
| 5 | [Synthesis to facts](#5-synthesis-to-facts) | `matter-analyst` | Matter Facts tab, MI pipeline, Copilot | Shipped |
| 6 | [Playbook compare](#6-playbook-compare) | `diligence-agent` | Clause Compare panel, Firm vault | Partial |
| 7 | [Diligence bulk](#7-diligence-bulk) | `diligence-agent` | Vault bulk review, `/app/matters/[id]/diligence` | Shipped |
| 8 | [Citation audit](#8-citation-audit) | `research-agent`, citation-verification | Research page (auto), Citation Challenge modal | Shipped |
| 9 | [Draft generation](#9-draft-generation) | `drafting-agent` | India Draft, US Drafting, Matter Draft tab | Shipped |
| 10 | [Redline / amend](#10-redline--amend) | `diligence-agent`, Inline AI bubble | Rich-text editor (highlight → Ask Umbrella) | Shipped |
| 11 | [Outcome analysis](#11-outcome-analysis) | `outcome-analyzer` | Matter Outcome tab, Outcome Preview card | Shipped |
| 12 | [Evidence gap](#12-evidence-gap) | `evidence-gap` | Matter Evidence tab, Vault search | Shipped |
| 13 | [Deadline / SLA](#13-deadline--sla) | `deadline`, automations | Matter court deadlines, Calendar, Alerts | Shipped |
| 14 | [Meeting → facts](#14-meeting--facts) | meetings module, `matter-analyst` | Meeting detail, Timeline injection | Shipped |
| 15 | [Firm memory retrieve](#15-firm-memory-retrieve) | firm-memory (read + write) | Vault search, Clause Compare, Copilot context | Shipped |

---

## Pattern Specifications

### 1. Case Law Research
**Purpose:** Authority-backed legal research memo with citations and matter context.

**Agent:** `research-agent` → `DeepResearchAgentService`

**Input signals:**
- User query (natural language)
- Country code + jurisdiction
- Knowledge sources selected (statutes, case_law, regulations, firm_vault, web)
- Prior conversation context

**Output:** Markdown research memo, ordered citations with treatment status, confidence score, suggested follow-ups.

**UI entry points:**
- `/app/research` — primary research page with Knowledge Source Picker
- Copilot `@agent research-agent [query]`
- Matter AI tab → "Research relevant precedents"

**Chaining:** → Citation Audit (pattern 8) → Synthesis to Facts (pattern 5)

---

### 2. Regulatory Research
**Purpose:** Compliance-focused research on regulations, guidance, and delegated legislation.

**Agent:** `research-agent` + legal-sources connectors (India Code, CourtListener, Tavily, EDGAR)

**Input signals:** Same as case law research + `knowledgeSources: ["regulations", "tax"]`

**Output:** Regulatory memo, applicable rules, penalty exposure, jurisdiction-specific notes.

**UI entry points:**
- Knowledge Source Picker: select "Regulations" or "Tax law"
- Workflow sheet: "Regulatory memo" workflow

**Chaining:** → Draft Generation (pattern 9)

---

### 3. Clause Extraction
**Purpose:** Extract, categorise, and risk-flag clauses from uploaded documents.

**Agent:** `diligence-agent` → `DocumentReviewOrchestrator`

**Input signals:** Document ID or uploaded file, clause kinds to extract (optional), playbook reference (optional)

**Output:** Structured clause table, risk flags per clause, suggested redlines.

**UI entry points:**
- Document Review page
- Workflow sheet: "Clause extraction" workflow
- Vault: select document → Run workflow

**Chaining:** → Playbook Compare (pattern 6) → Redline (pattern 10)

---

### 4. Compare/Contrast Cases
**Purpose:** Find and compare precedents on specific legal propositions.

**Agent:** `research-agent` → `SimilarCasesService`

**Input signals:** Proposition or case citation, jurisdiction, practice area

**Output:** Ranked similar cases with binding weight, relevance summary, divergence analysis.

**UI entry points:**
- Research page → Similar Cases panel
- Matter similar-cases tab
- Copilot: "Compare this case to similar precedents"

---

### 5. Synthesis to Facts
**Purpose:** Extract structured facts, issues, and timeline from matter documents and notes.

**Agent:** `matter-analyst` → MI pipeline

**Input signals:** Matter ID, documents, meeting transcripts, intake answers

**Output:** Structured `MatterFact[]`, `MatterIssue[]`, auto-populated matter profile.

**UI entry points:**
- Matter Intelligence (Facts, Issues tabs)
- Matter open → auto-triggered if practice area is set
- Copilot: "Summarise this matter"

---

### 6. Playbook Compare
**Purpose:** Assess a draft document against firm standard positions (playbook).

**Agent:** `diligence-agent` + `FirmMemoryService.compareClause()`

**Input signals:** Document text or clause, clause kind, firm memory search

**Output:** Firm precedent hits, market position summary, red flags, deviation from standard.

**UI entry points:**
- Clause Compare panel (in editor toolbar)
- Workflow sheet: "Compare to firm playbook"
- Vault: firm memory search → compare

**Status:** Partial — backend complete, editor integration in `ClauseComparePanel`.

---

### 7. Diligence Bulk
**Purpose:** Run parallel clause review across many documents for M&A or financing transactions.

**Agent:** `diligence-agent` → `BulkDiligenceJobService`

**Input signals:** Array of document IDs, matter ID, review template

**Output:** Per-document risk matrix, aggregate red flags, deal timeline risk score.

**UI entry points:**
- Vault page → Bulk diligence review
- Matter Diligence tab
- Workflow sheet: "Diligence red flags"

---

### 8. Citation Audit
**Purpose:** Verify every case citation for good law status, binding weight, and section accuracy.

**Agent:** `research-agent` → `CitationVerificationService`, `LegalCitationVerifierService`

**Input signals:** Research output markdown, citation list, jurisdiction

**Output:** Per-citation audit: treatment status (good law / questioned / overruled), section checks, confidence.

**UI entry points:**
- Research page: auto-runs in DEEP mode, shown in `ResearchVerificationCard`
- Citation Challenge modal ("Challenge this" button per citation)
- `TableOfAuthoritiesPanel` — treatment badges

---

### 9. Draft Generation
**Purpose:** Generate a legally precise document from matter context and template.

**Agent:** `drafting-agent` → `IndiaDraftingService` / `USDraftingService`

**Input signals:** Document kind, matter facts, template variables, jurisdiction, client details

**Output:** Draft document (markdown / HTML), clause-level annotations, word count.

**UI entry points:**
- India Drafting (`/consumer/india-drafting`, `/app/matters/[id]/draft`)
- Matter Draft workspace
- Workflow sheet: "Draft generation"

---

### 10. Redline / Amend
**Purpose:** AI-proposed edits to specific selected text with accept/reject diff.

**Agent:** Inline AI (`/ai/inline-edit` endpoint via `LlmCompletionService`)

**Input signals:** Selected text, natural-language instruction (or preset)

**Output:** Proposed replacement text with side-by-side diff.

**UI entry points:**
- Rich-text editor: highlight text → `InlineAiBubble` → Accept / Reject
- Word add-in: parity path in `legal_word_addin/`

---

### 11. Outcome Analysis
**Purpose:** Probabilistic outcome prediction from matter facts, issues, arguments, and precedents.

**Agent:** `outcome-analyzer` → `OutcomeAnalyzerService`

**Input signals:** Matter ID, facts, issues, strategy memos, practice area, jurisdiction

**Output:** Win probability, settlement probability, scenario modelling, recommended strategy, key risks.

**UI entry points:**
- Matter Outcome tab (full analysis, lawyer approval gate)
- `MatterOutcomePreview` card (compact, on matter overview)
- `FirmBenchmarksDashboard` (aggregated, portal-safe publish)

---

### 12. Evidence Gap
**Purpose:** Identify missing evidence and generate a prioritised discovery checklist.

**Agent:** `evidence-gap`

**Input signals:** Matter facts, existing evidence items, issue list

**Output:** Evidence gap report, discovery priority list, suggested document requests.

**UI entry points:**
- Matter Evidence tab → "Analyse gaps"
- Vault: matter selected → evidence gap workflow

---

### 13. Deadline / SLA
**Purpose:** Extract, track, and escalate procedural deadlines from court orders and contracts.

**Agent:** `deadline` + `automations` → calendar sync

**Input signals:** Document text (court orders, contracts), matter stage, jurisdiction rules

**Output:** Structured deadlines with dates, escalation triggers, alerts.

**UI entry points:**
- Matter court deadlines tab
- Calendar page
- Dashboard alerts strip
- Automation triggers

---

### 14. Meeting → Facts
**Purpose:** Transcribe meeting recordings and inject extracted facts into the matter timeline.

**Agent:** Meetings module → `matter-analyst` (MI pipeline integration)

**Input signals:** Audio/video recording or transcript, matter ID

**Output:** Meeting summary, extracted facts, timeline events, action items.

**UI entry points:**
- Meetings list → "Import meeting"
- Meeting detail → "Add to matter timeline"
- Global record meeting button

---

### 15. Firm Memory Retrieve
**Purpose:** Semantic retrieval of relevant prior work product, precedents, and firm knowledge for a current query.

**Agent:** `FirmMemoryService.search()` + `EmbeddingService`

**Input signals:** Search query, tenant ID, user role (ethical wall filtering)

**Output:** Ranked memory hits (matter facts, documents, strategy memos, approved redlines) with scores.

**UI entry points:**
- Vault page → "Firm memory search"
- Clause Compare panel (auto-retrieves on compare)
- Copilot context (injected automatically when `firm_vault` source selected)
- Knowledge Source Picker: "Firm vault" source

**Write-path:** `POST /firm-memory/ingest` — call after approving redlines, memos, or strategy notes.

---

## Composition Examples

### M&A Transaction Review
1. Upload NDA / term sheet → **Clause Extraction** (3)
2. → **Playbook Compare** (6) against firm M&A playbook
3. Risky clauses → **Redline** (10)
4. Check cited cases → **Citation Audit** (8)
5. Run **Diligence Bulk** (7) on data room
6. Generate **Outcome Analysis** (11) for risk memo

### Consumer Case Intake
1. Client describes issue → **Synthesis to Facts** (5) from intake form
2. → **Case Law Research** (1) on applicable statutes
3. → **Evidence Gap** (12) checklist
4. Lawyer meeting → **Meeting → Facts** (14) injected to timeline
5. → **Draft Generation** (9) demand letter or filing
6. → **Outcome Preview** (11) for client portal

---

## Router Architecture

The managing-partner intent router (`/ai/copilot`) classifies user intent and dispatches to one or more patterns:

```
User message
  → LegalResearchClassifierService (practice area, intent type)
  → PatternRouter (selects 1–3 patterns)
  → Each pattern runs via its agent/service
  → Results merged and returned as copilot response
```

This is the "factory line" — horizontal patterns chained by intent, not hardcoded workflows.

---

*Last updated: 2026-07-01*
