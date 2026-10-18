# Umbrella: full workflow review and Cursor implementation plan

**Repository:** `/Users/v/Desktop/Legal/legal-by-odaflow`  
**Reviewed:** 18 October 2026  
**Status:** expanded source review, targeted automated tests and direct defect reproductions completed. Application code has not been changed.  
**Audience:** product owner, UI/UX engineer, Next.js/Flutter developers, senior AI/backend engineer and QA.

## Read this first

Umbrella does not lack features. Its main problem is that similar legal tasks can take different execution paths, with materially different definitions of “verified,” different matter-access checks and different finalization/export behavior. Some routes contain strong source and fact checks; others use placeholders, lexical checks, counts and optimistic readiness scores. That is a structural cause of inconsistency.

**Recommended product:** one matter-centered legal workspace with Research, Review and Draft as connected work modes, backed by one evidence service and one release policy. Keep useful domain modules, source connectors and deterministic validators. Replace competing orchestration paths behind compatibility adapters, rather than performing a blanket rewrite.

**Recommended first engineering milestone:** close false-verification, access and export defects before redesigning the main screen. A polished UI must expose honest evidence states; it must not make unreliable output look more credible.

This document includes the expanded workflow review and implementation specification, followed by the detailed initial defect register. The requirements in this expanded section refine the initial plan where further tracing found a route inactive or a weaker parallel implementation.

### Review coverage and evidence levels

- **Source-confirmed:** behavior visible in inspected implementations; deployed usage is not assumed.
- **Directly reproduced:** isolated invocation of existing code with local fixture objects; no live databases or provider calls.
- **Tested:** existing automated tests executed with outcomes below.
- **Design requirement:** proposed target behavior, not a claim that the feature is wholly absent.
- **Needs runtime validation:** deployed flags, live connectors, UI rendering, real Office/Flutter behavior and end-to-end production paths.

The review inventories the repository and examines the legal-work workflows end to end at their code boundaries. It does not certify every line in finance, marketplace, payments, HR/operations or every deployment configuration. The workflow matrix explicitly distinguishes deeply traced legal workflows from adjacent modules surveyed for integration. No screenshot-based UI evaluation, full build, production data access or live legal-model benchmark was performed.

## 1. What Harvey and Legora imply for Umbrella

Official material checked on 18 October 2026:

| Reference | Documented pattern | Umbrella design implication |
|---|---|---|
| Harvey getting started — https://help.harvey.ai/articles/getting-started-with-harvey | Assistant, Vault, workflows, history/library and grounded use of supplied documents or knowledge sources | Make context and saved work reusable across tasks |
| Harvey Vault — https://www.harvey.ai/platform/vault | Document organization/review with use across platform surfaces | Make document sets and their access policy shared infrastructure |
| Legora Editor — https://legora.com/product/editor | Research/review-informed drafting, underlying citations, collaborative refinement, Word export | Preserve evidence and context into editable deliverables |
| Legora Workflows — https://legora.com/product/workflows | Composition of native research, review, drafting and search tools | Compose a few reliable capabilities behind one workflow contract |

These are product-pattern benchmarks from official public descriptions, not independent accuracy measurements, an inspection of their source code, or evidence that either product has complete Kenya/India coverage. Do not infer their model stack or copy their branding. Umbrella should compete on a coherent lawyer experience and demonstrable local-law reliability.

### Product decisions

1. The durable unit of work is a **matter file**, not a chat, an AI agent or a country-specific drafting engine.
2. The user chooses the task; the system selects an approved execution policy and asks only material missing questions.
3. Document evidence and legal authorities are different source classes, visibly distinguished.
4. A research result can become a draft without copying a summary and losing source provenance.
5. Review means suggested changes with anchors, rationale and human control, not silent rewriting.
6. “Approved for filing export” describes a reviewed version under a supported court profile; it is not a model’s self-assessment.
7. Keep consumer services separate from professional approval privileges, while supporting explicit handoff into a matter file.
8. Defer open-ended agent building until the core workflows pass evidence, access and release tests.

## 2. Current workflow map

API paths below omit the common deployment/API prefix. The source route exists; that does not prove it is used by a deployed client.

| Workflow | Existing entry / implementation | Review finding | Required destination |
|---|---|---|---|
| Professional research, synchronous | `POST ai/research` → `AiGatewayService.runLawyerLegalResearch` | Main web/mobile network route; rich checks but a very large gateway | Canonical research job/service, synchronous facade only for short tasks |
| Professional research, asynchronous | `POST ai/research/async` → AgentsService job → same gateway | Shared research engine, separate orchestration/job identity | Same operation/result contract, durable resume and idempotency |
| Platform research workflow | `POST research/workflows` → ResearchWorkflowService | Separate weaker retrieval, citation-count support, placeholder fallback | Retire its synthesis/verification; adapter to canonical research |
| Research workspace persistence | `research/workspaces` → ResearchWorkspaceService | Better ownership/revision/matter checks, distinct from workflow service | Reuse persistence concepts; do not retain competing trust models |
| Saved/approved research | `ai/research/saved`, SavedResearchService, manual-citation review | Useful filing/timeline/context features; save-without-matter and provenance issues | File canonical run versions; user edits are separate annotated versions |
| Section lookup | `legal-search/*section-finder*`, BareActLookup and registry/connectors | Useful domain infrastructure; existence checks differ by caller | Shared statutory evidence service, version/date aware |
| Country drafting | `ai/india-draft/generate` → IndiaDraftService or IndiaDraftAdapter | Flag-dependent legacy/unified routing | Country shortcut to common Draft operation |
| Unified draft jobs | `draft-jobs` → DraftJobService → worker | False source promotion, globally keyed retries, local-memory progress | Harden/reuse job infrastructure, common verified evidence |
| V2 drafting | `ai/drafting-v2/` and India service routing | Another generation/verification branch | Keep only until parity or retire behind compatibility mapping |
| V3 workspace drafting | `drafting/workspaces` → DraftOrchestrationService | Separate active controller/service; weak finalize and invalid format export | Remove independent release/generation ownership |
| Universal accuracy platform | `ai/drafting/platform/draft-pipeline.service.ts` | Useful case record/release layer; not all routes consume it | Common validators and release service after contract correction |
| Drafting sessions | `drafting-sessions` → DraftingSessionService | Editable session/export path separate from court draft | Session UI over canonical artifact revisions |
| Template automation | `document-automation` → DocumentDraftService + AiGatewayService | Generates and renders independently; bad DOCX fallback | Canonical draft/evidence plus real renderers and release policy |
| Assistant/copilot | `assistant-workspace.tsx`, copilot sessions/deliverables | Another user entry; file.text() used for attachments | Task launcher/assistant over shared document ingestion and operations |
| Matter work/workbench/workspace | several `/app/matters/[matterId]/*` routes | Multiple task/canvas surfaces | One default matter workspace, specialist tabs/actions |
| Single document review | AiGateway review plus platform review orchestration | Parallel analysis and parsing paths | Canonical document revision, review findings and citations |
| Comparison/tabular review | `ai/tabular-review.service.ts` | Two-document clause comparison, truncated input, no source coordinates | Keep comparison tool; add proper evidence-addressed batch review |
| Contracts/playbooks/redlines | platform document-review services | Good components, fragile text anchors | Stable clause/source anchors and version-aware change proposals |
| Word add-in | `legal_word_addin/src/` | Matter selector exists, but research API omits matter context; first-match edit behavior | Same context/operation/review contract inside Word |
| Outlook add-in | `legal_outlook_addin/src/` | Email-to-matter and assistant surfaces inventoried | Authorized source ingestion, selected thread/attachments and explicit actions |
| Strategy/hearing/filing/deadlines | `platform/strategy`, `platform/deadlines` | Filing state is not a court receipt; deadline/calendar limitations | Evidence-backed suggestions, reviewed deadlines and honest submission states |
| Monitoring/re-verification | `platform/continuous`, monitors | Weak finding diff and error handling; source changes need dependencies | Evidence-driven re-verification and stable finding IDs |
| Handoff/client collaboration | platform handoff/audience/portal | Actor/recipient/expiry enforcement needs strengthening | Explicit scoped assignments and separate client/internal views |
| Firm knowledge/vault/search | documents, firm-memory, platform vault, legal search | Several stores and access boundaries | One source catalog with explicit public/private use rights |
| Workflow automation | agents, workflows, automations, platform agentic | Multiple orchestration concepts | One approved step DSL over canonical tools, bounded budgets |
| Admin, usage, credits, billing | superadmin, cost, credits, accounting modules | Adjacent modules surveyed; not full financial audit | Capability/source/quality dashboard, auditable overrides and outcome-based charging |
| Consumer intake and lawyer handoff | consumer preview/report routes and audience handoff | Different audience and permissions | Preserve distinction, explicit consent/access when promoting to firm work |

### Confirmed call-path clarification

`WorkspaceV3Adapter` is registered in UnifiedDraftingModule, but the scanned source contains no invocation of it from the V3 orchestrator. Its fact truncation and rollout mismatch are latent adapter defects, not proof that all current V3 drafting takes that path. The actual V3 orchestrator independently reads only 20 facts/10 issues and has a more serious unscoped matter-fact query described below.

`PlatformModule` is imported by AppModule; its research/drafting controllers are not merely unregistered reference code. Deployment traffic and client routing still need measurement before removal. Registration of a guard/service is not evidence that controllers or application services enforce it.

## 3. Expanded defect register

F01–F14 in the detailed audit remain relevant, with the adapter clarification above. New findings follow.

### F15 — P0: platform research calls citation co-occurrence verification

**Source:** `legal_backend/src/platform/research/citation-binding.service.ts`, `determineSupportStatus`; `research-workflow.service.ts`.

Two matched authority names/citations cause `supportStatus: verified`, with confidence 0.9, without inspecting whether either passage entails the proposition. One match becomes partially supported. This is not semantic or legal verification. Direct fixture reproduction marked “Authority Alpha and Authority Beta prove that the moon is made of cheese” verified.

**Fix:** retain citation extraction as extraction only; legal support comes from common admission + passage/proposition checks. Persist exact source spans and unsupported statements. Never derive trust from reference count.

### F16 — P0: missing verification can produce perfect filing readiness

