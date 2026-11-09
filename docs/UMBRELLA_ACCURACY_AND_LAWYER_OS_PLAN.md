# Umbrella: accuracy audit and lawyer operating-system plan

Review date: 9 November 2026 (Nairobi). Baseline commit: `9200f231`.
Status: engineering review and implementation plan; no application behavior changed.

## 1. Decision

Keep the foundation. Consolidate the execution paths and enforce their contracts before adding more prompts, agents, countries, or document types. Umbrella already contains serious work on structured evidence, claim verification, case records, release approvals, court profiles, and workflow persistence. These capabilities are not uniformly used by all entry points.

The central problem is that an apparently identical task can run through substantially different research, drafting, verification, and persistence paths. Some are careful; others generate directly from a short prompt, use lexical heuristics as confidence, or lose critical metadata. A better model alone will not repair this.

Do not promise universal legal accuracy. Publish measured capability by jurisdiction, practice area, procedure, and document type. Make missing evidence and uncertain law visible and actionable.

## 2. Scope and evidence limits

This is a repository-wide architecture survey with deeper source review of the high-risk workflows requested: research, section resolution, drafting, case intake, representation, deadlines, autonomous workflows, billing, and cross-client presentation. Inspected the NestJS/Prisma backend, Next.js web, Flutter intake/network surfaces, Word and Outlook add-ins, CI, and tests. The survey counted 1,676 files under backend `src`, 258 under web `app`, 294 under mobile `lib`, and 33 combined add-in source files; these counts include tests and generated/catalog files and are not a claim of line-by-line review of every file.

No production database, deployed feature flags, provider credentials, populated corpus, live model responses, or actual lawyer work product were audited. Runtime incidence and production legal accuracy remain unmeasured. No external legal propositions or statutory deadlines were certified in this review; legal-rule content must be checked against authoritative sources during implementation and approved by relevant practitioners.

Evidence labels below:

- **Reproduced:** executed locally against the component.
- **Confirmed source defect:** direct implementation evidence; not a production incident claim.
- **Integration risk:** demonstrated mismatch or omission requiring a full-route test.

## 3. Findings, ordered by repair priority

### U01 — P0: autonomous research and drafting bypass the stronger pipelines

**Confirmed source defect.** `legal_backend/src/jobs/workers/agentic-workflow.worker.ts`, `executeStep`:

- `research` directly calls an LLM with an objective and jurisdiction, with no retrieval or passage verification.
- `draft` directly calls an LLM with a document type and objective, without using the case-record/draft release pipeline.
- `verify` returns `success: true` and “Verification queued”; it does not enqueue or execute verification.
- `review` is in the declared action union but has no switch implementation.
- A workflow's matter ID is available in execution context but is not included in those research/draft prompts.

**Impact:** adding autonomy can make answers less reliable than the dedicated tools. A completed workflow can misleadingly appear to have performed verification.

**Repair:** dispatch typed research and drafting commands to the canonical services. Verification must produce persisted findings against an output hash. A review action must pause on a real review record. Missing prerequisites must produce `blocked`, never success.

**Acceptance:** run a workflow with a nonexistent citation, missing client role, and unavailable verifier. Each case must remain blocked or explicitly unverified; none may reach a verified/released state.

### U02 — P0: deadline routes trust caller-supplied tenant IDs

**Confirmed source defect; no live exploitation attempted.** `platform/deadlines/deadline-engine.controller.ts` takes tenant IDs from query/body, without `TenantGuard` or `@TenantId()`. `app.module.ts` has global JWT and throttling guards, not a global tenant-membership guard. The service queries using the supplied tenant ID. The module is imported by `PlatformModule`.

**Impact:** authentication alone does not establish membership in the tenant requested by the caller. Deadline listing/recomputation lacks the tenant authorization pattern used elsewhere.

**Repair:** authenticated tenant context, membership and matter access enforcement, validated DTOs, and service-level scoped lookups. Remove controller access to `svc['prisma']`. Apply ethical-wall checks where required.

