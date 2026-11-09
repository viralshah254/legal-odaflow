# Umbrella implementation and sustainable launch plan

Date: 9 November 2026, Africa/Nairobi. The user authorized completion of planning followed by implementation and testing. The completed fixes in the other chats are the baseline; preserve their edits. This execution record supplements the country workflow, firm workflow and regional pricing documents.

## Final product and commercial defaults

Implement the published target prices in the regional subscription strategy through a versioned catalog, without rewriting existing subscriptions or activating unconfigured store products. India and Kenya use fixed local list prices; other countries use global pricing until an explicit regional pack exists. Legal capability, billing region, interface language and data location remain separate. Unknown legal coverage never becomes another country's law.

Retain current consumers as a distinct audience. Do not move them into the professional $100 package. Trial and promotional AI are acquisition expenses with a firm global budget, not an indefinitely renewing entitlement funded by hoped-for conversion. The current 50-credit daily consumer grant can cost up to $0.25/provider/day at the proposed denomination and 2× rule: 1,000 daily users can consume $7,500/month before infrastructure. Add acquisition-budget enforcement before scaling free acquisition.

An initial professional trial lasts 14 days, has a one-time 100-credit allowance, no recurring free grant, verified identity and abuse limits. Cap total promotional provider exposure at a configurable monthly budget; stop new grants when exhausted while preserving existing customer files. Never silently create a chargeable subscription at trial end.

Initial capacity targets to validate against measured cost:

| Package | Stored source documents | Included storage | Simultaneous AI jobs | Ordinary batch upload |
|---|---:|---:|---:|---:|
| Solo | 2,000 | 10 GB | 2 | 50 files |
| Solo Pro | 5,000 | 25 GB | 3 | 100 files |
| Firm Team | 20,000 shared | 100 GB | 6 shared | 250 files |
| Firm Growth | 50,000 shared | 250 GB | 12 shared | 500 files |

Document counts refer to unique source documents; versions and exports consume storage. Per-file conversion limits, OCR/page cost, archive extraction and maximum nesting need server-enforced bounds. Do not delete client files at a subscription limit: stop additional ingestion, show usage and offer reviewed storage/bulk-processing options. Proposed storage add-on prices must be published only after measured storage, backup, indexing and egress cost; do not promise unlimited retention or unlimited processing.

Core confidentiality and correct legal verification apply at every tier. Increasing spend does not buy permission to bypass a wall or release unsupported claims. Enterprise operational promises, support hours and recovery objectives are contractual only after the operating system can meet them.

## Profitability and cash controls

Measure cash contribution using realized revenue after store/processor deductions, refunds, taxes payable and discounts, minus provider costs, search/OCR, storage/backup/egress, messaging, attributable support and other direct costs. Promotional cloud credits are recorded separately so expiry cannot make an apparently profitable plan collapse.

Define monthly fixed operating burn F and weighted direct contribution per paid account C from actual cohorts. Break-even paid accounts are ceil(F/C), provided C is positive. As an illustration only, $1,000 fixed burn and $65 contribution need 16 accounts; this is not a statement of Umbrella's current costs. Maintain base, heavy-use and provider-credit-expiry scenarios and review cash runway weekly during pilot.

Enforce: provider/project budgets; tenant/user/matter budgets; concurrency; atomic spend reservations; idempotent settlement; explicit expensive-work confirmation; no automatic top-up by default; costed retries; and cancellation. Alert operators before provider quota exhaustion without exposing client content. Store fees are recovered in purchase price; identical work consumes identical credits across devices.

Global Solo includes 1,000 monthly credits and at most $5 provider usage under the 2× rule. Its annual price remains $1,200 to preserve the $100/month floor. Regional allowance uses the catalog's fixed FX version and 20% retail-budget allocation. Freeze allowance for the customer's committed term. Set top-up price floors, minimum proceeds and a 70% normal-use direct contribution target; reject any catalog quote that fails its own declared margin floor. Measure whether allowances buy a useful complete matter journey before launch.

## Store readiness and account setup

