# Umbrella route and flag baseline (U01)

Generated for remediation U01–U34. Preserves dirty-tree state; no secrets recorded.

## Feature flags (env)

| Flag | Effect |
|------|--------|
| `UNIFIED_DRAFT_ENGINE_ENABLED=true` | Enables unified draft worker and India/Workspace adapters |
| `UNIFIED_DRAFT_ENGINE_PERCENT` (0–100) | Hash-based rollout on **IndiaDraftAdapter only**; `WorkspaceV3Adapter.isEnabled()` ignores percent |
| Percent `0` | India adapter off; workspace adapter still on if master flag true |

## Research entry points

| Route | Service |
|-------|---------|
| `POST ai/research` | `AiGatewayService.runLawyerLegalResearch` |
| `POST ai/research/async` | Agents job → same gateway |
| `POST research/workflows` | `ResearchWorkflowService` (weaker path) |
| `research/workspaces` | `ResearchWorkspaceService` |
| `POST ai/research/saved` | `SavedResearchService` |

## Drafting entry points

| Route | Service |
|-------|---------|
| `POST ai/india-draft/generate` | `IndiaDraftService` or `IndiaDraftAdapter` → `DraftJobService` |
| `POST draft-jobs` | `DraftJobService` → BullMQ worker |
| `drafting/workspaces` | `DraftOrchestrationService` (V3) |
| `drafting-sessions` | `DraftingSessionService` |
| `document-automation` export | `DocumentDraftService` |

## Release / export

| Route | Gate |
|-------|------|
| `POST ai/india-draft/export` (`exportMode: filing`) | Draft history + human review + readiness audit |
| V3 workspace export | Status `ready` only; markdown bytes as PDF/DOCX (defect F17) |
| Platform filing readiness | `VerificationService.calculateFilingReadiness` (empty findings → score 100) |

## Direct defect reproductions (see `umbrella-defect-regressions.spec.ts`)

1. Registry promotes `partially_verified` → `verified` on field presence (F01)
2. Citation binding: two names → `verified` (F15)
3. Empty findings → `readyForFiling: true` (F16)
4. `FAKEACT` passes statute lexical check (F09)
5. Prompt adapter `verified: true` for all sources (F01)

## Test triage (audit §4)

| Failure | Treatment |
|---------|-----------|
| 4× `draft-authority-verification.spec.ts` | Fix corpus/identity path + passage fixtures (U32/U14) |
| Research paraphrase SUPPORTED | Diagnose without lowering false-positive defenses |
| Mobile `/pricing/plans` string | Behavior contract via PricingApi (U32) |
| SavedResearchPanel named export | Vitest/tsx harness (U32) |

## Repro commands

```bash
cd legal_backend && node node_modules/jest/bin/jest.js --runInBand --no-coverage \
  src/remediation/umbrella-defect-regressions.spec.ts
```