**Source:** `legal_backend/src/platform/verification/verification.service.ts`, `calculateFilingReadiness`; `platform/drafting/draft-orchestration.service.ts`, `getFilingReadiness`, `finalize`.

All component scores start at 100; no findings means no penalties. Direct call with empty findings returns score 100 and readyForFiling=true. `finalize()` checks only whether a required section is in repair_needed state; it does not require completed generation, a current successful verification run or human approval. A newly created/no-section workspace is not rejected by that check.

**Fix:** completion evidence is required for each mandatory check. NOT_RUN/INDETERMINATE cannot mean pass. Release requires a complete section manifest, current verification snapshot and authorized approval. Remove score thresholds as the legal release predicate; scores may summarize completed checks only.

### F17 — P0: V3 exports are not PDF/DOCX files, and storage failure looks successful

**Source:** `platform/drafting/draft-orchestration.service.ts`, `export`, ~634–686.

It serializes Markdown/plain text with Buffer.from, uploads it using a PDF/DOCX content type/extension, and returns an assumed storage URL if upload fails or no gateway exists. It then marks the workspace exported. This is a confirmed implementation defect, not just a proposed export enhancement.

**Fix:** use real shared renderers; validate format signatures/parseability; persist artifact only after successful upload; sign authenticated downloads; return failure/retry when storage fails. Separate export status from draft readiness. Repeated downloads must remain possible without forcing state back to ready.

### F18 — P0: V3 reads matter facts/issues without tenant or matter authorization

**Source:** `platform/drafting/draft-orchestration.service.ts`, `createWorkspace`, ~117–128; DraftController.

Queries filter by supplied matterId only. The service does not establish target matter ownership/access before fetching facts/issues. Controller TenantGuard establishes firm membership, not entitlement to an arbitrary matter UUID. Subsequent workspace access also filters tenant but not matter authorization/user in several methods.

**Fix:** resolve actor + authorized matter before loading facts; include tenant predicates in queries and a consistent matter policy. Enforce ethical walls even for broad tenant roles where policy requires. Audit legacy document automation, reviews and job results for the same intra-tenant matter boundary.

### F19 — P1: platform clarification endpoint discards the answer

**Source:** `platform/research/research.controller.ts`, `addClarification`.

It accepts `{ clarification }` but does not pass/store/use the body; it reruns the same workspace objective. A user can believe an ambiguity was resolved while the run sees none of their answer.

**Fix:** typed clarification command with expected revision, task ID and answer; append context item, update case record and resume an affected step. Reuse ResearchWorkspaceService revision/context capabilities.

### F20 — P1: another research path uses weak retrieval and completed placeholders

**Source:** `platform/research/research-workflow.service.ts`, `runResearch`, `generateLlmSynthesis`, `computeConfidence`.

The query built from objective/subquestions is not used for semantic retrieval: findMany searches only the first few objective words. The fallback to highest-weight authorities happens on query exception, not empty results. All results receive relevanceScore 0.6. Only the first 500 rawText characters are placed in authority snippets. Failed/unavailable synthesis returns a generic placeholder, which is persisted with status completed and computed confidence. Conflicting cases can be paired by selecting the first other apparently good/unknown authority, not proven treatment links.

**Fix:** route to canonical planner/retrieval/verification; a provider failure is an explicit degraded/failed outcome. A conflict requires evidence of the relationship. Remove arbitrary fixed relevance/confidence as legal reliability claims.

### F21 — P1: saving research without a matter conflicts with its optional DTO

**Source:** `ai/legal-research/saved-research.service.ts`, save; `ai/dto/save-research.dto.ts`.

matterId is optional, but `if (matter?.clientId !== dto.clientId)` rejects a client-only save when matter is null. A real clientId is not undefined, so optional-matter operation cannot work as implied. ResearchJson is also caller-supplied and should not become canonical verified content merely by being saved alongside an AI output.

**Fix:** decide supported client-only semantics explicitly: either create/select a matter in the start flow, or permit a clearly unfiled client item with correct conditional validation. Save canonical result by run/version ID; store user edits separately and reverify. Do not equate Save with advocate approval/cache trust.

### F22 — P1: document ingestion has inconsistent binary/URL handling

**Source:** `legal_web/components/assistant/assistant-workspace.tsx`, handleFileUpload; `platform/document-review/document-review-orchestration.service.ts`, downloadText.

Assistant reads attachments through browser file.text() and slices at 100,000 characters. The platform review URL path fetches arbitrary URLs and returns response.text(), without source-level document type parsing, timeout/size guards or URL restrictions in that method. PDFs/DOCX may therefore enter as undecoded binary text. Arbitrary fetching also creates an SSRF surface; network-layer protections were not validated.

**Fix:** shared authenticated upload and ingestion pipeline; PDF/DOCX extraction/OCR, text/plain handling, extraction coverage and content limits. Resolve document IDs through access policy. Harden URL fetching, redirects and resource limits; do not execute source instructions. Show ingestion progress and page coverage before legal analysis.

### F23 — P1: malformed exports can also occur in document automation

**Source:** `document-automation/document-draft.service.ts`, `exportDocx`, ~307–347.

If HTML-to-DOCX conversion throws, the fallback writes a plain UTF-8 error/HTML buffer and persists it with .docx. Other template/session export paths do not visibly enforce the common filing-release contract.

**Fix:** return a structured conversion error, preserve editable content, and retry/render using tested infrastructure. Audit session/template/consumer/add-in export routes for approved labels and working-copy labeling. Do not claim any successful export is a valid Office document without parsing it.

### F24 — P1: “tabular review” is a limited comparison tool

**Source:** `ai/tabular-review.service.ts`.

This is two-document clause comparison with 40,000-character input clipping. Output rows contain short excerpts but not document revision/page/paragraph coordinates. Invalid riskLevel is normalized to NONE. Parse repair can recover a partial JSON response without a completeness contract. This is not yet a dependable many-document review grid.

**Fix:** preserve comparison as a named tool; unknown risk remains UNKNOWN, not no risk. Add schema validation, coverage manifest, source anchors, per-cell evidence and explicit partial/error state. Build many-document extraction over canonical ingestion/jobs only after the evidence boundary is fixed.

### F25 — P1: Word redlines can modify the wrong occurrence

**Source:** `legal_word_addin/src/word/document-ops.ts`, `applyRedlines`; `platform/document-review/redline-export.service.ts`.

Source anchors are abbreviated text; Word chooses results.items[0]. Identical text appearing more than once can receive edits at the wrong location. Proposed paragraphIndex is not used to disambiguate this search in the inspected function.

**Fix:** revision-bound paragraph/content-control/range anchors with exact original text and context hashes. Reject ambiguous/stale matches; preview and allow accept/reject. Track change author and preserve Word formatting/numbering. Test repeated clauses, tables, headers and edits made after generation in real Word.

### F26 — P1: Word research ignores the linked matter

**Source:** `legal_word_addin/src/taskpane/pages/MatterSelector.tsx`, `ResearchPage.tsx`, `api/client.ts`, runResearch ~116.

Matter selection writes Office document settings, but runResearch input/body includes query and country only, not matterId, selected evidence, dates or source policy. A linked document does not automatically ground that research.

**Fix:** shared context resolver and operation API across web/mobile/add-ins. Load current linked-matter settings and authorized server context; show selected scope before a run. Missing/stale permissions require reselection, not a fallback to another matter.

### F27 — P1: ethical-wall infrastructure is not consistently enforced

**Source:** `platform/security/ethical-wall.guard.ts`, `ethical-wall.service.ts`, `access/matter-access.service.ts`; registration/call-site scans.

The platform guard was found registered/exported but no enforcement use was found in the scanned references. It permits requests with missing user/tenant context and treats generic params.id as a matter ID. The inspected service checks protectedMatterIds but not protectedClientIds. MatterAccessService grants broad full-access roles without invoking this platform wall service. Other wall implementations also exist; they must be reconciled, not assumed equivalent.

**Fix:** one central access decision that resolves actual artifact→matter→client, role/grant and deny rules. Explicitly define whether ethical-wall deny overrides partner/admin broad access; audit emergency access separately. Apply before retrieval, previews, job streaming, linking, sharing, exports and cached results.

### F28 — P1: re-verification cannot reliably compare random finding IDs

**Source:** `platform/continuous/re-verification.service.ts`; platform VerificationService produces randomUUID finding IDs.

The diff maps old/new finding IDs, but each verification can generate new random IDs. Stable failure resolution cannot be inferred. A verification exception returns empty changedPropositions/newFailures, indistinguishable from an uneventful successful check.

**Fix:** stable semantic finding keys by policy/check + artifact/section/claim/source identity, with distinct occurrence/run IDs. Persist completed/failed outcome and compare pass/fail/unknown/resolved states. Reverification must inspect changed legal evidence, not only rerun local formatting checks.

### F29 — P1: filing submission status is not actual court submission

**Source:** `platform/strategy/filing.service.ts`, checkReadiness, submitFiling.

Readiness checks only a few metadata conditions. submitFiling merely updates database status/date and does not invoke checkReadiness or a court gateway. This can be a useful manual tracker, but it must not imply electronic filing was performed.

**Fix:** distinguish Prepared, Approved export, Marked submitted by user, Submission sent to supported gateway, Receipt confirmed, Accepted/Rejected. A manual record requires actor/evidence. If an integration exists elsewhere, reconcile its verified receipt with this state model.

### F30 — P1: deadline computation requires jurisdiction/court evidence and calendar freshness

**Source:** `platform/deadlines/deadline-engine.service.ts`.

findRules checks effectiveTo against now but not effectiveFrom against the legally relevant date. Holiday fallback covers selected countries, not KE; the cache is jurisdiction-only and process lifetime. Calculation mixes local Date operations and UTC ISO date strings. The calculation method is sync and only uses already warmed cache. Some notification/calendar callers warm it, but coverage and freshness must be proven for every calculation path.

**Fix:** rule applicability for trigger date and court, effective interval, time zone, excluded days/closures, extension rules and source citations. Cache by court/jurisdiction/year/version with refresh. Missing calendar/rule data produces a review task, not assumed precise filing deadlines. The fallback dates were not independently legally validated here.

### F31 — P1: handoff actor/expiry transitions are weak

**Source:** `platform/handoff/feature-handoff.controller.ts`, createHandoff; `feature-handoff.service.ts`, accept/complete.