**Acceptance:** user A cannot read or recompute tenant B's deadlines; an unauthorized colleague within the same tenant cannot access a restricted matter; rejected requests must not create jobs or disclose facts.

### U03 — P0: limitation periods are calculated from matter creation time

**Confirmed source defect.** `court-deadlines/court-deadlines.service.ts`, `calculateLimitationPeriod`, uses `const from = matter.createdAt`, then adds a practice-area/country day count. The table represents broad areas using one number, including “varies by state” and “average” descriptions. Years/months are represented as fixed day counts.

**Impact:** importing an old dispute today can produce a deadline based on today. A note asking the user to verify does not make that calculation dependable.

**Repair:** disable this as an authoritative limitation calculator. Require an evidenced trigger event, cause/action type, forum, rule version, applicable date, and relevant exceptions. Separate candidate dates from confirmed deadlines. Preserve manually entered court dates.

**Acceptance:** changing the Umbrella creation date must never change a legal deadline. Missing accrual/service/order dates must return a specific missing-information result. Calendar-month/year arithmetic and exclusions need jurisdiction-approved fixtures.

### U04 — P0: invoice-from-time is not atomic or durably linked to its time entries

**Confirmed source defect.** `billing/invoices.service.ts:86–143` reads approved time, creates an invoice, then changes the entries to `INVOICED` using separate operations. `TimeEntry` has no invoice linkage; the entry IDs are returned to the caller. This path sums using JavaScript numbers and defaults currency to USD when unspecified.

**Impact:** concurrent calls can invoice the same time twice. A crash between writes can leave invoice/time state inconsistent. Reconstruction and reversal are harder without stored allocation lines.

**Repair:** transaction with concurrency-safe reservation/conditional update; request idempotency; unique time-entry allocation; persisted invoice lines; Decimal arithmetic; explicit engagement currency and tax/rate snapshots. Do not assume adding a transaction alone prevents concurrent double billing.

**Acceptance:** concurrent identical requests create one effective allocation; partial failure rolls back; replay returns the original result; credit/reversal restores the correct state without deleting history.

### U05 — P1: confidence can be high with no supporting authority

**Reproduced.** `legal-search/sentence-audit.service.ts:38,106,120` skips bullet/heading/blockquote content as boilerplate and returns coverage 1 when there are no substantive entries. `ai/drafting-v2/confidence-engine.service.ts:140–164` converts coverage and citation patterns to a score; `citationVerified` is assigned from a regex match, not a verification result. Party, heading, and verification sections can receive automatic perfect confidence.

Local input, with an empty authority array:

> - The court must grant bail under section 999 of the Imaginary Act.

Observed: audit `entries=[]`, `coverageRate=1`; grounds confidence `score=90`, `grade=high`, `groundedSentenceRate=1`.

This reproduces a component defect, not a claim that the entire final release gate necessarily accepts that draft. V2 is wired into India drafting, including per-kind routing; it is not merely an unused prototype.

**Repair:** parse markdown into substantive claims regardless of presentation. Distinguish `not_assessed` from perfect coverage. Derive verification fields exclusively from passage/identity results. Validate parties and factual sections against case records. Rename any retained heuristic score to a diagnostic metric.

**Acceptance:** reformatting a claim as a bullet, heading, quotation, or paragraph must not improve its evidential status. Zero evidence cannot produce verified legal claims.

### U06 — P1: a second research endpoint has materially weaker retrieval and verification

**Confirmed source defect.** `platform/research/research-workflow.service.ts:57–267` is exposed by `research.controller.ts` and imported through the platform module. Retrieval uses substring matching on the first few objective words, sets every result's relevance score to `0.6`, and supplies the first 500 characters as the snippet. On query error it falls back to authority-weight ordering. Citation binding does not perform the main claim-verification pipeline.

The same service constructs a supposed conflict by pairing an overruled/superseded authority with the first other good/unknown-law authority. This is not evidence of an actual treatment relationship.

