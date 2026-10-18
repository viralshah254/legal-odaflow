# Umbrella Platform — Feature Inventory

**Version:** 1.0.0
**Date:** 2026-06-26
**Owner:** Engineering

This document is the authoritative inventory of every AI and product feature currently implemented in the Umbrella Legal Operating System. For each feature it records the entry point (controller + route), the key services, the async workers, and the current production status.

Use this document when:
- Planning which features need handbook alignment work.
- Onboarding a new engineer to understand what is already built.
- Identifying dependencies before changing a shared service.

---

## 1. AI Research

**Handbook chapter:** Ch. 06 — Research Engine v3

| Attribute | Value |
|-----------|-------|
| Primary route | `POST /ai/research` |
| Controller | `legal_backend/src/ai/ai.controller.ts` |
| Primary service | `legal_backend/src/ai/legal-research/` |
| Queue worker | Async research worker on `ai.high_priority` queue |
| Status | 🟡 Partial — pipeline runs; citation confidence graph and multi-source deduplication not complete |
| Feature flag | None (on by default) |
| Model tier | Configurable via model router; defaults to GPT-4o |
| Cost tracking | Per-inference via `ai-usage-recorder.service.ts` |
| Verification | Citation verifier wired; confidence threshold not enforced |

**Description:**
The research engine accepts a legal query, jurisdiction, and optional matter context. It fans out to multiple legal sources, retrieves relevant excerpts, generates a structured research memo, and returns citations with source metadata. The async worker handles long-running research requests and delivers results via the notifications system.

**Known gaps:**
- Citation graph (tracking which citations support which conclusions) not implemented.
- Cross-source contradiction detection not wired.
- Source freshness is not checked before retrieval.

---

## 2. Document Drafting

**Handbook chapter:** Ch. 07 — Document Drafting v3

### 2a. India Drafting v1 (Production)

| Attribute | Value |
|-----------|-------|
| Primary routes | `POST /ai/india-draft/*`, `POST /india-drafting/*` |
| Controller | `legal_backend/src/ai/india-draft/india-draft.controller.ts` |
| Primary service | `legal_backend/src/ai/india-draft/india-draft.service.ts` |
| DTO | `legal_backend/src/ai/india-draft/india-draft.dto.ts` |
| Queue worker | Async section generation on `ai.high_priority` |
| Status | ✅ Production — full section generation + verification loop |
| Feature flag | None (default engine for India jurisdiction) |
| Web UI | `legal_web/app/app/india-drafting/draft/page.tsx` |
| Web component | `legal_web/components/legal-forms/draft-intent-panel.tsx` |

**Description:**
The India v1 drafting engine takes a `DraftIntent` (describing the desired document, parties, jurisdiction, and key terms) and generates a multi-section legal document. Each section is generated independently and then verified for accuracy and consistency. The UI displays generation progress via `DraftGenerationProgress`.

---

### 2b. India Drafting v2 (Feature-Flagged)

| Attribute | Value |
|-----------|-------|
| Section generator | `legal_backend/src/ai/drafting-v2/section-generator.service.ts` |
| Section verifier | `legal_backend/src/ai/drafting-v2/section-verifier.service.ts` |
| Status | 🟡 Partial — core pipeline implemented; `DraftWorkspace` canonical model not yet adopted |
| Feature flag | `DRAFT_ENGINE_V2=true` |

**Description:**
V2 introduces a more modular section generation pipeline with improved verification and the groundwork for a canonical `DraftWorkspace` output model. Currently gated behind `DRAFT_ENGINE_V2=true` and not yet in production.

**Known gaps:**
- Does not yet write to the canonical `DraftWorkspace` entity (Gap-003 in `docs/gap-matrix.md`).
- Section-level rollback not implemented.
- Cross-section consistency check not implemented.

---

### 2c. US Drafting

| Attribute | Value |
|-----------|-------|
| Primary route | `POST /ai/us-draft/*` |
| Service directory | `legal_backend/src/ai/us-draft/` |
| Web UI | `legal_web/app/app/us-drafting/` |
| Status | 🟡 Partial — simpler pipeline; no section-level verification loop |
| Feature flag | None |