Controller accepts dto.fromUserId when provided instead of always deriving actor from authenticated user. Acceptance checks direct recipient and status but not expiresAt in the inspected method; completion lacks the same recipient/state restrictions. Shared document and matter IDs need authorization before handoff.

**Fix:** server-owned sender; verified recipient membership/permissions; transactional allowed transitions and expiry check; explicit access grant to selected artifacts only; audit actions. A handoff record must not itself bypass matter permissions.

### F32 — P2: AI gateway concentrates too many responsibilities

**Source:** `ai/ai-gateway.service.ts`, 10,265 lines; main research execution spans thousands of lines.

It owns routing, retrieval supplementation, synthesis, multiple verification passes, cache, result persistence, billing and several unrelated legal tasks. Refactoring by splitting filenames alone will not remove policy duplication.

**Fix:** extract stable application boundaries and typed results; preserve and characterize existing behavior. Main research already authorizes selected matter context and uses tenant/user-aware cache identity. Retain those protections; do not replace it with the weaker platform research implementation.

## 4. Direct reproductions and expanded test record

Isolated local calls to existing services produced:

```json
{
  "registryPromotedStatus": "verified",
  "partialPromptMarkedVerified": true,
  "unsupportedParagraphStatus": "verified",
  "emptyFindingsFilingReadiness": { "readyForFiling": true, "score": 100 },
  "fakeActFindings": []
}
```

Inputs: a partially verified invented case; an unsupported sentence naming two unknown-treatment authorities; an empty filing finding list; and `FAKEACT` section `99999`. These are direct behavioral reproductions of existing functions, not just speculative static warnings. They do not call or prove an externally exploitable deployed end-to-end route.

### Test totals, without double-counting

| Batch | Suites/files | Tests | Outcome |
|---|---:|---:|---|
| Initial backend accuracy/cache/provider batch | 4 | 15 | 11 pass, 4 fail |
| Expanded backend matter/research/contracts batch | 9 | 59 | 57 pass, 2 fail |
| Web saved-research/context/review API batch | 4 | 11 | 9 pass, 2 fail |
| **Combined executed tests** | **17** | **85** | **77 pass, 8 fail** |

Expanded backend command, run from `legal_backend`:

```bash
node node_modules/jest/bin/jest.js --runInBand --no-coverage --runTestsByPath \
  src/ai/legal-research/matter-research-context.service.spec.ts \
  src/ai/legal-research/saved-research.service.spec.ts \
  src/ai/legal-research/claim-level-verification.service.spec.ts \
  src/legal-search/legal-research-verification.service.spec.ts \
  src/documents/document-client-integrity.spec.ts \
  src/matters/integrity-foundation.spec.ts \
  test/contract/mobile-api-paths.spec.ts \
  test/contract/web-api-paths.spec.ts \
  test/unit/court-draft-history.spec.ts
```

Web command, run from `legal_web`:

```bash
node node_modules/vitest/vitest.mjs run \
  lib/api/saved-research.test.ts \
  lib/api/citation-reviews.test.ts \
  lib/matter-research-context.test.ts \
  lib/saved-research-panel.test.ts
```

Failures need distinct treatment:

- Four initial authority-verification failures: inspect identity, passage/proposition fixtures and current verifier behavior before deciding whether tests or implementation should change.
- Research verification paraphrase test: expected SUPPORTED, got UNSUPPORTED despite mocked semantic pass; preserve false-positive defenses while diagnosing the mismatch.
- Mobile subscriptions contract test: expects `/pricing/plans` literal in subscriptions_api.dart, but code delegates plan lookup to PricingApi. This looks like a brittle test, not evidence that checkout is broken. Replace source-string assertion with behavior/transport contract and confirm actual pricing endpoint.
- Two SavedResearchPanel tests fail in a child Node/tsx named-export import before rendering. Component source has the named export. Diagnose module/test runtime compatibility; do not report these as proven unsafe UI badges.

No full Flutter analysis/test run, Office integration test, full backend/web build, live-provider accuracy benchmark or browser visual review was completed. Those remain explicit release tasks.

## 5. Target product structure and UX specification

### Navigation

Default professional navigation: **Workspace, Matters, Clients, Library, Tasks**. Workspace opens recent work and a single composer with Research, Review and Draft actions. Matter workspace is primary once a file is selected. Firm operations (calendar/time/billing/finance), workflows and settings remain reachable in secondary groups with existing permissions. Do not remove functional accounting modules to simplify the legal-work sidebar.

Country choices, document types and section lookup belong inside work context/task controls, not as rival AI products. Existing links remain redirects or compatibility routes so saved bookmarks do not break.

### Shared start sheet

When launching outside a matter:

1. Task: Research / Review / Draft, with a natural-language objective.
2. “Is this for a client?” Existing client / Add client / Continue without client.
3. Existing client → existing file or New file. Add client → minimum identity fields and duplicate suggestion → New file. No-client work has an explicit Unassigned label and later attachment action.
4. Jurisdiction, relevant state/county/forum and dates; prefill from file, confirm material conflicts.
5. Documents/research/source scope and a concise run plan. Advanced controls are collapsed.

Do not ask these questions repeatedly for each message. The work context is durable; changing it creates a new context version and prompts only when the change is material. Never silently carry another client’s documents into a new run.

### Screen states and interaction detail

- Desktop: restrained shell, persistent matter breadcrumb/context, main answer/editor/review surface, contextual Sources/Questions/Versions side panel. Use existing components and design tokens; avoid a dashboard of dozens of AI feature cards.
- Research: answer or memo, issue coverage, authorities with exact passage and source links, contrary authorities, material questions and date/coverage limits. “Draft from this research” sends run+evidence version IDs.
- Review: document viewer and findings list; each finding has exact range, severity/uncertainty, policy/source, proposed change and accept/reject. Findings should remain stable after harmless viewport changes.
- Draft: structured editor with outline, tracked suggestions, fact/source references and unresolved placeholders/tasks. AI edits are previewed as deltas; user edits are preserved unless specifically selected.
- Sources: source type, jurisdiction, official URL, retrieved/version date, passage and verification dimensions; open full artifact/page. A law firm precedent is not automatically a legal authority.
- Questions: fact confirmation versus legal verification; materiality, affected sections, suggested resolution and source; actions are durable and revision-bound.
- Versions: actor/time, input snapshot, changes, review state and export artifacts. Diff and restore create new revisions instead of erasing history.
- Mobile: context header + Work/Sources/Questions/File views, uploads and reading/review optimized for small screens, same server policy. Persistent job IDs survive navigation and reconnect. A full desktop editor need not be copied pixel for pixel.
- Accessibility: keyboard workflow, focus restoration, readable typography/line lengths, screen-reader labels, textual statuses, no reliance on color alone. Review errors remain visible with recoverable actions.

The next implementation must validate these designs against actual browser/device rendering. Source review supports navigation and state recommendations, not a claim that visual quality was inspected.

## 6. End-to-end workflow acceptance contracts

| Scenario | Required successful path | Failure / incomplete behavior |
|---|---|---|
| New client and file | Start task → minimal client → matter → intake → saved operation | Retrying creates no duplicate; typed input survives error |
| Existing file research | Select authorized context → issue plan → primary law/cases → supported memo | Missing material evidence produces question/partial result |
| General research | Explicit Unassigned work → save run → attach later | Never silently chooses last client/matter |
| Research follow-up | Answer durable task → revise context → rerun affected issues | Old answer/result remains in history; stale approval invalidated |
| Research-to-draft | Select result/version → document type/court profile → outline → draft | Do not reuse stale summaries as verified authority |
| Draft from precedent | Authorized precedent for structure/style + current law evidence | Preserve provenance; never treat precedent facts as client facts |
| Single-document review | Ingest revision → parse/OCR coverage → findings → suggestions | Corrupt/missing pages explicitly block affected analysis |
| Bulk review | Select permitted document set → schema/columns → per-cell jobs/evidence → export table | Failed/partial cells stay distinct from no finding |
| Compare versions | Select revisions → deterministic diff + legal-risk explanation | Unknown risk is not NONE; clipped sections visible |
| Word editing | Resolve matter/revision → suggestions → unique range → tracked accept/reject | Ambiguous/stale anchor rejected without editing |
| Client clarification | Scoped question/package sent only by explicit user action | Internal legal strategy and other files excluded |
| Filing export | Current checks + reviewer capability + exact approved revision → rendered artifact | No successful status/URL if conversion/storage fails |
| Court filing tracking | Approved artifact → manual receipt record or supported gateway → status evidence | Never mark actual submission from a local DB update alone |
| Monitoring | Source/case changes → affected dependency graph → recheck → task | Failed recheck produces failure status, not “no change” |
| Deadline | Confirm event/rule/calendar → reviewed deadline → reminder | Missing rule/calendar remains tentative with explicit review |
| Reopen on another device | Same authorized run/file/version + durable progress | Revoked access ends access; no stale cache disclosure |
| Handoff | Server actor + authorized recipient + selected artifacts → acceptance | Expiry/revocation enforced; no implicit whole-file access |
| Consumer-to-firm | Consent/scope + correct client/matter → authorized professional review | Consumer never receives advocate approval privileges |

Every research/drafting run attempts relevant case-law retrieval and records its coverage. The absence of a suitable verified decision is an explicit gap; never pad a contract or affidavit with irrelevant citations. Place authorities in an associated research packet where the final document’s format does not require them in its body.

## 7. Canonical backend and data model plan

### Choose one execution path

Use the current main research path as a characterized starting point because its selected-matter authorization and richer source checks are already implemented. Extract ResearchApplicationService and its dependencies from the gateway rather than replacing it with the weaker `platform/research` implementation.

For drafting, retain useful async job infrastructure and deterministic accuracy components, but first fix source trust, access and release. Select a canonical generator by fixture/benchmark results; do not declare the newest engine the winner by name. V3 standalone verification/finalization/export must stop being an independent authority on filing readiness.

### Services and ownership

