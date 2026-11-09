# 9 November 2026 — drafting, research and matter workflow release

This release follows root baseline `8cba42f` and backend baseline `d3515c0`. It addresses the current priority work; it does not declare every country, external integration or store launch complete.

## Implemented

- Draft sections receive bounded, authorized matter context, including documents in nested folders. Matter IDs and knowledge-source choices survive the v2 handoff; saved drafts link back to the matter. Queued work rechecks current access before using cached context or calling a model.
- Independent planning and section work run concurrently. Provider requests now preserve reasoning effort and structured JSON mode; token budgets account for reasoning. Empty/truncated output fails instead of becoming a successful section. Stage durations are recorded without logging case facts.
- Final coherence review checks the generated text without silently replacing independently checked sections. Unavailable review and material source gaps prevent certification.
- Research no longer treats a publisher URL or a court-name string as proof of identity, holding, binding status or current treatment. Saved research can contribute verified authorities only through its canonical output and matter access checks. Human saving alone does not promote unverified material into shared research caches.
- Historical research excludes known later decisions/reporters and replacement codes before synthesis, including recovered authorities. Source-bound explanation of a supplied document can continue during external-search outages, with verification caveats. Multi-case comparison retains the strict evidence gate.
- Calendar events can link matters and choose reminders on web and mobile. Timestamps carry explicit timezones; rescheduling updates reminder intent and obsolete notifications are hidden. Existing events are not automatically opted in.
- New notification delivery intents commit with inbox records, survive enqueue outages, reconcile with bounded retries, and recheck recipient membership and source access. Lock-screen/realtime previews omit case details. Delivery is at least once; a provider acceptance followed by worker failure can duplicate a push.
- The web and mobile firm knowledge bank supports submission, revision, matter/document scope, source-rights declarations, expiry, independent review, rejection and revocation. Sole practitioners must explicitly confirm self-review. Decisions bind to the exact revision/hash and are append-only at the database level. Edited, expired or revoked material is excluded from reuse. Private embedding searches are tenant-scoped before ranking and never enter default public search. This is governed retrieval, not confidential shared-model training.
- Mobile splash now follows actual session readiness rather than a one-shot eight-second timer; late, corrupt and stalled secure-storage recovery is bounded and covered by widget regressions. The splash logo also fits landscape viewports.
- Mobile release checkout links now default to the hosted web application rather than localhost. Store billing/publication remains deferred.

## Validation

- Backend: 354 suites and 2,194 active tests passed; 3 existing skipped tests, 2 todo; 4 snapshots passed. Nest/Prisma build passed.
- Web: 81 files / 414 tests passed, TypeScript passed, production build generated 234 pages. Existing nonblocking Next/Sentry/hook warnings remain.
- Mobile: clean analyzer, 60 tests passed, release Android APK built. Release APK installed and rendered the welcome screen on Android 15 emulator. A repeat cold launch became inconclusive during system-wide emulator process-start timeouts/ANRs affecting Google and another app; no Umbrella exception was captured. That run exposed a separate one-shot splash navigation race, which was fixed and covered by three additional regression tests. Real-account SSO and authenticated device journeys were not independently exercised.
- Actual local database fault injection: concurrent reminder scans deduplicated, Redis enqueue failure retained intent, reconciliation recovered it, terminal delivery did not resend, and rescheduled/inactive-recipient notifications became inaccessible. No external pushes were sent.
- Actual HTTP/database knowledge journey: encrypted source storage, pending exclusion, maker/reviewer separation, approved retrieval, cross-firm denial, ethical wall enforcement, public-search exclusion, expiry and revocation passed. Attempted review-record UPDATE was rejected. Disposable fixtures were removed.

## Public-case measurements

These are individual observed runs, not p95 measurements or a quality SLA. No confidential client case was used; drafting facts were fictional.

| Journey | Observed elapsed | Result |
| --- | ---: | --- |
| India single-document draft | 105 seconds | Substantive output; supplied dates retained; no internal failure placeholder; lawyer review required |
| India nested-folder multi-document draft, final retest | 121 seconds | 11,734 characters; fictional seizure inventory/router fact used; matter-linked; not certified |
| Arnesh Kumar historical source analysis, final retest | 31 seconds | Case and actual disposition identified; no 2026 reporter or replacement-code contamination; not independently verified |
| Muruatetu 2021 directions source analysis | 34 seconds | Kenya inherited from matter; 2017/2021 distinction retained; not independently verified |

Earlier draft measurements were 181–229 seconds. An initial 171-second run produced an internal failure placeholder in grounds and was rejected; the provider/token-budget defect was fixed and retested. A later historical research test exposed a future reporter citation; temporal filtering and source-bound analysis policy fixed it before release.

Primary public source fixtures:

- [Arnesh Kumar official court-hosted judgment](https://aphc.gov.in/docs/imp_judgements/Arnesh%20Kumar%20Vs.%20State%20of%20Bihar.pdf), SHA-256 `f2cf583abca63039b7becd6af0fbb5add6ae3e99078ec7ae9a530ce089dfe66b`.
- [Muruatetu directions official Supreme Court PDF](https://supremecourt.judiciary.go.ke/wp-content/uploads/2026/07/Francis-Karioko-Muruatetu-Wilson-Thirimbu-Mwangi-v-Republic-SC-Petition-Nos.15-16-of-2015-Consolidated-Directions6-July-2021.pdf), SHA-256 `8e802beaa97ff9cfde5ce9bcc5a48acac07b4ff16cdd33c5e07e741af39fd9ce`.

## Migration and release gate

Three forward migrations add calendar reminder fields, durable delivery records, tenant-scoped embeddings, governed firm knowledge and immutable reviews. No historical notification delivery is backfilled. Existing embedding tenant metadata is preserved even for orphan tenant IDs, so orphan private content cannot become public.

Local migrations were transactionally rollback-rehearsed. The existing approved full backup remains restricted and unchanged. A fresh 1,082,088,645-byte backup was restored in a non-networked container; all three migrations passed rollback rehearsal and forward application with existing content integrity and private embedding scope preserved. The temporary restore container was removed. Backend `8dec978d64121ce0c09385c4a8b90081050654e2` subsequently passed hosted CI and was verified live with readiness status `ok`, app/worker replicas 1/1, all three migrations applied and private embedding scope intact. Anonymous knowledge/research requests returned 401. Root CI and Vercel production verification follow the matching web/mobile push. Do not reset production or alter historical applied migrations.

## Remaining external and acceptance gates

1. Independent advocate review of representative India/Kenya fixtures, exact-source citation/paragraph and current-treatment checks, adverse-authority recall, side/relief correctness, and a larger latency/cost distribution. Current outputs remain review-required when evidence is incomplete. No claim of universal legal accuracy or superiority to law firms is supported.
2. Credentialed Google/Microsoft calendar sync and real-device notification delivery, real-account Google/Apple SSO, and authenticated mobile end-to-end acceptance. Local API/contract tests do not certify these external accounts.
3. Native Apple/Google subscriptions, tax/store price tiers, receipts, refunds and publication; these remain under the user's explicit later-authorization boundary. Existing pricing strategy and cost/usage settlement work must be reconciled against provider invoices before claims of guaranteed profitability.
4. Country-by-country primary-law/date/version coverage and deadline rule acceptance. Worldwide account access is distinct from verified worldwide legal coverage.
5. New localization keys currently have English fallbacks across the available locale catalogs; native legal-language review is pending. Historical empty-database migration-chain debt remains separate from the tested forward deployment path.