**Description:**
The US drafting pipeline follows a simpler single-pass generation approach compared to the India engine. Suitable for standard form documents where per-section verification is less critical.

---

### 2d. Legal Forms Catalog

| Attribute | Value |
|-----------|-------|
| Backend module | `legal_backend/src/legal-forms/` |
| Web UI | `legal_web/app/app/legal-forms/` |
| Status | ✅ Production |

**Description:**
A catalog of pre-defined legal form templates. Users select a form, answer intake questions, and the form is auto-populated. Distinct from AI drafting in that forms follow fixed templates rather than LLM generation.

---

### 2e. DraftingSession Templates

| Attribute | Value |
|-----------|-------|
| Backend module | `legal_backend/src/drafting-session/` |
| Status | 🟡 Partial — session management works; not connected to canonical `DraftWorkspace` |

**Description:**
Manages multi-turn drafting sessions where a user iteratively refines a document. Session templates provide starting-point structures for common document types.

---

## 3. Issue Checker

**Handbook chapter:** Ch. 08 — Issue Checker

| Attribute | Value |
|-----------|-------|
| Primary route | `POST /consumers/classify` |
| Controller | `legal_backend/src/consumers/consumers.controller.ts` |
| Status | ✅ Production |
| Queue worker | Classification job on `ai.high_priority` |
| Output model | `ConsumerReport` |

**Description:**
The issue checker accepts a consumer's description of their legal situation and classifies it into one or more legal issue categories with severity grades. It powers the consumer intake flow and determines which product features (drafting, research, lawyer referral) are surfaced to the user.

**Known gaps:**
- Issue severity calibration has not been validated against real-world legal outcomes.
- Multi-issue deduplication logic is basic.

---

## 4. Document Review

**Handbook chapter:** Ch. 09 — Document Review

| Attribute | Value |
|-----------|-------|
| Primary route | `POST /ai/document-review` |
| Controller | `legal_backend/src/ai/ai.controller.ts` |
| Output model | `SavedDocumentReview` (Prisma) |
| Web UI | `legal_web/app/app/document-review/` |
| Status | 🟡 Partial — clause tagging and risk scoring work; redline generation incomplete |
| Feature flag | None |

**Description:**
Takes a document (PDF or DOCX) and returns a structured review with tagged clauses, risk scores per clause type, and summary issues. Results are persisted as `SavedDocumentReview` records for later retrieval. The web UI renders the review alongside the original document.

**Known gaps:**
- Redline / tracked-changes export not implemented.
- Custom clause playbooks (firm-specific risk preferences) not wired.
- No comparison between multiple versions of the same document.

---

## 5. Contract Intelligence

**Handbook chapter:** Ch. 10 — Contract Intelligence

| Attribute | Value |
|-----------|-------|
| Current implementation | Via templates + `document-automation` module |
| Dedicated module | ⬜ None — no `contracts/` module exists |
| Status | 🔴 No dedicated module — contract features are spread across document review and document automation |

**Description:**
Contract-specific features (obligation extraction, deviation detection, contract lifecycle management) are not yet consolidated into a dedicated module. Contract review is handled by the document review pipeline, and contract generation by the document automation templates.

**Required:** Create a `contracts/` module per handbook Ch. 10.

---

## 6. Matter Management

**Handbook chapter:** Ch. 04 — Matter Intelligence

| Attribute | Value |
|-----------|-------|
| Primary routes | `/matters/*` |
| Controller | `legal_backend/src/matters/matters.controller.ts` |
| Background jobs | `matter-autonomy/` module |
| Web UI | `legal_web/app/app/matters/` |
| Status | ✅ Production CRUD — full matter lifecycle; AI intelligence layer partial |

**Description:**
Full matter CRUD with parties, notes, timeline, budget tracking, and document association. The `matter-autonomy` module runs background AI jobs to analyse matter progress and surface insights. The `matter-brain` module generates AI-powered matter summaries.

**Known gaps:**
- Fact lifecycle model not implemented (Gap-004 in gap matrix).
- `WorkflowRun` not durable — agentic matter jobs cannot be resumed (Gap-002).
- Issue graph not grounded in verified facts.

