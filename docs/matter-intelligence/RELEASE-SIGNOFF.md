# Matter Intelligence Platform v2 — Release Sign-off

**Status:** Moat sprints 0–5 complete (P13 evidence, P15 admin, P17 research MI, P20 templates, P19/P21 quality)

## Moat delivery (2026-06-24)
- [x] Sprint 0 — clarifying-question gate + employment fixture tests; run `npm run legal-forms:embed` after enrich
- [x] Sprint 1 — EvidenceExtractor + OCR merge + Evidence workspace UI
- [x] Sprint 2 — MI metadata admin + audit log + review queue
- [x] Sprint 3 — enriched research query + OpenSearch/vector MI filters + authority ranker + section-finder MI context
- [x] Sprint 4 — `templates:embed` + playbook registry task execution + graph update on generate
- [x] Sprint 5 — Flutter MI panel + consumer next-step CTAs + Semantics on MI widgets

## Critical path verified
- [x] P0 module scaffold + types + domain signals + deprecation map
- [x] P1 taxonomy registry + routing + `resolveMatterDocumentKind`
- [x] P2 classifier (heuristic + LLM + confidence gate)
- [x] P3 MatterGraph extraction + Prisma fields
- [x] P4 TaskGraph + document dependency pre-draft gate
- [x] P5 legal-asset-metadata + enrich script + PRACTICE_SYNONYMS
- [x] P6 filtered retrieval + hybrid ranking + cross-practice suppression
- [x] P7 action recommendation + matter memory + selection tracking
- [x] P8 consumers (draft-intent, analyze, intake, india-draft, copilot, research, marketplace)
- [x] P9 web UI (MatterIntelligencePanel, DraftIntentPanel, types, i18n)
- [x] P10 tests (golden fixtures, unit, contract, E2E stub, Flutter widget stub)
- [x] P21 CI gate + QA matrix + phase checklist

## Arjun Patel fix
Wrongful termination facts now route to `employment_labour` / `wrongful_termination` with `india_wrongful_termination` injected at 0.96; arbitration and employment contract matches suppressed.

## Post-launch (P11–P20)
Scaffold services in place; full outcome/evidence/workflow/admin features are incremental.

Signed off: automated test gate green (`matter-intelligence|mi-intake|contract/matter`).