**Repair:** preserve the workspace API and persistence, but call the canonical retrieval/synthesis/verification services. Treatment relationships must reference an explicit source passage and directed relationship. Unknown treatment must remain unknown.

**Acceptance:** all research entry points return the same verification contract for the same fixture. Unrelated authorities must never be described as overruling or superseding each other merely because they co-occur.

### U07 — P1: represented client side is not a mandatory shared invariant

**Confirmed contract gap.** `prisma/schema.prisma` Matter and MatterParty, `matters/dto/create-matter.dto.ts`, web `matter-intake-wizard.tsx`, and mobile `create_matter_screen.dart` collect client/opponent and matter type, but not a mandatory relationship between represented party and procedural capacity. `ai/drafting/contracts/case-record.ts` has party roles and fact statuses, but no explicit representation contract. Matter Intelligence party `side` and draft-intent `partyRole` exist in narrower shapes.

`ai/drafting/platform/validators/party-role-consistency.validator.ts` catches selected state/accused conflicts and missing names; its wrong-opponent-as-client section is a no-op placeholder.

**Impact:** knowing that an accused or claimant exists does not establish that the firm represents them. Respondent, prosecutor, complainant, insurer, appellant, and transactional counterparty positions can be conflated.

**Repair:** introduce confirmed `MatterRepresentation` and procedural-role history; propagate a versioned snapshot to every research, strategy, drafting, review, and workflow command. Unknown side blocks advocacy-specific drafting, while neutral research remains available.

**Acceptance:** paired same-facts tests for opposing sides must change arguments, admissions, prayers, and suggested actions while preserving facts and adverse authorities. Appeal roles must not overwrite trial roles.

### U08 — P1: section pinning loses applicability and provenance detail

**Integration risk with confirmed adapter behavior.** `legal-sources/section-finder-resolve.service.ts` selects the first match, prefers `newActId/newSection` in `entryToPin`, and retains at most 600 characters of text. It does not accept an incident/applicability date and does not preserve all in-force/verification metadata. It also classifies a hypothetical `matchSource='ai'` as resolved ingest.

Important existing protection: India Section Finder's `pushMatch` rejects AI-only matches, and the AI fallback labels suggestions unverified. This review did not prove that an AI-only entry currently reaches this adapter through India search. The adapter should nevertheless enforce the invariant itself.

**Repair:** explicit selected provision identity, exact subsection, expression/version, effective dates, source locator, verification state, and applicability decision. A legacy/new-code crosswalk is a navigation aid, not automatic legal applicability. Ambiguous matches require selection. Keep full source text separate from display excerpts.

**Acceptance:** historical and current versions stay distinct; an explicit legacy reference is not silently rewritten; repealed/omitted/commencement-pending results cannot become current-law pins; AI suggestions stay unresolved until fetched and verified.

### U09 — P1: another deadline engine has calendar, trigger, and scheduling gaps

**Confirmed source gaps.** `platform/deadlines/deadline-engine.service.ts`:

- Holiday loading is exposed as `warmHolidayCache`, but repository search found no caller; calculation reads the cache/static fallback directly.
- `findRules` checks the end date against now but does not constrain effective start or select by event date.
- Missing jurisdiction defaults to India; country and jurisdiction are separate matter fields.
- Trigger selection takes the first matching fact rather than a resolved, evidenced event.
- Repository search found no production caller of this service's `sendWarnings` method.

Other task reminders and schedulers exist; this finding does not mean the whole product has no notifications.

**Repair:** one deadline service with rule versions, court-local calendars/time zones, explicit trigger selection, confirmed/candidate states, and recurring delivery with durable deduplication. Migrate `CourtDeadline`, `MatterDeadline`, and related Task/Calendar projections through a deliberate ownership model.

### U10 — P1: workflow durability does not match the implementation comments

**Confirmed source defect.** In `agentic-workflow.worker.ts`, `dependsOn` is parsed but not enforced. Failed-step outputs are persisted before the failure decision and later skipped if present, including `null`. The outer catch records failure without setting `hasError` or rethrowing, allowing a completed return value after an exception. The executor reads matter ID from DSL, while workflow creation also has a separate matter ID field.