Prepare a machine-readable product manifest containing catalog version, legal entity/app identifier, bundle/package identity, audience, product type, interval, regional price, tax category, entitlement key and credits/seats. Confirm existing App Store Connect and Play Console identities before adding products. Retain existing product IDs and contracts; never reuse a consumable ID for a subscription.

Store products remain unavailable until native purchase UI, signed server validation, lifecycle notifications, restore/manage, account-linking and duplicate-subscription protection exist. Return a non-purchasable quote when a product or fee profile is missing rather than falling back to a hosted WebView or invented FX price. Individual subscriptions, firm contracts, AI top-ups and legal-service invoices have separate product/payment treatment.

Use sandbox and license-test accounts for purchase success, pending, decline, renewal, grace/account hold, expiry, upgrade/downgrade, refund, revocation, restore, reinstall, account switch and repeated/out-of-order notifications. Verify India, Kenya, US and GB prices and transaction fees against actual settlement expectations. Review approved fee programs and storefront-specific link/payment rules at configuration time. No production store publication is implied by local catalog implementation.

Account setup inventory: store developer agreements and business verification; tax/banking; support/privacy/terms and deletion URLs; public website and app links; Apple sign-in identity where applicable; APNs/FCM entitlements and keys; Google OAuth and Microsoft app registrations with minimal calendar scopes; webhook HTTPS endpoints and signing secrets; transactional email domain authentication; data processing/subprocessor register; production service accounts; backup destinations and operator alerts. Check existence without printing secrets; create concrete scoped setup tasks for unavailable accounts rather than fabricate activation.

## Worldwide operation and country readiness

Make account access, secure files, neutral summarization and collaboration usable worldwide where the service can legally operate, with Unicode, international names/addresses, E.164 phone handling, timezone-aware dates and accessible localization. Record supported/limited/unavailable capabilities per legal country and feature. Do not claim universal legal accuracy or primary-law coverage. IP and travel never rewrite a matter or a billing contract.

Use primary-source packs with explicit country/subdivision/court, temporal versions, source rights, freshness, citation convention, supported document kinds and approved deadline rules. Pilot IN and KE on reviewed document packs, then independently validate US/GB and UG. Other countries remain explicit limited coverage while their packs mature. Sanctions/export/distribution and payment availability are release-policy inputs, not an excuse to silently substitute law.

## Research and drafting speed and quality

Instrument retrieval, context assembly, synthesis, verification, repair, persistence and export with durations and usage. Benchmark the actual route used by the UI, not only a new engine behind an unused flag. Use synthetic non-confidential cases for connectivity canaries and source-backed lawyer-reviewed fixtures for quality.

Remove avoidable sequential I/O using bounded concurrency; keep task-wide search budgets deterministic. Reuse validated exact-section lookups and request-local evidence, deduplicate repeated authority checks, and preserve dependency order between draft sections. Avoid per-section repeat retrieval when the same evidence pack suffices. Reverification must assess changed final content and cannot be skipped for a faster completion badge.

Show job acknowledgement and progress immediately. Research should surface retrieval/progress within two seconds on the agreed environment, and substantive output as soon as the task permits; complex exhaustive document review remains a longer workflow with coverage tracking. Record p50/p95/p99 and time to first useful content. Initial candidate targets are 30–60 seconds for ordinary scoped research and 60–120 seconds for an ordinary supported draft, measured after a deployed baseline; do not represent these as achieved SLAs.

Quality checks cover correct client side, sourced facts, current/historical law, official case identity and citation, exact holding/paraphrase, adverse authority, procedural outcome, relief, annexures and rendered format. Unsupported material is retrieved, repaired or withheld; the UI should make the next useful action clear. No claim that the system outperforms every law firm is defensible without a specified benchmark and independent review.

## Execution sequence and release evidence