| Boundary | Responsibilities | Must not do |
|---|---|---|
| WorkContext | Client/matter selection, actor/access, jurisdiction/date, context revision | Trust client-supplied tenant/reviewer identity |
| Ingestion | Artifacts, text/OCR/layout, page/range IDs and extraction coverage | Infer legal truth from OCR confidence |
| Evidence | Primary-source retrieval, identity, passages, versions, admissible use, treatment | Promote trust by field completeness |
| Research | Issue plan, authority coverage, supported synthesis and contrary evidence | Rewrite client facts to fit a legal theory |
| Draft | Document plan, section generation, targeted edits/repair, coverage | Certify itself for filing |
| Review | Findings anchored to revisions, suggested changes and dispositions | Apply ambiguous edits silently |
| Release | Current mandatory checks, review authorization and artifact manifest | Accept client audits or obsolete version identities |
| Jobs/events | Durable lifecycle, retries, cancellation, cost settlement and progress | Treat provider/queue/storage failure as completion |

### Reuse existing persistence deliberately

Existing entities include MatterFact and MatterFactV2, MatterIssue and MatterIssueV2, ResearchWorkspace with revisions/context items, SavedResearch, AIOutput, DraftingSession, CourtDraftRecord, DraftWorkspaceV3/sections/versions, DraftJob/sections/stages, WorkflowRun/StageRun, VerificationJobV3 and SmartWorkspace.

Do not add an identical new stack of tables. Establish a source-of-truth map and compatibility IDs:

- Matter is the file; client is its client relationship, not a duplicate folder record.
- One case-record revision references canonical fact/party/issue IDs and provenance; old fact models are mapped/backfilled, not silently discarded.
- One logical work operation has immutable request/context/evidence snapshots. Existing job types can reference it during transition.
- One artifact revision owns content/hash/anchors; existing draft/session/workspace IDs map to it for compatibility.
- Review tasks and approvals reference artifact/context/evidence/policy revisions, not just mutable draft IDs.
- Source artifact and evidence passage identities are stable; retrieval runs, verification attempts and model summaries are separate records.
- Existing Workflows and AgentJobs remain scheduling/execution surfaces while a single operation service owns legal semantics.

### Logical API commands to expose

These are proposed names; map onto existing endpoints during migration:

```text
StartWork(task, clientChoice, matterChoice, context, idempotencyKey)
AppendContext(operationId, expectedRevision, artifacts/facts)
AnswerReviewTask(taskId, expectedRevision, decision, evidence)
RunResearch(operationId, expectedRevision)
CreateDraftFromResearch(researchVersionId, documentProfileId)
ProposeEdit(artifactVersionId, selectionAnchor, instruction)
ApplySuggestion(suggestionId, expectedArtifactVersion)
ApproveArtifact(artifactVersionId, currentSnapshotDigest)
ExportArtifact(artifactVersionId, mode=working|approved, format)
AttachWorkToMatter(operationId, targetMatterId, expectedRevision)
```

Responses include operationId, revision, context summary, lifecycle, result version, coverage/gaps, review tasks and permitted actions. Define OpenAPI schemas and generate/validate TS/Dart/add-in contracts. Backend derives tenant/actor and authorizes all referenced IDs. Display-only fields cannot change canonical verification status.

### Lifecycle and recovery

Use Queued, Running, AwaitingUser, AwaitingReview, Completed, Partial, Failed, Cancelled. Legal readiness is separate: Unchecked, EvidenceIncomplete, NeedsReview, Approved, Stale. Export is a separate artifact outcome. A completed working draft can be unapproved; failed conversion must not change legal readiness.

Persist steps and current sequence. Dispatch through existing outbox/BullMQ infrastructure; retries are tenant/actor/operation scoped with request fingerprint. Progress transport uses Redis/shared events, durable replay and authorized polling. Cancellation is checked before provider calls, persistence, repairs and final commit. A late worker cannot overwrite a newer revision.

### Evidence and privacy

Maintain public legal corpus separately from private evidence. User uploads are private facts unless explicitly established as a legal authority. Source fetches validate redirects and network destinations. Retrieved instructions never override workflow policy. Cache private results by actor/tenant/matter-context revision; revoke access on permission changes. Log technical traces without indiscriminate privileged document content. Knowledge learning is consent/policy-bound; reviewed client work must not leak into other tenants’ prompts.

## 8. Cursor backlog with dependencies and proof of completion

Each ticket is a coherent change; split further if review becomes too large. Tests must reproduce user-visible or trust-boundary behavior, not merely mirror helper code.

| ID | Priority | Work and primary files | Dependencies | Completion evidence |
|---|---|---|---|---|
| U01 | P0 | Capture current route/flag/support map, dirty-tree baseline and characterize tested routes | — | Versioned inventory and reproducible commands; preserve existing edits |
| U02 | P0 | Correct registry/prompt evidence states, remove implicit IN/proposition-as-source | U01 | Partial/fake sources never serialize as verified |
| U03 | P0 | Replace platform CitationBinding support claims with common evidence checks | U02 | Two irrelevant authorities cannot verify a claim |
| U04 | P0 | Protect draft audit/readiness fields; invalidate on content changes | U01 | Forged PATCH audit rejected; old verification becomes stale |
| U05 | P0 | Central access resolver for clients/matters/artifacts; fix V3 fact reads/linking | U01 | Cross-tenant and restricted-matter adversarial tests pass |
| U06 | P0 | Scope idempotency + request fingerprints + concurrency; migrate key constraint | U05 | Cross-tenant same key isolated; concurrent duplicate produces one operation |
| U07 | P0 | Authorize draft SSE/results/enrich/cancel with shared context | U05 | Known foreign UUID cannot stream/read/mutate |
| U08 | P0 | Complete-check release policy; remove no-findings=pass and weak finalize | U02–U05 | Unrun/empty/incomplete checks never yield filing readiness |
| U09 | P0 | Server-owned approval identity, reviewer capability and freshness | U04,U08 | Facts/evidence/profile changes invalidate approval atomically |
| U10 | P0 | Real PDF/DOCX conversion and failure-safe artifact persistence | U08,U09 | Parseable files, no fake success URL/buffer, repeated download works |
| U11 | P1 | Shared binary upload/OCR/parsing + safe URL fetch | U05 | PDF/DOCX/scans correctly parsed with page coverage; unsafe fetch rejected |
| U12 | P1 | Official statute identity/provision/date/version service | U02,U11 | Fake Act/section and wrong-date versions rejected/unknown |
| U13 | P1 | Case discovery/fetch/passages/ratio/contrary-law/treatment evidence | U02,U11 | Exact quotations, supported propositions, current-law uncertainty preserved |
| U14 | P1 | Mandatory case-law coverage and issue sufficiency policy | U12,U13 | Every run logs relevant search; no irrelevant quota-padding |
| U15 | P1 | Extract canonical ResearchApplicationService; adapt platform workflows | U03,U12–U14 | Both entry paths yield equivalent policy/results under same snapshot |
| U16 | P1 | Structured case/fact coverage; remove silent first-N material input loss | U05,U11 | Material late facts/issues included or explicitly unresolved |
| U17 | P1 | Durable review questions and clarification resume | U15,U16 | Answer changes input revision and affected result; no discarded body |
| U18 | P1 | Redis/shared progress, replay, retry/cancel/outbox recovery | U06,U07 | Separate-process multi-subscriber reconnect/retry tests |
| U19 | P1 | Saved research canonical version filing, client-only semantics | U05,U15 | Save supported selections; edits cannot inherit verified status |
| U20 | P1 | Shared StartWork client/file command | U05,U06,U16 | Inline client+matter creation is idempotent and authorized |
| U21 | P1 | Next.js workspace/context/start flow/source/question panels | U17–U20 | Complete new/existing/unassigned client journeys in browser |
| U22 | P1 | Flutter context/start/file/review/jobs parity | U17–U20 | Cross-device resume and save work, not a “use web” dead end |
| U23 | P1 | Canonical Draft application service and route adapters | U08,U12–U18 | Country/session/template/V3 routes share evidence/release semantics |
| U24 | P1 | Versioned editor, fact/source links and targeted edits | U16,U23 | User edits preserved, dependent checks/approvals become stale |
| U25 | P1 | Review anchors, schema/risk unknown states, comparison coverage | U11,U24 | Repeated clauses/partial input cannot silently produce safe/complete result |
| U26 | P1 | Word linked context and unambiguous tracked edit operations | U20,U24,U25 | Real Word tests: duplicate text, tables, revisions and rejection |
| U27 | P1 | Stable re-verification finding identities + failure outcomes | U08,U12,U13 | Unchanged run has no false diff; source change invalidates affected work |
| U28 | P1 | Source-backed deadlines and honest filing tracker states | U08,U12,U16 | Missing calendar tentative; DB status update is not court submission |
| U29 | P1 | Handoff sender/recipient/expiry/access and client-safe package | U05,U20,U24 | Cannot spoof sender, accept expired handoff or expose internal strategy |
| U30 | P2 | Many-document review grid with per-cell evidence/jobs | U11,U18,U25 | Resume failed cells; evidence-backed extraction/export at declared scale |
| U31 | P2 | Approved workflow templates, bounded DSL and human pauses | U15,U17,U23,U30 | Versioned tasks compose same tools without new verification stack |
| U32 | P1 | Repair existing tests/harnesses without weakening legal checks | U01 onward | All specified suites pass with reasons for fixture changes |
| U33 | P1 | Advocate-reviewed IN/KE golden benchmark and output QA | U10,U12–U25 | Report false accepts, abstentions, coverage and reviewer corrections |
| U34 | P1 | Migrations/backfills, support matrix, canary and legacy retirement | All relevant | Reconciled IDs/data, route parity, rollback drill and live monitoring |

### Sequencing

First release U01–U10 plus enough U32 regression coverage to prevent false trust/access/export regressions. In parallel implementation planning can define U11–U20 contracts, but do not connect a redesigned UI to known unsafe release behavior.

Second release: source/case/fact/clarification/job correctness and client-first workflow (U11–U22). Third: consolidated drafting/review/Word/court quality (U23–U29). Fourth: bulk/workflow expansion and measured retirement (U30–U34). These are dependency stages, not a promise of a fixed calendar schedule.

The user has requested a review and plan. Cursor should implement the backlog only when instructed to make code changes; this deliverable itself does not deploy, migrate production data, or send client communications.

## 9. Database migration and rollout details