**Repair:** typed step state records, validated DAG, dependency-aware scheduling, success-only resume, consistent run/job failure, transactional outbox, idempotent effects, authoritative matter context, and durable approval waits.

**Acceptance:** crash/retry before and after a notification produces one effect; failed steps rerun appropriately; dependants do not execute early; a failure cannot be reported as completion.

### U11 — P1: verification meaning changes between clients

**Confirmed presentation behavior / integration risk.** Word `src/taskpane/pages/ResearchPage.tsx` stores research as a string and permits insertion whenever a result exists, without interpreting structured verification status. Web `lib/legal/research-answer.ts` removes an “Unsupported by retrieved passages…” prefix and verification appendices from displayed prose. Web has separate verification UI, which is valuable, but the cleaned answer can become misleading if copied or consumed without that context.

**Repair:** one output envelope across web/mobile/Word/Outlook and exports. Preserve claim caveats with the claim. Separate preliminary insertion/copy from an approved filing export; retain provenance and review state in both.

**Acceptance:** a blocked/uncertain result is never rendered or exported as verified on any surface; copying the answer cannot silently remove a material limitation.

### U12 — P1: lexical matching is still doing work that looks like legal reasoning

**Confirmed implementation limitation.** `ai/verification/proposition-entailment.service.ts` uses token/phrase overlap and a small concept dictionary, with a synchronous optional semantic scorer. Search found the scorer token declaration/injection but no registered implementation. The main research verification service also has asynchronous semantic/adversarial checks: retain those rather than assuming no semantic verification exists.

**Repair:** use lexical checks for candidate filtering and deterministic contradictions only. Semantic support must identify the precise passage, scope, exceptions, and direction of support; uncertain findings must remain uncertain. Calibrate on independent lawyer labels rather than hand-picked examples alone.

### U13 — P2: morning brief is a narrow task query, not a complete legal work queue

**Confirmed source behavior.** `ai/proactive-copilot.service.ts` retrieves up to 20 assigned tasks due between now and seven days ahead. Overdue tasks are excluded. It counts pending AI reviews and leads tenant-wide, rather than presenting a consolidated, access-filtered actionable queue of legal deadlines, client follow-ups, evidence requests, invoices, and workflow blockers.

**Repair:** one matter-aware priority feed with overdue work first, ownership, source, reason, due-date confidence, and prepared next action. Apply matter access before counts and detail. Deduplicate recommendations and show what the assistant already completed.

### U14 — P1: tests and release evidence are not a reliable green baseline

**Observed test failures.** Web tests: 79 files, 72 passing / 7 failing; 404 tests, 390 passing / 14 failing. Failures include TSX module import problems, draft-prefill expectations, and a complainant/petitioner expectation mismatch. These are not all proof of product defects: classify harness/environment, stale expectations, and behavior separately.

Backend run has already exposed stale manifest expectations, approval-identity fixture type errors, a reproduction test that still expects an old defect, and `p-limit` ESM/Jest import failures. Final execution status is recorded in the validation addendum below.

`src/eval/kenya-research-benchmark.spec.ts` explicitly expects all manifest entries to be pending advocate review. This is honest gating infrastructure, not evidence of achieved lawyer-approved accuracy. CI runs backend tests but the web job does not run `test:unit` or browser tests; add-ins have no jobs in the inspected CI file.

**Repair:** stabilize test contracts and environment first; make behavioral tests prove the corrected behavior; add measured real-pipeline and lawyer-reviewed evaluations before expanding product claims.

### U15 — P1: markdown repair ignores the instruction to remove unsupported claims

**Reproduced by the existing failing test, confirmed in source.** `ai/verification/claim-repair.service.ts:40` discards `audits` and `draft` and returns the original markdown. Its test supplies a material RULE claim with `passageSupport='UNSUPPORTED'` and `action='REMOVE'`; the claim remains unchanged. Both `legal-search/legal-research-verification.service.ts` and `ai/drafting/draft-verification.service.ts` call this method.