1. Preserve completed fixes and record type/test baseline, deployment/network limits and current UI routes.
2. Implement deterministic regional catalog/quote economics and explicit non-purchasable store states.
3. Address research cache privacy/freshness and actual serial verification latency before enabling broader matter retrieval.
4. Extend matter legal context, authorized multi-file/folder retrieval, source manifests and connected draft/research linking.
5. Enforce permissions and approval states across APIs, jobs, notifications and mobile; add regression tests before broadening automation.
6. Modernize web/mobile journeys and test real local services, then CRM/calendar/reminder durability and entitlements.
7. Enable curated knowledge promotion only after source rights, confidentiality and revocation tests.
8. Release internally under flags; inspect actual research/drafts and exports; measure cost and quality; then expand by tenant and capability.

Each completed slice records changed files, tests, actual running environment, observed latency/quality and remaining release gates. Never mark the overall plan done because a subset compiles. Local builds, database migrations, provider connectivity, lawyer acceptance, store publication and production deployment are distinct evidence gates.

## Confirmed account and provider release issues

App Store Connect currently lists Umbrella Ai, app ID 6778037932, version 1.0 with build 1.0.6 rejected. The visible review record identifies digital purchases outside IAP and insufficient disclosure/permission for third-party AI processing. Correct native purchases, privacy disclosures and review notes before resubmission. Store products, prices, agreements and publication have not been changed during this work.

The configured Google Developer API key can list models. A synthetic generation request to the configured gemini-2.5-flash returned 404 with a model-retirement explanation for new users. Two synthetic gemini-3.8-flash attempts returned 503, and a gemini-3.1-pro-preview attempt returned 429. These establish specific availability/quota gates; they do not establish successful legal generation or that Google Cloud promotional credits pay for Developer API requests. Check the intended project, paid data handling, quota and authentication mode before production enablement. No private matter material was used for these canaries.

Google's published standard rate card lists gemini-3.8-flash at $0.75/$3.75 per million input/output tokens through 31 December 2026 and $1.50/$7.50 from 1 January 2027. The implementation includes the date change. The 3.1 Pro preview long-context tier applies above 200,000 input tokens. Cached tokens, grounding/tool fees and complete task settlement remain separate accounting work. Source: [Google API pricing](https://ai.google.dev/gemini-api/docs/pricing).

A fresh historical migration chain fails at 20260701120000_add_agent_workflow_run_step_results because AgentWorkflowRun has not been created by an earlier migration. Do not edit already applied migration checksums to hide this. The current schema loads into a separate empty local test database, enabling functional testing; repairing and validating the production migration/baseline path remains a release requirement.

The original iOS build directory is under a synced Desktop folder. Xcode reports Finder/file-provider metadata on a generated framework as incompatible with code signing. A temporary source copy under /private/tmp is used to verify simulator execution without changing signing identities or the user's synced sources. Flutter also regenerated localization outputs and migrated the iOS application delegate to the current UIScene lifecycle; review those generated/platform changes with the app build.

## Execution status

Implemented source changes include bounded concurrent authority checks, actor/evidence-sensitive research cache identity with a short shortcut lifetime, matter-country inheritance, selected/whole-matter/folder document scopes with relevant excerpts, inherited folder restrictions, central ethical-wall enforcement, distinct matter write access, scoped calendar and notification access, versioned recipient disclosure, account-scoped mobile inference permission, mobile matter-to-research linking, provenance-aware similar-case fields and a non-purchasable versioned pricing catalog with fee/economics calculations. The new catalog deliberately does not mutate existing contracts or route unconfigured products into legacy checkout.

This is the first implementation tranche, not completion of the entire master plan. Remaining major work includes native store billing and server entitlements, final regional FX/product mappings, task-wide receipts/reservations and reconciliation, canonical representation history, exhaustive indexed matter retrieval and derivative ACLs, immutable approval workflows across channels, durable reminder delivery and external calendar synchronization, the remaining CRM/mobile parity journeys, governed knowledge promotion and independent legal quality acceptance. Existing Google embedding/transcription migration and a successful real-provider legal benchmark remain open.

### Local validation, 9 November 2026

