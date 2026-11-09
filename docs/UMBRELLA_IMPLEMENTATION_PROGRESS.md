# OkayLegal implementation checkpoint

## Requested order
1. Finish billing, workflow, deadlines and live-product fixes already underway.
2. Then implement verified publication and lawyer-specific drafting with at least five samples, jurisdiction-specific practice, quality and speed checks.

## Implemented locally (not deployed)
- Shared AI usage conversion: ceil(2 × recorded provider USD cost / credit USD value). Default credit denomination $0.01. Zero cost yields zero credits. Invalid cost/value inputs rejected. Integer rounding means small tasks can exceed exactly 2× dollar cost.
- Research and drafting edits use the shared conversion; removed the extra drafting-edit multiplier and research evidence-count surcharge. Continuation calls use token costs instead of a fixed fee.
- Token settlement ignores legacy task floors/caps and flat-mode configuration. Gateway and usage recorder can pass their calculated provider cost to settlement rather than recomputing at different rates.
- Conditional wallet decrement and debit record share a transaction; tenant ledger queries include all firm users. Wallet balance is authoritative rather than the larger of two possibly divergent values. Grants are transactional. Existing production wallet/ledger discrepancies require reconciliation before rollout.
- Approved-time invoice creation is serializable, records source time-entry IDs, uses decimal arithmetic and rejects missing/negative rates.
- Deadline-engine endpoints resolve authenticated tenant context; recompute checks matter tenancy. Limitation calculation no longer invents accrual from matter creation.
- Workflow verify/review placeholders fail instead of reporting successful verification. Failed results are not checkpointed as successful; dependencies are checked; exceptions propagate as job failures.
- Semantic reassessment cannot override a detected contradiction. Unsupported claims marked REMOVE are actually withheld. Research display retains material caveats until verified publication gates replace partial-answer presentation.
- Sentence audit evaluates bullets and block quotes, and does not award perfect coverage to empty/no-evidence output. Draft confidence no longer treats citation-shaped text as verified or structural sections as substantively verified.
- Draft intake no longer says a document is ready to sign solely because fields are complete. Missing section text no longer produces an invented Schedule I fee-table explanation.
- Tasks navigation now opens a task list ordered by deadline, including overdue items, rather than redirecting to the matter list.

## Validation so far
- Focused backend: 69 distinct tests passed across pricing, wallet settlement, invoice transactions, tenant isolation, deadlines and claim verification.
- Research display: four tests passed.
- Backend and web type-checks passed, including final billing follow-ups.
- Full web suite: 72 files passed, seven failed; 390 tests passed, 14 failed, matching the audit baseline.
- Full backend run: 301 suites passed, 25 failed; 1,970 tests passed, 24 failed, two todo. This run included old pricing assertions and a contradiction test subsequently corrected and retested. Other failures include existing stale fixtures/contracts, ESM test loading and a live Kenya connector timeout. Targeted reruns of the updated credit-cost assertions and billing-trust fixture passed (nine tests). The full suite is not green.
- No production deployment or production migration performed.

## Still required before production sign-off
- Task-scoped usage receipts with idempotent settlement; aggregate all calls including mixed-model retries, search, embeddings, OCR and verification. Round once per task, not each sub-call. Replace remaining flat/manual charging paths. Reconcile provider invoices/rate versions including cache pricing.
- Reservations must hold spend atomically, support over-budget decisions and release unused balance. Failed and interrupted task cost policy must be explicit.
- Database-backed concurrent settlement/invoice tests and wallet reconciliation. Current wallet tests exercise conditional update semantics via mocks, not a real database race.
- Canonical represented-party identity and procedural side carried through intake, research, recommendations and drafting; opponent claims cannot become admitted client facts.
- Fix missing jurisdiction/document-kind templates and misleading intake completeness values.
- Source-backed statute version/as-of resolution and identity/passage/treatment verification; remove arbitrary research relevance/treatment heuristics.
- Replace direct generic workflow LLM calls with matter-aware, metered, verified executors and human-review state transitions.
- Full CRM/calendar/reminder delivery and matter access-control regression coverage.
- Live re-audit after deployment and lawyer-approved Kenya/India benchmark acceptance.

## Next phase: user clarification
Do not use warnings as a substitute for correct legal work. Verify sources and propositions, repair and reverify; publish supported results with exact source links/pinpoints and faithful paraphrases. If essential facts or sources are missing, ask a focused question or withhold the affected proposition rather than inventing certainty. No guarantee of infallibility.

Personal drafting already exists but currently allows only four uploads, accepts one for analysis, charges a fixed 500 credits, and can save malformed model output as a ready profile. Replace these with at least five distinct readable samples, metered analysis, validated profiles, jurisdiction/document-kind style conditioning, and sample-derived phrasing separated from legal authority and case facts. Source samples must never become instructions or evidence for a new client matter.

## Follow-up: Google routing, remaining failures and Safari review (2026-11-09 local)