The structured `repairClaim` method separately supports removal; the defect is the markdown enforcement path. Other final gates may still mark/block the output, so this is not a claim that every such output is approved. It does mean the text and findings can disagree.

**Repair:** render markdown from the repaired structured claim set, with stable claim-to-output spans and an immutable final audit. Preserve unsupported material only in an explicitly labelled review/diagnostic view, not as an unqualified assertion in the answer. Verify final exported bytes, not a prior draft.

**Acceptance:** a removed claim cannot remain in the direct answer, issue conclusion, body, copied text, or approved export. Reformatting and repeated occurrences must not bypass enforcement.

Related test clarification: two citation-sanitizer failures expect default removal although its default is now `mark`. The reviewed `DraftVerificationService` explicitly passes `strip`. Resolve that contract deliberately; do not treat those two test failures alone as proof that this production call preserves fabricated citations.

## 4. What should be retained

- Canonical retrieval orchestration and its jurisdiction routing, source tiers, exact-section lookup, relevance gates, and retrieval-gap telemetry.
- Structured research drafts, evidence packs, claim-level findings, quotation/identity checks, bounded repair, and final output hashing.
- CaseRecord fact provenance, allegation/admission/dispute statuses, chronology, contradictions, and known-fact validators.
- Draft playbooks/adapters, procedural gates, court profiles, evidence revision tracking, and approval identity contracts.
- Existing client/matter models, conflict checking, trust/billing services, task schedulers, automation rules, outbox infrastructure, and integrations.
- Existing regression fixtures as a starting set, after correcting stale expectations and independent legal review.

Consolidation should route legacy APIs through adapters and compatibility contracts. Do not delete an engine merely because another directory has a newer name.

## 5. Target design: a matter-specific legal reasoning workflow

### A. A confirmed representation record

Add a typed relation or validated versioned aggregate with:

| Field | Purpose |
|---|---|
| tenantId, matterId, clientId, representedPartyIds | Identify whose instructions control the work |
| capacity / side | Defence, prosecution, complainant, claimant, respondent, appellant, buyer, seller, employer, employee, adviser, etc. |
| proceedingId and role history | Preserve separate trial, interlocutory, appeal, and connected-matter roles |
| objectives and authorized scope | Relief sought, acceptable outcomes, instructions, exclusions |
| jurisdiction, forum, stage, relevant dates | Determine applicable law and procedure |
| confirmation state, confirmer, version | Distinguish inferred suggestions from instructions |

Support multiple represented parties and conflicts; do not assume one binary side is enough. A user can save an incomplete matter, but the assistant must request missing material context before advocacy-specific work.

### B. One versioned matter context

Build on CaseRecord rather than introducing a competing free-text summary. Include representation, sourced chronology, allegations versus admissions, evidence, contradictions, procedural history, legal issues, objectives, orders, deadlines, budgets, and engagement terms. Every generated artifact records the context revision used.

Facts need document/page/paragraph anchors and explicit status. Source hierarchy may resolve document priority but must not turn an allegation into an established truth. OCR uncertainty, duplicate uploads, redactions, unsupported inference, and prompt-like text in uploaded documents need explicit handling.

### C. Issue analysis before prose

For each material issue, persist:

1. Legal question, applicable jurisdiction/date, and procedural posture.
2. Elements and burden/standard to be established, each with sourced law.
3. Supporting and adverse facts/evidence, including gaps and contradictions.
4. Binding versus persuasive authorities, passage anchors, currency/treatment limits.
5. Client-side argument and the strongest plausible opposing argument.
6. Reply, uncertainty, available relief, procedural prerequisites, and next evidence/action.

“Think like a lawyer” should mean this inspectable work product and source trail. It should not mean an opaque confidence percentage or a request for hidden model reasoning.

### D. Evidence-backed research contract

Use an envelope shared by every channel:

`request + matterRevision + representationRevision + jurisdiction/asOfDate -> plan -> retrieval -> evidencePack -> structured claims -> verification -> bounded repair -> persisted result`