1. Create a mapping inventory for current artifact/job/workspace IDs. Record ownership, active UI callers, provenance and orphan relationships; report rather than delete ambiguous records.
2. Add nullable snapshot/version/verification-state fields and operation links as needed. Keep compatibility reads; use server-owned writes for new results.
3. Fix idempotency uniqueness with a tenant/actor/operation scope. Backfill historical global keys into a safe legacy namespace and test duplicate handling before changing constraints.
4. Backfill source trust conservatively. Records created through field promotion or citation-count matching become legacy-unverified/needs-review until supporting evidence is re-established. Preserve the old audit event; do not rewrite history to claim a check occurred.
5. Bind new approvals to current snapshots. Older approvals lacking sufficient identity cannot silently certify a migrated filing export. Provide a review queue with reasons, not a blanket invisible reset.
6. Link compatible client/matter/artifact entities only after authorized ownership checks; quarantine invalid links and offer admin repair with audit.
7. Shadow canonical execution using sanitized/authorized snapshots where allowed, with bounded cost. Compare source support and release decisions, not only prose similarity.
8. Canary by explicit internal/tenant allowlist, then measured percentages under one policy. Never degrade validation simply to preserve old optimistic success rates.
9. Keep rollback for orchestration/routing, but P0 access and false-trust fixes stay enforced in both paths. Rollback is not permission to restore known verification bypasses.
10. Retire old orchestration after caller telemetry and contract parity; compatibility URLs remain. Remove duplicate tables only in a separate reviewed migration after retention/restore requirements are satisfied.

## 10. Quality gates and release evidence

### Minimum regression suite

- All five directly reproduced bad behaviors must have failing-before/passing-after tests.
- Cross-tenant and intra-tenant restricted-matter access across context, jobs, streams, source viewers, linking, exports and handoffs.
- Fake/near-match case, correct citation with wrong proposition, party submission mistaken for ratio, misleading summary, corrupt/missing pages, wrong statutory version, future/expired provision and foreign-case binding misclassification.
- Saved user-edited research cannot retain canonical verification; decline/correct evidence causes dependent recheck.
- Clarification answer affects the next run and is idempotent; stale expectedRevision returns conflict with preserved input.
- Rendered PDF and DOCX parse correctly and contain approved text/numbering/authority references; failed storage gives no success artifact.
- Process-separated worker/API with reconnect, two subscribers, cancel/retry, queue outage and late completion.
- Word multiple matches and out-of-date document anchors never edit silently.
- No-source/unsupported court profile/unknown treatment scenarios can abstain honestly; a pass rate cannot be improved by removing difficult cases.

### Evaluation set

Build an advocate-reviewed initial set covering India and Kenya, civil/commercial/criminal/employment/land/procedure, research/review/drafting, plus ambiguous/incomplete/no-source questions. Version fixtures with primary sources and expected acceptable/unsafe outcomes. Include long matters with adverse facts and late-file material evidence. Use a held-out set and external reviewer for production quality assessment.

Report identity precision, proposition support, exact quotation rate, temporal applicability, material-fact coverage, issue/contrary-authority coverage, appropriate abstention, stale approval rejection, document integrity, reviewer correction rate and latency/cost per completed task. Distinguish benchmark performance from production confidence. Set latency budgets after baseline measurement and task/document size definitions, not arbitrary promises.

### UI and operational acceptance

Run browser flows at desktop/tablet/mobile widths; Flutter on representative devices; Office add-in tests on supported Word surfaces. Check long names/citations, scans, network loss, declined permissions, empty results and stale tabs. Validate accessibility and recovery, not just happy-path screenshots.

Add a staff-only quality/capability panel: current active engine/policy, source connector availability/freshness, extraction/verification coverage, blocked/degraded runs, queue failures, cost and reviewer correction rates. Provider configuration status is not legal coverage. Admin can inspect/repair authorized technical state with audit, but cannot manufacture advocate approvals.

## 11. Copy into Cursor: execution instruction

> You are implementing the Umbrella remediation plan in `/Users/v/Desktop/Legal/legal-by-odaflow`. Read the current files and preserve all existing uncommitted work. Use this full review, including detailed F01–F32 findings. Do not start with a wholesale rewrite or another agent/framework layer.
>
> Begin with U01–U10 and U32: reproduce the documented defects, protect source/audit/access/approval boundaries, fix scoped idempotency and job authorization, make release fail closed on missing checks, and generate real PDF/DOCX artifacts. Keep all public routes compatible while removing their independent trust decisions.
>
> Implement one work context, one evidence meaning, one research application service, one drafting application service and one release policy using the existing infrastructure. Prefer the richer main research path over the weaker platform workflow as the behavior to characterize; retain its authorized selected-context handling. Select canonical drafting generation through evidence-backed tests, not naming/version assumptions.
>
> Deliver the client-first matter-file flow consistently on web, Flutter and Word: add/select client, create/select file, or explicitly work unassigned; ingest evidence; ask durable material questions; research exact official law and relevant cases; draft/review with source links; preserve revisions; require authorized approval of the exact current version for approved filing exports.
>
> Official-source retrieval must work for India and Kenya with passage integrity, statutory version/applicability, case identity/proposition support, hierarchy and explicit later-treatment uncertainty. Every research/drafting task attempts case-law retrieval and records coverage. Do not fabricate, add irrelevant cases to meet a quota, or require citations inside document formats where a separate research packet is appropriate.
>
> Make incremental reviewed changes with migrations/backfills, tests, schema/API contracts and rollback. For each ticket report changed files, acceptance evidence and remaining limitations. Do not weaken verifiers to satisfy brittle tests; repair the harness/fixtures with explanation. Do not deploy, alter production data or communicate with clients unless separately instructed.

---

# Detailed initial audit and acceptance specifications

The following material supplies the original detailed F01–F14 implementation evidence and source verification requirements. Read it with the expanded call-path corrections and F15–F32 findings above.

# Umbrella: accuracy, architecture and client-workflow remediation

**Codebase:** `/Users/v/Desktop/Legal/legal-by-odaflow`  
**Review date:** 18 October 2026  
**Deliverable:** implementation instructions for Cursor; no application code changed.

## 1. Executive decision

Umbrella has substantial useful infrastructure, but too many competing routes to generate, verify, repair and release a document. More prompts, agents, templates and validators will not by themselves solve this. Consolidate the execution path, establish one evidence contract, and make server-owned verification and client/matter context unavoidable at the relevant boundaries.

The strongest confirmed accuracy defect is that a source can become “verified” merely because citation, text and jurisdiction fields exist. The prompt adapter also labels non-rejected sources as verified. This can undermine otherwise strict downstream checks.

Do not rebuild the entire product or delete all existing validators. Preserve tenancy, client/matter records, source connectors, evidence admission, deterministic checks, audit history and version-bound approvals. Establish which components actually execute, fix the defects below, then retire parallel orchestration only after behavioral parity is demonstrated.

**Product target:** Research or Draft → choose/add client, or explicitly continue without client → choose/create matter file → confirm facts and jurisdiction → retrieve primary law and case law → resolve material questions → generate with traceable support → review → save a version → approve and export when eligible.

## 2. Scope and limits

Repository-wide inventory covered backend, Next.js web, Flutter app and the presence of Word/Outlook add-ins. Focused source review traced research entry points, drafting adapters and jobs, source retrieval and admission, verification, manual citation review, draft history, approval/export, tenant boundaries, and client-file integration. This is a risk-focused code review, not a claim that every line or every product module was manually audited.

Inventory found 1,637 backend TypeScript files, approximately 297,891 lines; 641 web TSX files, approximately 145,045 lines; and 278 non-`.g.dart` Flutter Dart files, approximately 412,306 lines. These are rough inventory counts, not handwritten-code complexity measurements: generated localization/catalog content materially inflates totals. No AGENTS.md was found under the supplied Legal tree in the scan.

The working tree already contains many modifications and deletions. Do not reset, clean or overwrite them. Review was read-only against application code. No deployed configuration, production database, provider credentials, live AI run, visual browser session, PDF/DOCX output or full build was inspected. Production impact is therefore inferred from source unless explicitly identified as tested.

### Focused verification actually executed

From `legal_backend`, ran:

```bash
node node_modules/jest/bin/jest.js --runInBand --no-coverage --runTestsByPath \
  src/ai/legal-research/research-provider-gate.spec.ts \
  src/ai/legal-research/research-cache-promotion.service.spec.ts \
  src/ai/unified-drafting/verification/draft-authority-verification.spec.ts \
  src/ai/drafting/platform/validators/authority-verification-gate.validator.spec.ts
```

Result: **3 suites passed, 1 failed; 11 tests passed, 4 failed**. The failures were in `draft-authority-verification.spec.ts`: consumer deficiency relevance, specific-performance readiness relevance, cross-domain case identity, and the minimum passing cases for a consumer research memo. These establish a broken test baseline; they do not prove whether each failure is a production false negative or an outdated fixture. Resolve against authoritative passages, not by weakening verification to satisfy old expectations.

## 3. Findings with concrete implementation targets

All paths below are relative to the codebase root. Locations describe the reviewed snapshot; Cursor must re-read before editing.

### F01 — P0: verification is promoted without verification [confirmed]

**Files:** `legal_backend/src/ai/unified-drafting/retrieval/verified-source-registry.service.ts`, `.../contracts/verified-source.ts`.

`classify()` around lines 54–62 promotes `partially_verified` to `verified` when citation, text and jurisdiction are truthy. `getPromptSources()` includes partially verified sources. `toSourcePromptEntry()` declares and emits `verified: true` for every source passed to it, irrespective of actual status. `fromAuthority()` can substitute a proposition for source text, defaults missing jurisdiction to IN, and truncates text to 800 characters.

**Impact:** summaries or unsupported propositions can be presented as verified legal evidence; missing jurisdiction can become India by default. The contract also lacks the provenance depth already present in the research evidence model.

**Fix:** remove field-presence promotion; preserve evidence states through all adapters. Require verifier-produced, versioned evidence receipts for verified status. Make jurisdiction explicit/unknown. Distinguish verbatim passage, source summary and generated proposition. Supply verified passages to generation; pass uncertain discovery material only in an explicitly non-citable background channel. Use full hashes for source artifacts; short display IDs may be separate.

**Acceptance:** partially verified input stays partial through registry and prompt serialization; a fabricated case with populated fields cannot pass; an unverified proposition cannot become a quotation; missing jurisdiction never silently becomes IN.

### F02 — P0: client can supply stored verification status [confirmed]

