# Umbrella Production Candidate — Implementation Ledger

> Generated: 2026-10-18  
> Branch: main  
> Baseline commit recorded before C01–C28 work began

---

## Baseline snapshot (C01)

### Test suite (67-test bundle)

| Suite | Tests | Result |
|---|---|---|
| umbrella-defect-regressions.spec.ts | 5 | ✅ PASS |
| draft-authority-verification.spec.ts | 14 | ✅ PASS |
| legal-research-verification.service.spec.ts | 4 | ✅ PASS |
| saved-research.service.spec.ts | 3 | ✅ PASS |
| matter-research-context.service.spec.ts | 6 | ✅ PASS |
| llm-completion.service.spec.ts | 9 | ✅ PASS |
| llm-fallback.config.spec.ts | 4 | ✅ PASS |
| legal-research-model-router.spec.ts | 8 | ✅ PASS |
| serious-model-lock.spec.ts | 7 | ✅ PASS |
| task-graph-dependency.spec.ts | 7 | ✅ PASS |
| **Total** | **67** | **✅ PASS** |

### TypeScript (backend)

```
tsc -p tsconfig.build.json --noEmit
Exit 0 — no errors
```

### TypeScript (web)

Known failures (to be fixed in C21):

| File | Error | Issue |
|---|---|---|
| lib/format-person-name.test.ts | TS2582 describe/it | Missing @types/jest in web tsconfig |
| lib/geo/dev-geo-mock.test.ts | TS2540 NODE_ENV read-only | process.env type not writable |
| lib/geo/ip-api.test.ts | TS2540 NODE_ENV read-only | process.env type not writable |
| scripts/translate-pending-messages.js | TS6307 not listed | shared/i18n not in web tsconfig include |

### B01–B05 repro tests

File: `src/remediation/umbrella-production-b01-b05.repro.spec.ts`  
Tests: 10 — all passing (defect-documenting assertions confirmed)

---

## Gap inventory

| Gap | Title | Current behavior | Fix ticket |
|---|---|---|---|
| B01 | Early cache key collides on document count | `selectedDocumentIds?.length` used, IDs ignored | C02 |
| B02 | Gate calls sync evaluate(), skips BareAct | `UniversalReleaseGate.evaluate()` never calls `evaluateAsync()` | C03 |
| B03 | Client/Matter created outside tx | `clients.create()` / `matters.create()` use global Prisma, not `tx` handle | C04 |
| B04 | matterId sourced from URL not work-context | `useSearchParams()` in ResearchPanel overrides context store | C05 |
| B05 | Start dialog hard-codes IN, no retry key | `countryCode="IN"` hard-coded; no `operationRequestKey` | C05 |
| B06 | Gemini adapter: basic text only, fake stream | `stream()` wraps complete() with single yield; no tool/vision/function | C08 |
| B07 | Recommendations: keyword rules, India-only | No LLM, no persistence, Kenya/KE catalog not validated | C10 |
| B08 | Reconciler loses semantic input | `executionPlanJson` missing complete request snapshot | C06 |
| B09 | Progress bypass log/dedup, replay process-local | In-memory `replayLog`, no durable sequence | C14 |
| B10 | Claim cache not wired | `LegalResearchClaimCacheService` exists but verifier ignores it | C19 |
| B11 | Approval snapshot race unproven | Approval binds job/audit; concurrent dependency change unhandled | C07 |
| B12 | Kenya benchmark statuses PENDING | Advocate-reviewed expected results missing | C25 |

---

## Ticket status

| Ticket | Title | Status |
|---|---|---|
| C01 | Baseline + repro tests + ledger | ✅ complete |
| C02 | Canonical cache envelope | pending |
| C03 | Async release gate + BareAct | pending |
| C04 | Transactional StartWork + operationRequestKey | pending |
| C05 | ResolvedWorkContext store + pickers | pending |
| C06 | requestSnapshotJson + reconciler | pending |
| C07 | Approval snapshot concurrency | pending |
| C08 | Gemini full capabilities | pending |
| C09 | Gateway migration | pending |
| C10 | LLM recommendations + persistence | pending |
| C11 | IN/KE recommendation validation | pending |
| C12 | Application service ownership | pending |
| C13 | Web journeys | pending |
| C14 | Durable progress replay | pending |
| C15 | Ingestion anchors | pending |
| C16 | Export artifacts | pending |
| C17 | Flutter work context | pending |
| C18 | Word/Outlook authorized context | pending |
| C19 | Claim cache wiring | pending |
| C20 | Deadlines + quality gates | pending |
| C21 | Web tsconfig/test globals | pending |
| C22 | Forward migrations | pending |
| C23 | Security matrix tests | pending |
| C24 | Tracing + observability | pending |
| C25 | Advocate eval fixtures | pending |
| C26 | Staging report | pending |
| C27 | Runbooks | pending |
| C28 | Production-candidate.md + pilot decision | pending |

---

## Non-negotiable invariants (reference)

1. Tenant/actor derived from authentication — every operation authorized through current policy.
2. Matter is the client file — no parallel "file" model duplicating Matter.
3. Facts, allegations, disputed statements, generated inferences, and unknowns stay distinct.
4. Private evidence ≠ legal authority. Evidence states: uploaded/mentioned/extracted/reviewed.
5. A citable legal claim requires admitted source/passage + applicable version/context.
6. UNKNOWN/NOT_RUN/missing capability/stale evidence never become PASS by default.
7. All runs record case-law search coverage including contrary authority. No invented citations.
8. User/caller-supplied verification metadata cannot establish trusted server state.
9. Approval binds exact artifact bytes + current fact/evidence/court/policy versions.
10. Retry/reconnect/re-dispatch preserves immutable input and operation identity.
11. Provider/parse/storage failure cannot look like a successful verified result.