Keep distinct fields for source identity, passage support, quotation fidelity, legal relevance, jurisdiction/hierarchy, law-in-force, treatment, and human approval. Do not collapse these to one `verified` boolean.

Canonical authorities need stable identity, official/provider source, fetched text hash, exact passage/page/paragraph anchors, court/date/citation metadata, effective versions, and treatment evidence. Search snippets and seed summaries are discovery inputs; they cannot automatically stand in for judgment holdings or complete statutory text.

Cache keys and invalidation must include jurisdiction/date, authority and evidence revisions, representation/matter revision where relevant, model/prompt/verifier versions, and privacy scope. Human approval is not permission to promote client-confidential content into shared research.

### E. Drafting as a validated artifact lifecycle

`confirmed intake -> document/side/playbook selection -> outline and required facts -> issue/evidence plan -> section generation -> cross-section checks -> bounded repair -> review -> approved export`

Verify names, party capacities, chronology, allegations/admissions, numbers, dates, relief, procedural prerequisites, citations, evidence annexures, and consistency between grounds and prayers. Missing material facts become targeted questions. Never fill blanks by guessing.

Track editable working drafts separately from filing-ready releases. Any change to text, evidence, representation, court profile, or relevant law invalidates approvals tied to the old digest. Render DOCX/PDF and test headings, numbering, annexure references, signatures, and court-specific format.

### F. Autonomous preparation with enforceable action scopes

| Action class | Intended behavior |
|---|---|
| Read, classify, extract, research | Run automatically within matter permissions and budget |
| Prepare draft, evidence checklist, task proposal, invoice draft | Run automatically; retain provenance and review state |
| Routine reminders and internal assignments | Execute under firm-approved rules, deduplicated and auditable |
| Client/opponent correspondence, filings, material deadline confirmation, trust/payment actions | Require the configured authorized approval tied to exact content/action |

Implement per-tenant and per-matter policies, bounded retries, cost limits, cancellation, dependency checks, idempotency, durable waits, and observable failures. Prepared work should remain available if a model/provider is down. A failed verification step cannot be bypassed by a fallback model.

### G. Lawyer CRM and financial workflow

Connect lead -> conflict check -> engagement -> client -> matter -> evidence/tasks -> time/expenses -> prebill -> invoice -> payment/reconciliation -> closure/retention.

The dashboard should answer: what is overdue; what could prejudice the matter; what is blocked; what the assistant prepared; what needs approval; what the client owes; and the next useful action. Include stale matters, unanswered client requests, approaching hearing preparation, missing evidence, budget overruns, unbilled approved work, and overdue invoices.

Keep client billing distinct from Umbrella subscription/AI-credit billing. Extend existing trust/rate/prebill services after auditing their transaction boundaries, reconciliations, access control, currency, and journal integrity. Jurisdiction-specific billing/tax/trust policies require separate legal/accounting validation.

## 6. Concrete implementation sequence

Estimates below are engineering working days for a focused small team with access to a practising-lawyer reviewer; they are planning ranges, not delivery commitments. Use gates, not dates, to decide release.