**Files:** `legal_backend/src/ai/drafting/court-draft.controller.ts` (`UpdateCourtDraftDto`, PATCH handler), `.../court-draft-history.service.ts` (`update`, around lines 126–160).

The update DTO accepts `verificationAudit` from the caller, and history update copies its `verificationStatus` and `requiresLawyerReview` into persisted fields. The same audit can contain filing readiness, which the India export service later reads.

**Fix:** public mutation DTOs accept content and expected revision only. Server computes audit, readiness, citations and certification. Any content edit marks verification stale, invalidates active approval and queues/requires verification. Human review records must be created only through authorized review commands. Reject unknown protected fields rather than silently trusting them.

**Acceptance:** forged verified/readiness fields cannot change trusted state; changing text immediately removes the previous readiness label; approval/export cannot consume an audit for an older text hash.

### F03 — P0: approval/export version checks are incomplete at the boundary [confirmed design gap]

**Files:** `legal_backend/src/ai/india-draft/india-draft.controller.ts` (`approveHumanReview`, lines ~167–185; export ~281–313), `.../drafting/platform/human-review.service.ts`, `.../india-draft.service.ts` (`exportDraft`, ~2074).

Useful existing behavior: filing export loads persisted text and requires approval; the service also checks persisted filing readiness. Preserve these protections.

However, approval compares the submitted draft hash but accepts case-record and playbook version identity from the DTO. Export passes the review record’s own case-record/playbook versions back to approval validation, rather than loading the current authoritative versions. That check cannot independently detect a changed case record or playbook. No reviewer-role check is visible on the approval method; class-level TenantGuard and global JWT are not advocate qualification checks.

**Fix:** load current draft, case record, matter snapshot, playbook and evidence versions server-side at approval and export. Explicitly authorize reviewer capability. Bind release to content hash + fact revision + evidence revision + court profile + policy/playbook version. Recompute current release eligibility; use a transaction/optimistic revision to prevent edits racing approval/export. Derive authority appendix from the approved server snapshot; the service currently also accepts DTO appendix data.

**Acceptance:** edit facts without editing draft text → old approval rejected; change playbook/source evidence → approval stale; unauthorized tenant member cannot approve; supplied appendix cannot inject authorities into a filing export.

### F04 — P0: draft-to-client linking does not validate target scope [confirmed missing local checks]

**File:** `legal_backend/src/ai/drafting/court-draft-history.service.ts`, `linkToClient`, ~345–376.

The method scopes/resolves the existing draft but directly writes supplied clientId, matterId and clientName. It does not load the target client/matter to establish tenant, permissions, or client–matter consistency. A normal foreign key does not establish tenant equality; verify any database policy separately.

**Fix:** use shared authorized client/matter resolvers; validate same tenant, matter access and actual client relationship in one transaction. Derive display name from client record. Reject archived/inaccessible records. Preserve history when relinking; do not null an existing matter merely because an optional parameter was omitted.

**Acceptance:** foreign-tenant client/matter IDs, an inaccessible matter within the tenant, and a matter belonging to another client all fail without changing the draft.

### F05 — P0: job idempotency is globally scoped [confirmed]

**Files:** `legal_backend/src/ai/unified-drafting/draft-job.service.ts`, create ~83–93; `legal_backend/prisma/schema.prisma`, DraftJob idempotencyKey around line 5390.

Lookup uses `findUnique({ where: { idempotencyKey } })` and immediately returns the existing job summary without checking tenant/user. Schema makes the key globally unique. A caller controls the key. It also lacks a request fingerprint to distinguish a legitimate retry from reusing a key with different facts.

**Fix:** tenant/actor/operation-scoped uniqueness and lookup; store canonical request fingerprint. Same scope+key+same fingerprint returns same job. Different fingerprint returns conflict. Handle concurrent duplicates atomically. Validate matter access before creating or returning a job. Consider an outbox/reconciliation path because DB creation and queue insertion are currently separate operations.

**Acceptance:** two tenants using `demo` cannot see or reuse each other’s job; simultaneous retries create one logical operation and one charge; queue outage leaves a recoverable dispatch state.

### F06 — P0: SSE progress subscription lacks job authorization [confirmed]

**Files:** `legal_backend/src/ai/unified-drafting/draft-jobs.controller.ts`, `streamProgress`; `legal_backend/src/app.module.ts` global guards.

Global JWT authenticates the caller, but the SSE handler subscribes using jobId only and does not resolve tenant/matter ownership. Global guards shown are JWT and throttling, not a global TenantGuard. Other status/result methods do use tenant filtering.

**Fix:** authorize the job with the same scoped resolver before subscription; enforce matter access and tenant lifecycle. Audit enrichment/cancel/result routes with the same resolver. Use validated DTO classes for exposed job creation; TypeScript-only request interfaces are not runtime validation.

**Acceptance:** an authenticated user cannot subscribe to another tenant’s job even if the UUID is known. Apply equivalent checks to polling, enrichment and cancellation.

### F07 — P1: progress transport cannot span API and worker processes [confirmed]

**Files:** `.../unified-drafting/progress/draft-progress.service.ts`, `.../draft-worker.processor.ts`, README worker instructions.

Progress uses an in-memory Subject map; worker emits through that service. The documented setup runs API and worker separately, so their maps are separate. `unsubscribe(jobId)` completes/deletes the shared subject, which can also terminate other subscribers to the same job.

**Fix:** reuse existing Redis infrastructure for worker-to-API transport, plus persist durable stage sequence/state. Provide last-event replay or polling fallback. Disconnecting one subscriber must not complete all subscribers. Add heartbeats, reconnect and authorized replay.

**Acceptance:** API process A, worker process B, two browser tabs and a mobile reconnect all see consistent progress; closing one tab leaves the others active.

### F08 — P1: workspace adapter silently drops facts and issues [confirmed]

**File:** `.../unified-drafting/adapters/workspace-v3.adapter.ts`, ~45–59.

`extractFactsFromPlan` takes only the first 10 facts and 5 issues. It also uses `workspace:${workspaceId}:auto` as a permanent idempotency key, so regeneration after facts change can resolve to an earlier job.

**Fix:** pass a versioned structured case record with fact/issue IDs and evidence links. Retrieve relevant facts by section with a coverage ledger; never silently truncate the authoritative input. Include generation revision and request fingerprint in operation identity. Carry matterId explicitly after workspace authorization.

**Acceptance:** fact 11 and issue 6 remain available and must be accounted for if material; changed workspace facts yield a new version, while a retry of the same revision does not.

### F09 — P1: “statute existence” is not statute existence [confirmed]

**File:** `.../drafting/platform/validators/statute-existence-verifier.ts`.

A short hard-coded Act set is supplemented by `/^[A-Z]{2,10}$/`, so an unknown uppercase ID avoids even the warning. Missing section is checked, but section existence is not fetched/validated; parsed draft sections end in a no-op soft-check block.

**Fix:** replace/rename this lexical check. Real existence resolves jurisdiction, official Act identity, section/subsection, version and applicable date against primary text. Unknown is INDETERMINATE, not pass. Use existing BareActLookup/source connectors and section services behind one evidence API. Never guess an equivalent section across repealed/replacement codes.

**Acceptance:** nonexistent section in a real Act, fake uppercase Act ID, wrong country, and wrong historical version all remain blocked or require explicit evidence-backed resolution.

### F10 — P1: parallel engines and inconsistent rollout semantics [confirmed]

**Files:** `ai/india-draft/india-draft.service.ts` (2,262 lines); `ai/drafting-v2/`; `ai/unified-drafting/`; `ai/drafting/platform/`; `ai/drafting/accuracy/`; `smart-workspace/`; `document-automation/`.

There are multiple active/potential orchestration layers, not merely reusable validators. IndiaDraftAdapter applies master flag + rollout percentage; WorkspaceV3Adapter uses only the master flag. Its rollout behavior would differ if invoked; the expanded call-site scan found its definition and module registration but no application call site. Do not assume this adapter is active merely because it is registered. Feature documentation’s “internal users” at 5% is not enforced by its hash-based percentage alone.

**Fix:** one routing policy with explicit tenant/user allowlist and a versioned country/document support matrix. Keep compatibility endpoints as adapters to one job contract. Benchmark candidate engines on the same source snapshots before choosing the canonical orchestrator; the name “unified” is not evidence of correctness. Retire legacy orchestration incrementally behind adapters, with rollback.

### F11 — P1: client/matter capture is fragmented, especially mobile [confirmed]

**Files:** `legal_web/app/app/research/page.tsx` (2,410 lines), `legal_web/components/research/matter-research-context.tsx`, `legal_backend/src/ai/dto/legal-research.dto.ts`, Flutter `features/lawyer/research/legal_research_screen.dart` (1,128 lines), `research_job_screen.dart` around line 333.

Web research takes optional matterId from URL; matter-context UI returns null without it. DTO supports optional matterId but no unified start-with-client operation. Flutter research files have no clientId/matterId matches in this scan, and the job screen explicitly says to open Clients or use web for full save-to-client support.

**Fix:** shared start-work flow specified below, used by web and mobile before research/drafting. Reuse Client and Matter entities; do not create a second “file” entity with overlapping semantics. Preserve explicit standalone mode and permit later attachment through the same authorized linking operation.

### F12 — P1: source discovery, authoritative text and treatment checks must stay distinct [confirmed limitations]

**Files:** `legal-sources/connectors/tavily-search.connector.ts`, `india-code.connector.ts`, `kenya-law-judgment.connector.ts`; `ai/legal-research/current-law-checker.service.ts`.

Tavily requests `include_raw_content:false` and returns summaries truncated to 2,000 characters. Its publication date is mapped into decisionDate; a web publication date is not necessarily the judgment date. Kenya judgment connector deliberately permits thin title/citation shells for fallback admission. India Code `fetchActMetadata()` constructs metadata from identifiers/URL without fetching official metadata. Those can be useful discovery steps but do not independently verify identity, content or applicability.

CurrentLawChecker examines generated output near a citation and supplied registry records; it does not itself search later judgments. It correctly returns UNKNOWN when unconfirmed. Preserve that honesty, and do not present it as an exhaustive citator.