- Backend production compilation passed after the access-control and country changes. Full Jest run: 340 suites passed, one skipped; 2,108 tests passed, three skipped and two todo; four snapshots passed.
- Web unit run: 411 tests passed across 80 files; TypeScript check passed. A separate production build is tracked below; development-server startup alone is not production-build evidence.
- Flutter analysis: no issues. Complete mobile suite: 51 tests passed. This run includes a real fix for timestamp-derived operation-key collisions: UUID v4 bytes now come from `Random.secure()`.
- The iOS simulator launched the app from an isolated temporary source copy to avoid synced-directory code-signing metadata. The welcome screen was inspected. Authentication and a successful provider-backed legal output were not established by this launch.
- Dedicated local Postgres/Redis backed the functional API tests. The original historical migration failure remains separate from the current-schema test database.
- Mobile statutory lookup, suggestions and popular queries now preserve the requested legal country; attached matters inherit their country. Unsupported countries receive an explicit limited-coverage state. A request-level regression checks KE, US and GB. Country changes invalidate stale suggestions; statutory-result-to-research navigation retains the attached matter.

The store release remains blocked on native purchases/server entitlements and final privacy review. The provider-backed legal quality and latency acceptance gate remains open after the documented 404/503/429 responses; deterministic fixtures and passing tests cannot substitute for a successful real-output benchmark.

The rebuilt backend also passed all five real local API smoke checks: authorized country/nested document inventory; matter calendar create/read; notification recipient isolation; ethical-wall denial even for an administrator; and regional catalog quotes with unconfigured checkout disabled. Two separate real-database wallet tests passed concurrent-spend limits and ledger-failure rollback. Test records were synthetic and cleaned by the scripts.

Web production validation completed successfully: optimized compilation, lint/type validation, all 233 static pages and build traces finished with exit code 0. Non-blocking warnings remain for the Twitter image runtime export, Sentry error-handler/config modernization and Next.js TypeScript project-reference support. The development web server returned HTTP 200.

### Release preparation follow-up

Remote `main` matched local HEAD `9200f231` before release preparation. The deployed backend host is on older source `d10121fa`; its running app uses the same hosted Neon database audited here. Production currently selects the OpenAI routing policy and explicitly names the retired Google 2.5 model; no production provider settings were changed.

Read-only Prisma status reports exactly one pending migration: `20261018_umbrella_u01_u10`. A dedicated empty local database rehearsal applied that SQL twice to synthetic old-schema rows, preserved existing draft content and enforced tenant/user/operation-scoped request uniqueness. This is a narrow migration rehearsal, not a restored-production-data test. Schema comparison also found pre-existing drift; aggregate inspection found 37 duplicate jurisdiction-form key groups and zero duplicate non-null invitation-token groups. No legal forms were deleted/merged and no additional unique constraint was forced over ambiguous data.

Automatic approval review rejected a full hosted-database export to `/private/tmp/umbrella-release-20261109` because confidential legal records and the local destination need explicit approval. No export or production migration ran. An explicit backup choice was requested; production migration and the deployment-triggering main push remain held pending that response and validation. The project's migration runbook requires a verified backup before apply.

A public court-hosted Arnesh Kumar judgment was fetched and readability/identity checked for live model canaries. Google returned 503. The existing configured-provider path fell back to DeepSeek and produced accused research, complainant research and a draft in approximately 13.3s, 15.5s and 10.5s respectively. All had case identity and token usage; only accused research included the exact requested primary-source URL. The other two failed the source-link check. These were adapter-level historical 2014 scenarios, not the complete application route, independently verified current-law outputs or lawyer acceptance. Source: https://aphc.gov.in/docs/imp_judgements/Arnesh%20Kumar%20Vs.%20State%20of%20Bihar.pdf .

Additional release fixes: unconfigured production M-Pesa now fails closed instead of returning a development payment ID; production e-sign fallback denial has regression coverage; the no-mock scan excludes test files and documents the tested development-only/production-rejection paths; deployment logging no longer serializes Docker credential arguments. The latter source fix still needs installation in the webhook service. The generated statute inventory now records PDF SHA-256 and explicitly describes readable extracted coverage; missing local provisions are described as source-extraction gaps, not nonexistent law. This inventory is not an independent statement of statutory completeness.