| Phase | Work and likely files | Dependencies | Exit gate |
|---|---|---|---|
| 0: Contain and establish baseline, 3–5 days | U01–U05, U10; agent worker, deadline controllers/services, confidence/sentence audit, invoice transaction; repair test harness | None | No fake verification, cross-tenant deadline access, creation-date limitation calculation, or duplicate time allocation in regression tests |
| 1: Matter context and representation, 5–8 days | Prisma migration, Create/UpdateMatter DTOs, CaseRecord, intake web/mobile, access-filtered context assembler | Phase 0 contracts | All advocacy commands require confirmed represented party/capacity; role reversal and stale-context tests pass |
| 2: Unified research and section authority, 8–12 days | ResearchWorkflow adapter to canonical engine; resolve-and-pin contract; evidence/version storage; shared output envelope | Phase 1 | Exact sections, source identity, passage support, treatment limits, historical queries, and abstention pass reviewed fixtures |
| 3: Draft quality, 8–12 days | Existing unified/V2/platform adapters, playbooks, party/relief/evidence checks, immutable release gates, exports | Phases 1–2 | Selected document packs pass blind lawyer review and rendered export checks; all channels preserve limitations |
| 4: Deadlines and proactive CRM, 6–10 days | Consolidate deadline ownership; verified rules/calendars; event triggers; morning brief; reminder delivery | Phase 1, reviewed rule packs | Missing/ambiguous dates block calculation; retries deduplicate; overdue tasks and confirmed deadlines appear to the right users |
| 5: Billing and dependable autonomy, 6–10 days | Invoice allocations/lines, engagement/rates, payment reconciliation audit; typed workflow DAG and approvals | Phase 0 containment; prior canonical APIs | Concurrency/replay/crash tests and complete intake-to-payment/approval journeys pass |
| 6: Controlled pilot, 10 business days of observation | Lawyer-reviewed evaluation, telemetry, shadow rollout, defects and usability follow-up | All relevant gates | Agreed metrics met by each supported jurisdiction/document pack, with no unresolved P0 defects |

Some work can overlap after shared contracts stabilize. These ranges should not be summed into a guaranteed production date. Start with Kenya and India because both already have substantive code; pick a limited set of practice areas and procedures using actual pilot demand. Do not claim equivalent readiness for every country.

## 7. First ten implementation tickets

1. **AUD-01:** add regression reproductions for false confidence, fake workflow verification, deadline tenant spoofing, creation-date limitation, and double invoice allocation.
2. **AUD-02:** wire canonical research/drafting into the worker; make verify/review real states; reject unsupported DSL actions.
3. **AUD-03:** authorize deadline routes and isolate tenant/matter access in services.
4. **AUD-04:** disable unsupported automatic limitation dates; introduce explicit trigger requirements and candidate status.
5. **AUD-05:** atomic/idempotent invoice allocations with rollback and replay tests.
6. **AUD-06:** fix markdown claim extraction and no-op claim repair; remove heuristic verified flags; validate no-evidence states and final rendered claims.
7. **AUD-07:** add representation schema/context versioning and intake confirmation on web/mobile.
8. **AUD-08:** route legacy research workspace through canonical retrieval and verification; remove fabricated treatment pairing.
9. **AUD-09:** versioned section pins and shared output envelope across clients and export.
10. **AUD-10:** establish green CI, lawyer-reviewed fixtures, production-path evaluation, and route/feature-flag telemetry.

Each ticket must include a before/after behavioral test and migration/rollback note where persisted data changes. Do not weaken a verification gate to make tests pass.

## 8. Evaluation and release criteria

Build a held-out set with practising lawyers. Initial planning target: at least 100 research/section scenarios and 30 complete drafting scenarios per pilot jurisdiction, spanning supported practice areas; expand based on observed failures. Include contradictory evidence, side reversals, historical law, false citations, source outages, prompt injection in uploaded text, incomplete intake, and adverse authorities. Separate retrieval errors from synthesis and verification errors.

Proposed pilot thresholds, to be agreed with reviewers and reported with sample sizes/confidence intervals:

| Dimension | Proposed gate |
|---|---|
| Fabricated authorities/quotes accepted as verified | Zero observed on adversarial and held-out release set |
| Wrong represented party, jurisdiction, or materially invented fact in released drafts | Zero observed |
| Explicit provision/version retrieval | At least 99% correct on supported indexed provisions; unsupported ones must abstain |
| Mandatory-authority retrieval recall@10 | At least 95% on lawyer-labelled supported queries |
| Material proposition support precision | At least 99% of accepted claims supported by cited passage; report abstention and coverage too |
| Draft usability | At least 90% accepted with minor edits by independent reviewers, plus no critical legal/factual errors |
| Confirmed deadline calculation | 100% on approved rule fixtures; all missing prerequisites blocked |
| Tenant/ethical-wall access and billing concurrency | No violations in negative/concurrent test suites |
| Durable workflow effects | No duplicated side effects or skipped failed prerequisites in crash/retry tests |