---

## 7. Client Portal

**Handbook chapter:** Ch. 30 — Client Portal

| Attribute | Value |
|-----------|-------|
| Primary routes | `/portal/*` |
| Controller | `legal_backend/src/portal/portal.controller.ts` |
| Web UI | `legal_web/app/app/portal/` |
| Status | ✅ Production |

**Description:**
Provides clients with a self-service portal to view their matters, access shared documents, communicate with their lawyer, and track progress. Supports document upload and eSign initiation.

---

## 8. Billing, Credits and Usage

**Handbook chapter:** Ch. 31 — Billing, Credits and Usage

| Attribute | Value |
|-----------|-------|
| Modules | `billing/`, `ai-credits/`, `subscriptions/`, `payments/` |
| Web UI | `legal_web/app/app/billing/` |
| External integration | Stripe (webhooks + subscriptions) |
| Cost ledger | `AICreditLedger` Prisma model |
| Status | ✅ Production |

**Description:**
Full billing stack: subscription plans, per-use AI credit consumption, Stripe payment processing, invoice generation, and a credit ledger that tracks every AI inference call against a tenant's credit balance. The `ai-usage-recorder.service.ts` writes to the credit ledger on every AI call.

---

## 9. Copilot / AI Command Center

**Handbook chapter:** Ch. 03 — AI Agent Framework

| Attribute | Value |
|-----------|-------|
| Routes | `/copilot/*` |
| Controllers | `copilot.controller.ts`, `copilot-plan.controller.ts`, `ai-command-center.service.ts` |
| Tool registry | `copilot-tools.registry.ts` |
| Web UI | `legal_web/app/app/copilot/`, `legal_web/app/app/ai-command-center/` |
| Status | 🟡 Partial — conversation loop works; tool execution UI incomplete; ReAct agent stub |

**Description:**
An AI copilot that can answer legal questions, execute tools (draft, research, review), and maintain conversation context. The tool registry defines available tools as typed function signatures. The plan controller handles multi-step task decomposition.

---

## 10. Administration

**Handbook chapter:** Ch. 32 — Administration and Governance

| Attribute | Value |
|-----------|-------|
| Module | `admin/` |
| Status | 🟡 Partial |

**Description:**
Admin console for platform operators. Includes tenant management, user impersonation, feature flag management, and compliance reporting.

---

## 11. Queues Summary

| Queue Name | Producer | Consumer | Purpose |
|------------|----------|----------|---------|
| `ocr-processing` | `documents` module | OCR worker | PDF/image text extraction |
| `ai.high_priority` | All AI features | AI worker | Time-sensitive AI inference jobs |
| `ai.low_priority` | Background analysis | AI worker | Non-time-sensitive AI jobs |
| `notifications.dispatch` | All modules | Notification worker | Email, push, in-app delivery |
| `automations.execute` | Automation trigger engine | Automation worker | Rule-based workflow execution |
| `legal.ingest` | `legal-sources` module | Ingest worker | Legal source crawl and index |
| `migration.import` | `migration` module | Migration worker | Enterprise data import |
| `search.index` | All content-producing modules | Search worker | OpenSearch delta indexing |

---

## 12. Key Services Reference

| Service | File | Purpose |
|---------|------|---------|
| `AIGatewayService` | `ai/ai-gateway.service.ts` | Single entry point for all AI inference calls |
| `ModelRouterService` | `ai/model-router/` | Dynamic model selection based on policy |
| `AIPolicyService` | `ai/ai-policy.service.ts` | Feature-level model policy enforcement |
| `AIUsageRecorderService` | `ai/ai-usage-recorder.service.ts` | Cost and token tracking per inference call |
| `LlmCompletionService` | `ai/llm-completion.service.ts` | Low-level LLM call wrapper |
| `AIComplianceGuardService` | `ai/ai-compliance-guard.service.ts` | Pre/post-call compliance checks |
| `CopilotToolsRegistry` | `ai/copilot-tools.registry.ts` | Typed tool definitions for the copilot agent |

---

*Update this document whenever a new feature is added, a route changes, or a feature reaches a new maturity level.*