Latest validation: backend production build passed; 342 Jest suites and 2,117 tests passed (one skipped suite, three skipped tests, two todo; four snapshots passed). The no-mock, 116-act generated-inventory and strict taxonomy gates passed. The task catalog was regenerated from current source (436 patterns). Web/Word type checks and the earlier complete web/mobile runs remain applicable; no web/mobile Dart source changed in this release-preparation follow-up.

Android release compilation completed successfully in 381.6 seconds and produced a 109.8 MB local APK targeting `https://api.okaylegal.ai/api/v1`; no store upload occurred. Flutter added its current Android compatibility flags. Gradle/AGP/Kotlin future-support warnings remain modernization work. Public read-only checks returned HTTP 200 for `https://api.okaylegal.ai/api/v1/health`, `https://legal-api.odaflow.com/api/v1/health` and `https://okaylegal.ai/`. These checks describe the pre-release deployment; the new candidate is not live.

### Localization release correction and explicit debt

The previous remote main already failed its locale workflow. Its full hardcoded-copy audit contains 1,843 inherited occurrences. The release now keeps that full strict audit available and changes CI's hardcoded-copy step to a tested regression gate pinned to previous main `9200f231019239dc25f0e6f53c328b5a8e671546`. It rejects new text, new files and increased occurrence counts rather than silently expanding the baseline. Seven Node regression tests cover those cases and invalid baselines. CI also writes the outstanding full-audit count into the job summary. This is a deliberate progressive migration policy, not completion of full localization; the default strict audit still reports inherited debt.

All 26 newly flagged occurrences were inspected: actual UI copy was moved into the message catalog, and two non-rendered JSX conditional fragments were classified correctly. Seventy-three unresolved translation usages now resolve. Fifteen corrupted Odia strings had embedded English fragments repaired locally. The missing messages use 107 explicit English fallback keys per non-English locale, recorded in `shared/i18n/extraction/release-english-fallbacks.json`; these are not represented as certified native translations. An external translation API attempt was rejected before execution; no UI copy was sent to that API. The complete broad codemod preview was not merged because its analysis failed.

The isolated targeted correction passed all 411 web tests, 51 mobile tests, Flutter analysis, web TypeScript, key parity, key resolution, strict mixed-locale and the no-new-hardcoded-copy check. The full inherited hardcoded-copy audit remains 1,840 occurrences and native translation QA remains open. A displayed usage charge now interpolates its credit count once and uses ICU pluralization.

The targeted locale correction subsequently passed the complete Next.js production build (all 233 static pages) and Android release compilation (109.8 MB APK, 224.5 seconds). The first isolated web build could not resolve Google Fonts inside the sandbox; the network-enabled retry completed successfully. No translation API was used and no store publication occurred.

### Approved backup and migration apply

The user explicitly approved the temporary local backup. A complete PostgreSQL 17 archive was streamed over SSH into `/private/tmp/umbrella-release-20261109` with restricted directory/file permissions. Archive size: 1,082,067,111 bytes. Its SHA-256 and validation evidence are in that restricted directory, not in the repository. It restored successfully into a network-disabled local database with no restore errors. The exact pending migration then succeeded on the restored copy; affected-table row counts and fingerprints of original content matched before/after. No confidential record contents were printed.

Production `prisma migrate deploy` subsequently applied `20261018_umbrella_u01_u10` successfully. The historical fresh-empty-database migration-chain issue remains a separate installation requirement; production was not reset or db-pushed.

The verified direct primary route produced historical Arnesh Kumar accused research, complainant research and a placeholder-safe draft with primary-source URLs in approximately 13.1s, 19.8s and 6.7s, without fallback. These are limited source-grounding checks, not current-law or independent lawyer acceptance. Production's previous Azure route failed DNS and named two unmapped Claude roles. A restricted rollback copy of the existing env file was retained; direct routing with already-configured credentials and mapped synthesis/repair roles was prepared for rollout. No new provider account was created.