These are targets, not current scores or guarantees. A small zero-error sample does not prove zero real-world risk. Measure answer completeness, abstention, lawyer correction time, latency, and cost alongside precision so an engine cannot “pass” by refusing everything.

Run cheap deterministic tests on every PR; run end-to-end mocked-provider contract tests on every relevant PR; run a controlled real-provider evaluation on candidate releases; require lawyer review for changes to rule packs/playbooks and a scheduled freshness process for source data.

## 9. Migration, observability, and rollout

- Inventory every research/draft/section/export route, queue, feature flag, consumer mode, add-in, and mobile client version. Record which engine and gate actually ran.
- Backfill representation only where explicit instructions establish it; otherwise mark unknown. Never infer client side solely from party ordering or document title.
- Reclassify creation-date limitation deadlines as needing review; do not silently overwrite lawyer-confirmed deadlines.
- Reconcile existing invoiced time with invoices before enabling allocation uniqueness. Produce a review report for ambiguous historical links; do not manufacture links.
- Preserve original output and audit history. Migrate cached outputs with unknown verifier/version state to unverified rather than granting new trust labels.
- Use route adapters and feature flags for staged tenant rollout; run new verification in shadow mode before enforcement and measure disagreements.
- Log request/run ID, tenant/matter reference, context revision, engine route, corpus/source revision, retrieved passage IDs, verification findings, output hash, approval identity, and cost/latency. Avoid raw confidential text in general logs.
- Alert on false-success workflow transitions, connector outages, verification skips, unexpected fallback rates, stale corpus, stuck jobs, duplicate financial allocations, and undelivered critical reminders.
- Roll back via compatible route flags and preserved schema support. Do not roll back to permissive verification just to maintain apparent completion rates.

## 10. Work remaining before a production-readiness claim

Production corpus completeness/freshness; live connector behavior; deployed feature flags; real lawyer feedback; authentication/authorization across all modules; trust/payment/refund concurrency; full mobile and add-in builds; browser journeys; export rendering; backups/recovery; operational monitoring and source rights/licensing are not certified by this review. Assign owners and evidence artifacts in the pilot checklist.

The immediate next step is Phase 0 followed by mandatory representation context. Adding more autonomous behavior before those repairs would amplify existing defects.

## 11. Validation addendum

Executed against the local checkout without modifying application source:

| Check | Result | Interpretation |
|---|---|---|
| Backend `npm test -- --runInBand --silent` | 323 suites: 299 passed, 24 failed. 1,989 tests: 1,965 passed, 22 failed, 2 todo. 4 snapshots passed. About 180 seconds. | Not a green baseline. Suite compilation/import failures are separate from executed assertion failures. |
| Web `npm run test:unit -- --reporter=dot` | 79 files: 72 passed, 7 failed. 404 tests: 390 passed, 14 failed. About 22 seconds. | Includes module-loading and assertion failures; not all failures establish production defects. |
| Backend `tsc --noEmit --tsBuildInfoFile /tmp/umbrella-audit-backend.tsbuildinfo` | Passed, exit 0 | Source type-check only; not a build, database migration test, or deployment certification. |
| Direct SentenceAudit/ConfidenceEngine reproduction | Unsupported bullet with no authorities scored 90/high | Confirms U05 at component level. |

An initial type-check invocation disabled incremental compilation and was rejected because the project is composite; the corrected command above passed. Local web output reports Node 24.2.0 while CI selects Node 22, so reproduce harness/import failures under the supported CI runtime before assigning root cause.

Backend failures include the manifest expectations and test-contract problems noted above, the unsupported-claim enforcement failure, a draft-archetype golden gate failure, credit-price expectation mismatches, and a Kenya judgment integration timeout. Network-dependent failures in this restricted environment are not evidence of production connector failure.

No full Next.js production build, Flutter analysis/build, add-in build, browser end-to-end session, live provider benchmark, or production corpus audit was run. Existing legal fixtures do not replace independent practitioner review.
