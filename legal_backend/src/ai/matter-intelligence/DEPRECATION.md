# Matter Intelligence Platform v2 — Deprecation Map

Legacy classification paths are superseded by `ai/matter-intelligence/`. Do not add new logic to deprecated paths.

| Legacy path | Replacement | Notes |
|-------------|-------------|-------|
| `resolveDocumentKind()` in `document-kinds.ts` | `resolveMatterDocumentKind(profile, query)` | Profile-first; legacy fn delegates to MI when profile provided |
| `getIntakeIntent()` in `issue-checker.constants.ts` | `MatterProfile.nature` + routing rules | Derive intent from `nature` field |
| `DraftIntentService.classifyQuery()` | `MatterIntelligencePipelineService.run()` | MI runs before retrieval |
| `LegalResearchClassifierService` domain detection | `MatterIntelligenceService.classify()` | Share `DOMAIN_SIGNALS` from `domain-signals.ts` |
| Unfiltered `LegalFormsSearchService.searchByIntent()` | `LegalAssetRetrievalService.retrieve()` | Always filter by `practiceArea` + exclude rules |
| `IndiaDraftService` kind from query heuristics | `MatterProfile.documentKind` + `curatedKinds` | Pre-draft gate via `DocumentDependencyService` |

Migration: consumers should call `MatterIntelligencePipelineService` and persist `matterProfile` / `matterGraph` / `matterTaskGraph` on entity create/update.