**Fix:** typed states for discovery hit, fetched document, extracted passage, identity check, proposition support, temporal applicability and treatment. Fetch source document before reliance; use source-derived judgment date. Only actual primary-text metadata earns a verified identity. Search later treatment separately; maintain UNKNOWN with a specific review task if coverage is insufficient. Avoid foreign authorities silently entering KE binding authority through mixed-domain discovery.

### F13 — P1: strict checks exist, but adoption and semantics differ [confirmed architecture risk]

**Files:** `ai/legal-research/evidence-admission.service.ts`, `source-integrity.service.ts`, `research-publication-decision.service.ts`, `drafting/platform/validators/authority-verification-gate.validator.ts`.

EvidenceAdmission is explicitly additive/opt-in to legacy retrieval. It and SourceIntegrity have valuable fail-closed policies. The release authority validator defaults minimum verified cases to zero, and unknown treatment becomes a warning. These may be intentional for particular documents, but do not deliver a universal case-law/reliance policy without explicit task policy and consistent callers.

**Fix:** mandatory admission at the common generation/release boundary. Define one status model and document-specific policy. Show UNKNOWN treatment and missing cases as explicit unresolved work; do not convert them to a global “verified” badge. Keep stricter filing rules separate from the ability to view/save a working draft.

### F14 — P1: authority verification tests are currently failing [tested]

Resolve the four failures recorded in section 2 by inspecting fixture passages, identity normalization and proposition extraction. Add regression fixtures for F01–F09. Do not mark failures skipped or lower evidence requirements to turn the suite green.

## 4. What to retain, simplify and defer

| Area | Action | Reason |
|---|---|---|
| Existing clients, matters, documents, notes and versions | Retain and connect | They are the right product foundation |
| SourceIntegrity / EvidenceAdmission / publication decisions | Retain, unify semantics and make mandatory | Stronger foundation than prompt-only checking |
| India Code, Kenya Law and official case connectors | Retain and harden | Primary-source retrieval already exists |
| HumanReviewService | Retain and repair boundary/version authorization | Durable approvals are useful |
| Deterministic fact, party, date and annexure checks | Retain, deduplicate by responsibility | High-value checks when fed canonical facts |
| Legacy/V2/unified/workspace generation orchestration | Consolidate after parity tests | Multiple policy paths produce inconsistent behavior |
| Repair loops | Bound and target | Repairs must not fabricate facts or weaken evidence |
| Country-specific entry pages | Keep as shortcuts to shared workflow | Country selection should not select a different trust model |
| Model selectors and advanced research controls | Move to advanced UI | Users should focus on facts, questions and sources |
| More agents, global expansion and template-volume work | Defer in this remediation | Stabilize India/Kenya accuracy and workflow first |
| Word/Outlook add-ins and other generation endpoints | Route through the same release policy | Otherwise they can reintroduce bypasses |

Do not delete billing, marketplace or administrative modules just because they are outside this audit. Reduce visible navigation for the research/drafting task, rather than rewriting unrelated modules.

## 5. Canonical architecture and contracts

Use existing NestJS, PostgreSQL/Prisma, Redis/BullMQ, Next.js and Flutter. No new framework, vector store or agent platform is necessary for the first remediation phases.

One application service owns each workflow. Thin controllers/clients call it; shared validators do not launch alternate generation flows.

1. **WorkContext service:** resolves tenant, actor, permissions, client, matter, jurisdiction and selected evidence. Creates client+matter+operation idempotently when requested.
2. **CaseRecord service:** versioned parties, facts, dates, issues, procedural posture, objectives, attachments and confirmed/contested/unknown states.
3. **Evidence service:** query planning, official-source discovery/fetch, artifact storage, extraction, authority identity, passage admission and later-treatment checks.
4. **Research service:** issue-first plan, proposition/passages/fact links, synthesis, contrary authorities, gaps and review tasks.
5. **Draft service:** document schema + court profile, section generation from the same evidence snapshot, deterministic checks, bounded repair.
6. **Release service:** one server-owned policy for review status, approved version and all exports. Never trust a client-side verified flag.

Suggested logical contract, adapted to existing models rather than duplicate tables:

```ts
type WorkContext = {
  tenantId: string; actorId: string;
  clientId?: string; matterId?: string;
  jurisdiction: { country: 'IN' | 'KE'; subdivision?: string; courtId?: string };
  eventDate?: string; asOfDate: string;
  caseRecordId: string; caseRecordVersion: number;
};
type AuthorityEvidence = {
  id: string; jurisdiction: string; authorityType: 'case' | 'statute' | 'rule';
  canonicalIdentity: string; canonicalUrl: string; fetchedAt: string;
  artifactHash: string; extractionVersion: string;
  passage: { verbatimText: string; paragraph?: string; page?: number; section?: string };
  applicableFrom?: string; applicableTo?: string;
  identity: 'PASS' | 'FAIL' | 'INDETERMINATE';
  passageIntegrity: 'PASS' | 'FAIL' | 'INDETERMINATE';
  propositionSupport: 'PASS' | 'FAIL' | 'INDETERMINATE';
  temporalApplicability: 'PASS' | 'FAIL' | 'INDETERMINATE';
  treatment: 'CONFIRMED' | 'ADVERSE' | 'UNKNOWN';
  permittedUses: string[]; verifierVersion: string;
};
```

Map `RetrievedAuthority`, `VerifiedSource`, authority appendix entries and release findings to this common meaning. Do not implement another registry that repeats the current registry names without repairing their trust boundaries.

Persist each run’s immutable input snapshot, evidence snapshot, model/prompt/verifier versions, result version and decision. Reuse official public-law artifacts globally where licensing permits; keep client facts, uploads, prompts and private annotations tenant/matter scoped. Cache by jurisdiction/date/source revision/policy/model and private context fingerprint where relevant; prevent stale verification surviving source corrections.

## 6. Kenya and India: primary-source workflow

Official sites checked during this review:

- Kenya Law legislation and judgments: https://new.kenyalaw.org/ ; judgment collections under https://new.kenyalaw.org/judgments/ . A retrieved Kenya Law legislative source explicitly identifies its legislation-as-at date: https://new.kenyalaw.org/akn/ke/act/ln/2023/221/eng%402023-12-22/source . This is a source/version example, not an authority recommended for any particular matter.
- India Code lists Acts, sections and subordinate legislation: https://www.indiacode.nic.in/indiacode/home.jsp .
- Supreme Court judgment search: https://scr.sci.gov.in/scrsearch/ ; official neutral citation information: https://www.sci.gov.in/neutral-citation/ .

These web checks confirm suitable source entry points, not successful automated connector operation or unrestricted API availability. Add official central/state gazettes, relevant court sites, rules, practice directions and regulator sources to a maintained registry after connector/access validation. Respect source terms and limits. If a source is inaccessible, offer an upload/manual evidence route, not a CAPTCHA bypass.

### Retrieval and verification sequence

1. Confirm country, state/county where relevant, court/forum, practice area, event date, filing stage and research-as-of date. A country is not a sufficient court profile.
2. Extract legal issues from facts; separate facts needing confirmation from legal questions. Do not simply search the user’s Act guess.
3. Resolve exact Act/rule identities and provisions; inspect relevant definitions, provisos, exceptions, schedules and linked rules, not only one section heading.
4. Fetch official text. Store final URL, source identity, retrieved time, complete artifact/hash and parser/OCR integrity. Search snippets and generated summaries remain discovery only.
5. Determine commencement, amendments, repeal, savings/transitional provisions and territorial applicability from evidence. For India’s old/new criminal codes, event and procedural dates must drive the analysis; do not mechanically replace section numbers.
6. Search case law for each material issue, including contrary authority and procedural propositions. Confirm party names, citation, court, date and exact supporting passage.
7. Separate holding/ratio from allegations, party submissions, headnotes and later summaries. Exact quotations must match the stored passage; paraphrases must not be presented as quotations.
8. Classify binding/persuasive weight from forum and hierarchy. Show foreign authority explicitly as persuasive where appropriate. Preserve subsequent-treatment uncertainty instead of asserting “good law.”
9. Build issue coverage: legal proposition → authority/pinpoint → fact IDs → application → contrary authority/limitations. Unsupported dispositive propositions cause a question, partial result or blocked release.
10. Reverify changed/new citations and source freshness before approval/filing export; record what was actually checked and when. Do not claim exhaustive citator coverage without an adequate source/service.

### Universal case-law requirement

Every research and drafting run must execute a case-law search and persist a case-law coverage section. Research memos and litigation analysis should include relevant verified decisions with propositions and pinpoints. Where the final document format does not call for authorities in the body, include them in an associated research memorandum/table of authorities rather than inserting irrelevant citations into contracts, affidavits or prescribed forms.

If no relevant verifiable decision is found, display **“Case law not yet verified”**, searches/sources attempted, unresolved issue and a review task. Do not invent a case or add an unrelated leading case to meet a numeric minimum. If case-law support is material and required for the selected filing, final release stays blocked until resolved or an authorized, reasoned policy exception is recorded. Never describe missing evidence as verified.

## 7. Client-first and matter-file UX

### Start flow, identical in meaning on web and Flutter

On Research or Draft, present: **“Is this work for a client?”** with Existing client, Add client, Continue without client. Do not make the user leave the workflow. Existing matter launch preselects client/matter and asks only missing questions.

- Existing client: searchable authorized client picker, then existing matter or New file.
- Add client: minimum required identity/contact/entity fields, duplicate suggestion, optional details later. Respect existing conflict-check policy; a suggested match must not expose unauthorized client information.
- New file: short matter title, jurisdiction, matter type and optional court/reference. Use Matter as the file. Create the initial research/draft activity under it.
- No client: label **Unassigned work** and allow attachment later. Do not fabricate a client or silently attach to the most recent client.

Create client, matter and operation through an idempotent application command; use transaction/outbox boundaries appropriate to external jobs. On validation/network failure, preserve typed facts and selections. Ask before moving saved work between client files; authorization is rechecked by the server.

### Workspace design

Desktop: context bar with Client / File / Country / Court / As-of date; central research/draft canvas; collapsible Sources and Questions panel. Source click opens official URL plus the exact stored passage/pinpoint and verification dimensions. Show one plain-language readiness summary, with blockers first and secondary technical detail expandable.

Mobile: same API contract and states; top context selector; tabs for Work, Sources, Questions and File; draft/save offline state, reconnect and resumable job progress. Replace the “use web for full save-to-client” dead end. Avoid implementing a different mobile verification policy.