Shared training is held disabled pending governed promotion. The disable flag now also prevents new research-signal retention and cached/global prompt-preference reuse; two regression tests cover those omissions. Production had zero global research preferences at the count-only check. The final backend build and full suite passed: 342 suites, 2,119 tests; one skipped suite, three skipped tests, two todo; four snapshots passed.

Deployment topology: the workspace app repository is `viralshah254/legal-odaflow`, while the nested backend repository is `legal-odaflow/legal_backend` and owns the existing image/deploy workflow. API rollout must precede the web/app push. That API publisher now validates the backend before publishing, and stops logging the webhook target/signature. The webhook source also stops logging Docker environment arguments containing credentials. Build/deploy results are distinct from source pushes and must be verified against the live API version.


### Public-case route and standalone CI corrections

The first backend main push stopped at pre-publication validation: twelve source-contract tests read sibling web/mobile files absent from the independent backend checkout. Standalone backend CI now excludes only those two source-reading suites; monorepo CI explicitly runs both against the real sibling clients. No runtime/backend contract suite is disabled.

An actual local authenticated research request used a disposable Kenyan-profile tenant and an Indian matter containing the public Arnesh Kumar judgment. The first run returned a 456-character degraded placeholder after a 12-second synthesis deadline. Large authorized matter context now receives a bounded context-aware deadline, and complexity accounting includes the documents actually supplied. Outcome/disposition questions retain the document ending instead of losing final orders to keyword-ranked passages. Automatically generated FAST authority tables now include only expressly discussed retrieved identities and deduplicate entries, excluding unrelated search hits and oversized publisher disclaimer titles.

The repeated real route returned 5,039 characters in 16.3 seconds (retrieval 7.8s; synthesis 7.2s), used the matter country IN despite profile/request KE, identified Arnesh Kumar, preserved the provisional-bail order made absolute, and omitted the unrelated titles/disclaimer seen in the earlier run. It remains DRAFT_NOT_VERIFIED: independent paragraph/citation verification and current-law treatment were not established. This is a limited historical public-source test, not a claim of filing readiness, comprehensive research coverage, or better-than-lawyer performance. Five retrieved citation records still require relevance/verification review; retrieved records must not be equated with authorities relied upon.

The live webhook's mounted source was patched with a restricted rollback copy to stop Docker argument/credential logging and use the host-compatible Docker 29.5.2 client. The original pinned webhook image was retained; health and mounted source were verified. No manual workflow dispatch or registry publication was used for that operational patch.


### Draft route follow-up

The real draft endpoint correctly rejected missing applicant intake, but its response exposed a date extractor accepting ordinary prose as FIR/arrest dates. Only recognized date shapes are now accepted; missing dates remain missing and continue to block incomplete filing intake. A regression test uses the exact prose failure pattern.

A fictional, explicitly supplied-facts regular-bail request exceeded the 240-second client test deadline. Tracing showed sequential issue searches (up to twelve full connector waits) and a case-theory high-reasoning call that returned unusable JSON. Independent searches now run in bounded batches of three, retaining deterministic merge order. The optional case-theory call uses JSON mode, a 15-second deadline and low reasoning effort with a larger visible-output allowance; its existing brief-derived fallback remains explicit. A concurrency test confirms all issue searches run with no more than three active requests. Production build, no-mock check and all 342 suites / 2,124 tests passed (one skipped suite, three skipped tests, two todo, four snapshots).

The completed temporary restore container/volume and incomplete preliminary archive were removed after validation; the approved complete restricted backup remains retained. Store publication and subscriptions remain outside this release authorization.


### End-to-end draft findings and final certification correction

The batched fictional regular-bail route completed in 181.3 seconds with 5,148 characters, preserving supplied dates, allegations/defence attribution and missing-fact placeholders. That improves on the previous request timing out at 240 seconds but remains too slow for the desired experience. Arnesh Kumar was not cited; this was a current regular-bail scenario with a historical attachment, not proof of complete precedent analysis.

