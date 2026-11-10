# Kenya and official-web research readiness

## Product policy

Indian Kanoon is optional and disabled by default (`INDIA_KANOON_ENABLED=false`). A legacy key does not enable requests. India discovery uses official court, legislation, ministry, and regulator domains. Kenya discovery uses Kenya Law, Judiciary, CBK, CMA, Treasury, KRA, ODPC, Parliament and EAC sources. Neither AI memory nor a search snippet constitutes verified legal authority.

The selected matter jurisdiction governs research and drafting; physical location supplies a default only for new, unassigned work. A Kenya-based lawyer may research Indian law and vice versa. Account billing country, current location, language, and governing law remain distinct. Preserve explicit user choices.

## Implemented in this change

- Added official catalogue entries for the Virtual Asset Service Providers Act, 2025 and Legal Notice 134 of 2026; these identify sources and editions, and do not certify fetched legal text.
- Curated Kenyan statute IDs resolve to catalogue entries by exact FRBR work identity, preserving workflow storage IDs and avoiding same-title predecessor acts.
- Kenya judgment DOM extraction retains nested source paragraphs, citation, source hash, retrieval timestamp, official provenance and disposition detection.
- Thin shells and HTTP 202 browser challenges are rejected. Unnumbered judgments retain unknown paragraph integrity; missing disposition evidence remains incomplete.
- Kenya legislation extraction preserves inline text and actual section identifiers. Extracted provisions are explicitly excerpts, not a certification that the entire instrument was obtained.
- Relevant web-discovered Kenya judgments and legislation receive bounded full-source hydration. Direct Kenya case retrieval carries the same provenance into the evidence pack.
- Kenya search fan-out is reduced; judgment and legislation searches are scheduled together. HTTP requests, pacing and retry delays honor the parent research cancellation signal. An access challenge opens a 60-second circuit so evidence recovery does not repeatedly hit the same blocked site.
- Official-source classification validates exact HTTPS hosts. Indian Kanoon, arbitrary `/doc/123` paths and lookalike domains are not official Indian court sources.
- Retrieval cache identity changes so old snippet-only results do not survive this release.

## Release acceptance gates

1. Exact India employment question in Verified mode: relevant primary evidence or a clearly qualified clarification; no invented universal Employment Act or notice period.
2. Kenya Employment Act notice/payment-in-lieu question: distinguish employee resignation from employer dismissal, retrieve actual provisions, accurately identify Kenfreight v Nguti and its disposition.
3. Kenya current virtual-asset question: retrieve the 2025 Act and the applicable 2026 instrument; distinguish March draft consultation materials from later published regulations. Check commencement and any subsequent amendment as of the requested date.
4. Historical Muruatetu exercise: distinguish the 2017 judgment from the 2021 directions; no automatic acquittal, sentence reduction, or extension to unrelated offences.
5. Reject fabricated citations, irrelevant authorities, quoted submissions presented as holdings, missing full-source evidence and unavailable source sites. A successful HTTP response or readable answer alone is not a grounded quality pass.
6. Matter access controls and attachments remain scoped to the authorized tenant and matter. No confidential facts enter shared public corpora or model training.

## Live source limitation found on 9 November 2026

Public Kenya/India official-domain discovery succeeds without Indian Kanoon. Kenya Law direct judgment fetches from the development network returned HTTP 202 with `x-amzn-waf-action: challenge` and no document. The connector must report unavailable evidence, not bypass access controls or manufacture source text. Test deployment-network access separately; if the challenge persists, arrange a supported Kenya Law feed/API or use a separately accessible official Judiciary publication. Discovery snippets may provide leads while full-document verification remains unavailable.

## Kenya rollout beyond discovery

- Keep Kenya country profiles consistent across web/mobile intake, clients, matters, research, drafting, library and section discovery. Scope county legislation to the relevant county and forum.
- Validate Kenyan court hierarchy, neutral citations/eKLR aliases, case dates, binding versus persuasive status, later treatment, statutory amendments, commencement and repeals.
- Use KES for Kenya billing and Africa/Nairobi for local calendar defaults; preserve each event's actual timezone. Never infer court filing deadlines from location alone.
- Link source-backed research and versioned drafts to matters and authorized source documents. Approval and export gates must preserve unresolved evidence warnings.
- Monitor provider availability, source coverage, first-result and completion latency, grounded-answer rate and cost per successful answer. Do not advertise an elapsed-time promise as a guarantee or mark a phase complete from a timer.
- App-store billing, publication, and paid data-provider procurement remain separate authorized release activities.

## Release verification — 10 November 2026

This is a release candidate, not a statement that every jurisdiction, statute or subsequent-treatment record is complete. Do not push until the selected real-source acceptance gates pass.

Implemented after the initial failed runs:

- Fetch complete, publicly accessible court/ministry/GovInfo PDFs with exact HTTPS-host and redirect checks, bounded requests and body sizes, document hashes, real PDF page numbers, and actual captions/dates.
- Preserve primary-text sections and relevant source headings, keep already-prefetched official sources outside discovery download limits, and recover relevant clauses from a retained complete Act after reranking, including native sections referenced later during citation auditing.
- Separate source/pinpoint verification from current-law/treatment verification. Unknown amendments or subsequent treatment stay unresolved; an official source alone does not establish current law.
- Keep research writing bound to the retrieved evidence catalog. Model memory and unverified search leads are planning inputs, not final evidence. Remove conflicting instructions that promised later verification would repair unsupported rules.
- Audit the candidate claims before repairing the published result; keep party submissions, lower-court history and unknown passage roles separate from holdings. Check relevant complete passages rather than cover-page excerpts.
- Keep claim text attached to citations even after sentence-ending punctuation; both citation gates use the same extraction helper. Full source provenance is required before a source can be marked checked.
- Preserve quotations of other cases across PDF page boundaries. Their facts, awards and outcomes cannot become the deciding court’s own findings.
- Supply shared passages once to semantic auditing while retaining a separate support decision for each proposition. Reuse an identical semantic proof only inside the same request; changed inputs and separate matters/requests remain isolated. Bound standalone answers without reducing the source-verification requirements.
- Retain each completed official download immediately so a slower companion request cannot discard already available primary evidence. Add the official Library of Congress US Reports mirror alongside GovInfo.
- Use premium model routing for research, drafting and Section Finder, including legacy Auto requests; remove model names/pickers from web/mobile. Fix Responses JSON-object requests so the intended premium model does not fail merely because JSON instructions were sent separately.
- Preserve explicit and matter jurisdiction; current physical country supplies the new-work default. Billing country remains separate. Add Kenya and US country tests; fix US Code title/section parsing and date/reporter false positives.

Validated source examples:

- India: Supreme Court J.K. Cotton judgment, AIR 1990 SC 1808, 27 July 1990, 9 native PDF pages. Its company-specific standing order is not a nationwide current statutory notice rule.
- Kenya: official Supreme Court Kenfreight v Nguti, Petition 37 of 2018, 23 July 2019, 21 native PDF pages; actual disposition and paragraphs 41/43 retained.
- Kenya: Ministry/KLMIS Employment Act 2007 PDF, 80 native PDF pages, including actual sections 35 and 36. This ministry copy does not certify later amendments or the current consolidated edition; disclose that limitation.
- US: GovInfo Brown v Board of Education, 347 U.S. 483 (1954), 14 PDF pages, with the merits/remedy distinction. A real premium-model run passed source-grounding checks in about 41 seconds, with current-law/treatment limitations retained.

Final real-source acceptance runs on the same candidate passed sequentially, without provider fallback:

| Public question | Verified-mode completion | Result |
| --- | ---: | --- |
| Exact India employee-discontinuance question | 43.5 seconds | Source-checked Supreme Court passages; no invented nationwide Employment Act or universal notice period |
| Kenya Employment Act / Kenfreight question | 49.7 seconds | Notice/payment-in-lieu, scope qualifications, actual remedial holding and dismissed appeal; source checks passed |
| Historical US Brown question | 44.2 seconds | Official full opinion, native page pinpoints, merits distinguished from the reserved remedy |

All three returned `VERIFIED_WITH_LIMITATIONS`; current-law/subsequent-treatment checks were not represented as complete. Earlier failed/degraded runs were rejected and are not release evidence. The queued India path separately passed in 26.2 seconds with actual retrieval, enrichment, generation, verification, finalization and completion events; the date warning was corrected. That queue timing preceded the final qualification-writing adjustment and is not a guaranteed response-time promise.

Backend: production build and focused regressions pass; the final broad regression run passed 361 suites and 2,265 tests (3 skipped, 2 todo, 4 snapshots). The unchanged bundled India PDF-parser suite passed separately; it is excluded from repeated broad runs because it is expensive. Web: 435 passing tests and production build. Flutter: analysis and 64 tests passing; Android release APK built; app defaults and CI use the canonical `https://api.okaylegal.ai/api/v1` backend. An available emulator was listed by ADB but its package query stalled, so no device-level UI success is claimed.

The premium multi-document public/fictional drafting exercise used both documents, including a nested folder, and completed in 126.3 seconds in the awake rerun (the earlier run took 143.8 seconds) with missing-fact placeholders preserved; it remained for lawyer review. This is not evidence of a sub-minute long-draft turnaround. The signed-in browser journey remains unverified: the earlier in-app browser session was signed out and the Mac was locked during the release smoke check; do not describe API/unit checks as a complete authenticated UI test.

A rejected material claim also withholds potentially paraphrased summaries and conclusions; signature-date and party-submission passages cannot prove a holding. No schema migration has been introduced. Store publication remains deferred.

Release configuration must allow the documented premium synthesis budget (`LEGAL_VERIFIED_SYNTHESIS_TIMEOUT_MS=36000`) while preserving the overall bounded research deadline. Keep the research worker on the same backend release/configuration as the API. Test the asynchronous path with its worker running; API-only local tests cannot consume queued jobs.

The Kenya virtual-asset and historical Muruatetu scenarios above remain additional coverage gates, not claims of completed validation in this source-retrieval release.

## Mounted production catalogue

The Docker services mount `/home/ubuntu/legal_backend/corpus` read-only into the containers; an image rollout alone does not update that host catalogue. On this release the Kenya manifest was atomically synchronized after checking the previous hash, with `sources.manifest.json.pre-cd4374c.bak` retained on the server. The deployed SHA-256 is `0c470db620b587d60b9eef937cdbd6c406fa3fc8a65ba87998ef53c1b45bfbfe` (498 entries). Only the current Kenya retrieval-cache namespace was invalidated; there were no matching stale entries. No tenant data was exported or changed.

Credential-free official-document GET probes from the deployed API container returned actual PDF content with HTTP 200 for the ministry Employment Act, the Indian Supreme Court J.K. Cotton judgment and the GovInfo Brown opinion. These availability checks complement the isolated full-text/citation acceptance tests; they are not signed-in production AI/UI tests. Future catalogue changes must include this mounted-file synchronization and hash check in the release procedure.