Matter file contains overview, confirmed/contested facts, parties, documents, research runs, draft versions, authorities, review tasks and activity history. Saved research becomes selectable input for later drafting, with provenance and current revalidation state intact.

Refactor the 2,410-line web research page and large mobile screen around feature modules/hooks/repositories after contract fixes: context/start flow, intake/questions, job lifecycle, result canvas, source viewer, review queue, save/version actions. UI decomposition alone is not an accuracy fix.

### States and accessibility

Show Draft working copy, Sources incomplete, Awaiting your answer, Ready for legal review, Approved version, or Needs re-verification. Avoid a single green verified badge for identity-only checks. Use text/icons as well as color, keyboard navigation and accessible dialogs. Preserve scroll/selection across source inspection and question answers. Show actionable provider failure messages, not an empty success result.

## 8. Human verification and clarification

Reuse `manual-citation-review.service.ts`, existing manual-review DTOs and HumanReviewService; unify rather than create another approval subsystem.

Questions must be durable tasks bound to tenant, matter, run, revision, source and affected issue/section. Each task includes the uncertainty, why it matters, official link, exact candidate passage, proposed interpretation, and choices: Confirm with evidence, Correct, Upload source, Cannot confirm. Distinguish factual client confirmation from legal authority review.

Examples: “Which event date applies to this allegation?”, “Confirm the cited subsection in the linked Act version”, “This judgment discusses the argument but the holding is not yet located.” Ask at the point needed; batch related material questions. Do not repeatedly ask resolved questions unless facts or evidence change.

A click on Confirm is not itself legal verification. Require source evidence/pinpoint and authorized reviewer where policy calls for it. User-uploaded Acts/judgments go through identity and integrity checks. Never permit a checkbox to turn an unsupported quotation into a verified quotation.

Question resolution updates a new case/evidence revision, reruns only affected issue/draft checks and invalidates dependent approvals. Keep rejection/correction history. In consumer mode, let users confirm facts and submit sources, but do not label their action advocate approval.

## 9. Court-ready drafting and export

Court readiness is a country + forum + document-type + date-specific policy, not a fluent writing style. Require a reviewed court profile with source links and effective dates. Unsupported combinations remain review-only; do not advertise filing certification across all forms/courts.

Document assembly checks, as applicable: court heading/venue, party capacities and numbering, case identifiers, jurisdiction and maintainability, material facts, chronology, grounds, relief consistency, valuation/court fee and limitation inputs, required signatures/verification/affidavit, annexure references/index, service details and prescribed format. Unknown fees/dates/identifiers must stay explicit; never generate facts to fill gaps.

Use one structured document representation to render editor, DOCX and PDF. Reuse `document-style-renderer.ts` and existing export components where suitable. Keep internal reasoning, source-review notes and AI diagnostics out of filing text. Export the research/evidence packet separately when appropriate.

Release gates:

- All material facts are sourced/confirmed or explicitly pleaded as allegations with proper attribution.
- Every legal citation resolves to evidence and supports the proposition stated.
- Applicable statutory version is established; material current-law gaps are resolved or handled by explicit policy.
- Mandatory procedural/structural checks pass; material blanks and broken annexure references block filing release.
- Authorized human reviewer approved the exact current revision.
- DOCX/PDF render matches approved text, pagination, numbering, footnotes, tables and annexure references. Check output visually on representative court profiles; do not infer layout quality from HTML alone.

Working exports remain available when useful, clearly marked as working/unreviewed copies. Every export surface—web, mobile, template automation, workspace and add-ins—must use the same release service for approved/filing status. Audit other routes before claiming there are no bypasses.

## 10. Delivery backlog for Cursor

| Phase | Tasks and existing paths | Done when |
|---|---|---|
| 0: baseline | Snapshot dirty tree; map controllers → service → worker → verifier → export; record flags/capabilities without secrets; triage four failing tests | Reproducible baseline, route matrix and named canonical ownership proposal |
| 1: trust boundaries | F01–F06, F09; registry/contracts, history DTO/service, approval/export, jobs/schema | Adversarial verification/tenant/approval tests pass; no trust in supplied audit metadata |
| 2: job reliability | F07–F08; progress transport, queue dispatch recovery, case-record coverage, revised idempotency | Separate-process/reconnect/retry/cancel tests pass without lost facts or duplicate charging |
| 3: legal evidence | F12–F14; mandatory admission, source fetch/version checks, case-law/contrary-law coverage, targeted repair | India/Kenya evidence benchmark has zero accepted fabricated citations/quotations |
| 4: client workflow | WorkContext command; clients/matters services; web and Flutter start flow and saved-work links | New/existing client + file + research + draft + revisit works across both clients |
| 5: review and court output | Durable questions, reviewer capabilities, court profile, shared release and renderer | Material edits invalidate approval; golden DOCX/PDF and authority packets pass review |
| 6: consolidation | Route compatibility endpoints to selected engine; shared flags/support matrix; remove proven-unused orchestration | One documented workflow per supported task, with monitored rollback and no old route bypass |

Do not give an exact completion estimate before phase 0 establishes active routes, schema migration effort and supported court profiles. Ship small vertical slices; no giant rewrite branch.

### Required acceptance scenarios

1. Kenya landlord/tenant research: correct country and court context, official statutory text, relevant verified case law, contrary authority and saved matter research.
2. Kenya employment draft: facts beyond item 10 remain accounted for; annexures preserved; same evidence used in research and draft; correct forum policy.
3. India criminal research: old/new-code and event-date ambiguity triggers a specific question; no unverified section remapping.
4. India civil draft: exact case proposition and pinpoint; no cross-domain leading-case padding; unknown treatment visible.
5. Add client inside Research → create file → answer question → draft from research → reopen on mobile → create new version without losing source links.
6. Continue without client → later attach to authorized file, without duplicate jobs/documents or leaked history.
7. Forge verificationAudit, protected release fields, foreign client/matter IDs, known foreign job UUID and identical cross-tenant idempotency keys → all denied appropriately.
8. Approve → change facts only; approve → change source evidence; approve → edit draft; all three invalidate release eligibility.
9. Official source timeout/403/thin shell/missing PDF page/bad OCR → explicit evidence gap, recoverable manual upload, no verified promotion.
10. Separate API/worker processes, reconnect, two subscribers, retry, queue failure and cancellation → consistent status, no charge duplication, no late overwrite.
11. Irrelevant or nonexistent case supplied by user → flagged and excluded; exact title similarity alone cannot verify it.
12. Research results include case-law coverage even when nothing suitable is found; filing is blocked only according to explicit materiality/document policy, never satisfied by fabrication.

### Test layers

Unit tests for evidence-state transitions, identity/date/section resolution, scoped idempotency and approval freshness. Integration tests for tenant/matter access, atomic linking, schema constraints, queue recovery and all export variants. Contract tests for web/Flutter/add-ins and async resume. End-to-end tests for client/file journey, review tasks and filing release. Visual output fixtures for supported court formats. Use sanitized local fixtures; live-provider checks are separate integration probes with budgets and explicit failure reporting.

Benchmark research and drafting independently with reviewed India/Kenya fixtures covering civil, criminal, employment, land/property, commercial and procedural questions, including negative/no-source cases. Measure citation identity precision, quotation exactness, proposition support, temporal correctness, material fact coverage, case-law coverage, valid abstention, reviewer corrections, latency and cost. Report denominators and confidence limits. “No fabricated authority accepted” is a release requirement; a small passing fixture set is not a claim of perfect legal accuracy.

## 11. Operations and security requirements to verify during implementation

- Provider health/capability view per country/source: configured, reachable, last successful sync, corpus coverage and freshness. Do not expose API keys.
- Retrieval telemetry: discovery count, fetched documents, admitted passages, rejected reasons and issue coverage; never log privileged full prompts by default.
- Separate public-law cache from client uploads/private research; enforce matter access in retrieval, snapshots, source viewers and exports, not only at top-level routes.
- Source fetch security: allowlisted schemes/hosts, redirect validation, SSRF/private-address protection, content/size limits and document parsing safeguards. Treat retrieved text as data, not executable instructions.
- Jobs record complete resumable inputs/snapshots, cancellation checkpoints, bounded repair/retrieval budgets and outcome-aware credit settlement.
- Admin tools may monitor and repair operations with auditable authorization; do not silently impersonate lawyer approval or open all client evidence.
- Retention, deletion and source licensing must be consistent across artifacts, embeddings, provider logs and backups; verify actual implementation before advertising compliance.

These are required follow-up checks, not claims that every corresponding protection is currently absent.

## 12. Cursor execution prompt

> Work in `/Users/v/Desktop/Legal/legal-by-odaflow`. Read this audit and current source. Preserve the dirty working tree and existing clients, matters, research, drafts and billing data. Do not add another AI engine or blanket prompt layer.
>
> First produce a route/policy/capability map and reproduce the four failing authority tests. Implement phases 1–5 in small reviewable vertical slices, beginning with false source verification, writable audit metadata, approval freshness and tenant/job boundaries. Use regression tests that fail for the concrete defects, not tests that merely mirror new code.
>
> Reuse existing evidence admission, source connectors, manual review, clients/matters, job and rendering infrastructure. Canonicalize their contracts and policies. Make primary-source and case-law discovery mandatory for India/Kenya research and drafting. Keep identity, passage integrity, proposition support, temporal applicability and treatment distinct. Unknown must never silently become verified.
>
> Add the shared client/file start flow on Next.js and Flutter, with explicit standalone mode, durable clarification tasks, source inspection, revision history and cross-device resume. A human can verify/correct Acts and sections by providing evidence; a checkbox alone is not verification.
>
> Court-ready release must use current server-owned facts/evidence/playbook/court profile, deterministic checks and authorized human approval for the exact version. All filing export surfaces must use the same release service. Preserve useful working-copy exports and label their review state honestly.
>
> Consolidate orchestration only after benchmark and route parity. Document migrations/backfills, contracts, tests actually run, remaining limitations and rollback. Do not enable a new engine for all users solely because its name is “unified”; do not weaken safety checks or fabricate authorities to make tests/quotas pass. Do not modify unrelated modules, publish, deploy or run production data migrations as part of the local remediation without explicit instruction.