The actual response exposed a serious v2 certification flaw: limited-source sections were allowed to return `canCertify=true` / `verified_for_filing`; final coherence warnings and text repairs did not invalidate earlier section checks. Limited-source/needs-review sections and missing-fact/authority placeholders now require review and cannot certify. Any post-verification coherence revision or HIGH/BLOCKER warning invalidates certification and records the revalidation requirement. Focused regressions cover all these real failure paths. No response with unresolved source verification should be described as filing-ready.

The first successful published backend commit 87cdaeb was verified through the public version endpoint and readiness body (`ok`). App and worker both ran that exact SHA. Runtime direct provider routing, Terra synthesis/repair and DISABLE_TRAINING_PIPELINE=1 were verified in both services. These are deployment observations, separate from final candidate verification.


### Post-push validation corrections

The real final fictional-case request returned HTTP 201 in 229.4 seconds with 7,659 characters. Crucially its public response now returned needs_review, canCertify=false and requiresLawyerReview=true. Connector availability and multiple drafting passes make latency variable; this is still an open performance/quality gate, not a successful filing-grade acceptance test. The earlier 181.3-second sample is not a reliable latency guarantee. The final certification build and complete backend suite passed: 343 suites / 2,129 tests, with existing skips/todos unchanged.

Workspace CI exposed inherited missing ESLint setup and two newer-Flutter async warnings. Added the standard next/core-web-vitals config, removed unused translation-hook calls from plain calendar-colour and portal-grouping helpers, and escaped JSX punctuation without changing displayed copy. Two mobile futures now await inside their try/catch so asynchronous failures reach the intended fallback. Local web lint and 411 tests passed; Flutter analysis and all 51 mobile tests passed. Existing hook-dependency warnings remain visible; no rule was disabled. Localization parity/type checks passed in the first remote run; full native-language and hardcoded-copy debt remains tracked.


The corrected remote run passed Flutter analysis/tests and reached Android packaging, which exposed the runner selecting Java 25.0.5 against Gradle 8.12. CI now explicitly installs Temurin Java 17 before Flutter, avoiding dependence on the runner's changing default JDK. This is a CI environment correction, not a store-signing or publication change.


The next unchanged backend CI attempt failed dependency installation on a GitHub-hosted FFmpeg license download returning HTTP 504, after the previous complete backend run passed. The installed GitHub credential cannot manually rerun Actions jobs (HTTP 403). Backend dependency installation in monorepo CI now retries at most three times, still failing the job if all attempts fail; validation/tests remain unchanged. This addresses the observed transient external binary download failure rather than treating it as a source regression.


The latest floating Flutter stable (3.47.9) additionally rejects Gradle below 8.14, while this project's locally validated Flutter is 3.44.8. Both CI Flutter jobs are now pinned to that exact tested version, with Java 17 retained. A coordinated Flutter/Gradle/AGP upgrade remains modernization work rather than silently changing the SDK on every run.


### Hosting correction and external binary provisioning

Vercel's connected production project had rootDirectory=null and failed NEXT_NO_VERSION because the repository root has no Next.js package. After preserving a restricted settings snapshot, its root was corrected to legal_web and the tested Git main SHA 4aabad59 was deployed directly from GitHub. The deployment reached READY and https://legal.odaflow.com/ returned HTTP 200. No local env file was uploaded. Existing production domains and other settings were retained.

CI's remaining failures were upstream HTTP 504s downloading GitHub release assets, including Gradle's all-distribution redirect and FFmpeg even after retries. Monorepo backend CI now provisions a real FFmpeg executable and uses ffmpeg-static's documented-in-source FFMPEG_BIN override; install scripts and tests still run. Android CI fetches the same official Gradle 8.12 archive through its official GitHub release-asset API, verifies SHA-256 7ebdac923867a3cec0098302416d1e3c6c0c729fc4e2e05c10637a8af33a76c5 from the Gradle checksum endpoint, and points only that CI checkout to the verified local archive. The wrapper now also pins that checksum for ordinary downloads. YAML and shell syntax validated. No third-party binary mirror or verification bypass is used.