### Implemented locally
- Fixed CommonJS retrieval loading by replacing the ESM-only concurrency import with a small FIFO limiter; rejection releases queued work, covered by a regression test.
- Fixed Word request-key generation collisions using cryptographically generated UUID bytes.
- Connected extracted claims to draft repair; unsupported propositions can now actually be repaired/withheld. Citation identity alone is not proof of a holding; curated identity/relevance does not prove current good-law status.
- Added explicit procedural document routing for supported requests that previously returned no recommendation. Missing-document checks now run before generation gates.
- Corrected stale fixtures, dependency mocks, endpoint contracts and test-module imports. Network-only Kenya connector canary is explicitly opt-in (`RUN_LIVE_CONNECTOR_TESTS=true`), not silently treated as verified offline.
- Added Google-only policy to central text/tool routing when `AI_PROVIDER=google`; legacy model selections resolve to configured Google models, cross-provider fallback is rejected, system blocks and structured-output settings are preserved.
- Google completion/image usage now uses provider token metadata including thinking tokens instead of character estimates. Missing usage, cached input, long-context rates and task-level aggregation still need complete accounting support.
- Removed provider/model names from reviewed user-facing research, drafting, Copilot, lead-analysis, credit and meeting labels. Internal provider IDs remain necessary for accounting and operational diagnostics.
- Removed country-based double conversion from wallet credit valuation; the same credit denomination now values equally for India, Kenya and other jurisdictions.
- Personal style now requires five distinct readable samples (up to ten), rejects duplicate uploads, validates structured extraction, rejects malformed profiles, and bills recorded model usage instead of 500 flat credits. Analysis uses an atomic processing claim. Old profiles with fewer than five samples are no longer activated; style prompt checks current status instead of using an hour-old personal cache. Style preferences are explicitly subordinate to current case facts and court/jurisdiction requirements.

### Live Safari review — existing deployment, not a post-release test
Opened the logged-in Safari account and navigated Document Drafting → Personalize to your voice. The deployed dialog still shows four slots, “At least 1 required”, and 500 credits. This confirms the discrepancy corrected locally. Closed the dialog; did not generate a paid draft or change existing case documents. The live header also shows 1,799 credits alongside “100% used”; billing UI denominator/usage semantics still need review.

### Release blockers and unfinished migration
- Deployment was attempted via the configured SSH alias but the workspace rejected port 22 with `Operation not permitted`. Nothing was deployed and no production environment was changed.
- A minimal synthetic Google SDK connectivity probe failed with `TypeError` and no HTTP status. This does not establish whether credentials/models are valid; a successful canary and billing-project verification remain release gates.
- Existing local configuration still selects OpenAI. Do not claim Google-only production behavior until the intended Google project, authentication mode, available models and configuration are validated and deployed.
- Batch meeting transcription still uses Whisper; live transcription uses Deepgram. Embedding transport still calls the old provider even though configuration accepts a Google model name. These paths need implementation, provider usage receipts and tests. Embedding migration requires a parallel Google index/re-embedding and retrieval validation; changing the model name on existing vectors is unsafe.
- Confirm Google model availability before release; defaults are inherited model IDs, not proof of current availability.
- Personal style remains a personal-user wallet flow; tenant-sponsored analysis, budget reservation, cross-operation sample concurrency and durable failed-job recovery remain to be addressed. Prompt restrictions are not a guarantee against sample content leakage; add adversarial style and jurisdiction benchmarks.
- Exact 2× task billing is not complete until all subcalls/tools and pricing variants are captured and one idempotent settlement rounds the task total once.
- Filing-ready claims, jurisdiction-specific drafting quality and autonomous lawyer workflows still require the remaining work listed above and a lawyer-reviewed benchmark. Passing unit tests does not certify legal accuracy.

### Follow-up verification
- Final web run: **79 test files, 404 tests passed** after UI and style changes.
- Personal style: **5 tests passed**, covering the five-sample gate, duplicate samples, atomic analysis claim, usage billing and malformed-profile rejection.
- Backend, web and Word add-in type checks passed. Whitespace/diff checks passed.
- Final broad backend run: **330 suites passed, one failed**; 2,060 tests passed, one failed, one skipped and two todo. The sole failure expected the old model-tier error wording. Updated it for the provider-neutral message; its targeted rerun passed all five tests while retaining the no-downgrade assertions. The separately added personal-style suite passed all five tests. No known failing assertions remain across the broad run plus targeted corrections; this is not a claim of a subsequent single all-green full run. All 116 bundled statute PDFs passed their parser quality checks; this suite took 400 seconds under concurrent local validation load.

## 9 November — drafting speed, research trust and governed matter workflows

The current release supersedes earlier red-suite counts above: see [the dated release evidence and remaining acceptance gates](UMBRELLA_RELEASE_20261109.md). Draft speed/provider defects, historical-authority contamination, canonical saved-research trust, durable reminders, matter context propagation, and web/mobile governed firm knowledge have been implemented and tested. External account acceptance, independent legal review and explicitly deferred store launch are not represented as complete.