### Final identity and native PDF release checks

The hosted sign-in check found that the Vercel project had zero environment variables. Production API/Firebase public settings are prepared from the existing app configuration, with API_URL/NEXT_PUBLIC_API_URL pointing to the deployed backend origin. Public Firebase configuration confirmed the release domain was absent; the owned legal.odaflow.com domain was added while preserving all existing authorized domains and a restricted rollback snapshot. Firebase sign-in stays gated until the hardened backend is live.

Backend Firebase account linking now requires email_verified=true for any email claim before lookup, mutation or provisioning. A signed unverified claim is not evidence of email ownership. Tests cover both false/missing claims being rejected before account access and the verified ownership path. Web/mobile email registration and unverified email sign-in send a verification email before attempting the guarded backend flow. Backend build/no-mock and all 344 suites / 2,132 tests passed; web 411 tests/build and mobile analysis/51 tests also passed.

Android's real compile reached pdfrx native configuration and exposed its unchecked PDFium download failure. CI now provisions the exact pdfrx 1.3.5 chromium/7202 Android assets through the official release API and verifies publisher checksums from pdfium-sha256sum.txt. All three real archives matched. Only the CI pub-cache download line changes to copy those verified archives; PDFium code, ABI/library assembly and app rendering remain intact. Three provisioning regressions verify corrupt archives cannot patch the build, upgrades require pin review and repeated preparation is safe. The user Flutter cache was not modified during this verification.


### Configured production web and realtime correction

Production web environment configuration was applied only after API d38f25b was live and ready. Both existing Google and Apple providers were confirmed enabled. The configured web deployment at main 9e5d18cb reached READY; the live UI showed Google/Apple/email, /api/v1/health/readiness forwarded successfully (`ok`), an artificial invalid Firebase token was rejected with HTTP 401 without account creation, and both /__/firebase/init.json and /api/firebase-public-config returned configured first-party auth metadata. No real user sign-in or confidential case was used.

The API/realtime allowlist was missing the deployed domain. legal.odaflow.com was appended while preserving existing origins, a restricted env rollback copy and the file inode used by bind mounts. Both services converged on the same hardened image; direct provider routing and shared-learning disable remained intact. Live preflight exposed a further initialization bug: the realtime decorator captured localhost before mounted env was loaded. Origin resolution now runs at request time, with regression checks for late configuration, lookalike-origin rejection and native clients. Build/no-mock and all 344 suites / 2,134 tests passed.

The last APK compile showed that Gradle configures the PDF plugin for x86 in addition to Flutter's three packaging ABIs. The fourth official PDFium asset was added with publisher checksum verification; all four real archives matched. The change preserves the original plugin/native libraries and retains corruption/version/idempotence checks.


### Final live verification and diagnostic privacy

Final main 5a8a3cb4 passed remote web, backend and Android release CI, including the APK build. Vercel reported its production deployment successful. API 70917db subsequently deployed; the live realtime test allowed the exact production origin (204), denied an untrusted origin (400/no allow header), and rejected a deliberately invalid socket token. App/worker retained direct AI routing and shared-learning disable.

A final source/log review found case-bearing draft-warning/divergence/repair text and raw research queries in operational diagnostics. These identified sites now log counts, statuses and error classes; full warnings/search trails remain available in their authorized product records. Regression checks ensure a confidential marker is absent from draft metrics and provider-failure logs. Production build/no-mock and all 345 suites / 2,135 tests passed (one skipped suite, three skipped tests, two todo; four snapshots). This is targeted hardening, not certification of a full independent security audit.

Automatic review declined the optional creation of a temporary production Firebase identity because external test-account creation was not explicitly authorized. The command did not execute and no test identity was created. The safer verified/unverified-claim regressions, existing invalid-token production checks, provider/domain configuration checks and live auth UI checks were completed instead. A real end-user social sign-in was not exercised. Store setup/publication remains deferred.
