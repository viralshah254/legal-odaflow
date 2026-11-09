# Umbrella — country-aware legal work and unified case workspace

Planning date: 9 November 2026 (Nairobi). Status: proposed implementation plan; application changes and deployment are outside this planning task.

## 1. Product decision

Every legal action must inherit an explicit, persistent legal context. Every case must be a durable home for its facts, parties, evidence, research, provisions, drafts, tasks and history. The interface adapts to country, forum, case type, represented side and procedural stage without making the lawyer repeatedly enter the same information.

Location suggests an initial country; it does not determine applicable law. A Kenyan lawyer travelling to the US must continue working on a Kenyan matter under Kenyan law. A US matter may require state, federal and court-specific context. Cross-border matters need multiple explicitly scoped legal questions, not a single blended jurisdiction.

AI assists with intake, classification, missing information, source discovery, research and drafting. It cannot manufacture country support, authoritative sources, procedural rules or verified legal conclusions.

## 2. Repository evidence and boundaries

This is a targeted source review, not a live usability or production coverage audit. Existing uncommitted implementation work was left untouched. Earlier audit findings must be rechecked against that ongoing work before being treated as still-open defects.

| Inspected foundation | Observation | Plan implication |
|---|---|---|
| `legal_web/components/section-finder/section-finder-workspace.tsx` | Country selection accepts IN/US/GB/KE and coerces other detected countries to IN; it already carries a URL matter ID | Replace hardcoded selection and silent fallback; validate context on the server |
| `legal_web/lib/contexts/country-context.tsx` | Profile/tenant/IP resolution and mismatch handling exist; workspace fallback is IN | Reuse detection but separate suggested location from confirmed legal context |
| `legal_web/lib/hooks/use-research-countries.ts` and `legal_backend/src/config/countries.ts` | Shared country configuration and subdivisions exist | Extend configuration into versioned feature capabilities; avoid another disconnected country list |
| `legal_backend/src/ai/legal-research/research-capability.service.ts` | Named connector branches for IN/US/KE/GB plus configured corpus and web capabilities | Establish per-feature, per-jurisdiction readiness; a configured connector is not proof of sufficient coverage |
| `legal_backend/src/legal-sources/connectors/tavily-search.connector.ts` | Contains a UG source-domain entry | Uganda is not necessarily starting from zero, but that entry does not establish end-to-end support |
| `legal_backend/prisma/schema.prisma` | Matter has country, jurisdiction, practice area, type, stage and many existing artifact relations; MatterPlaybook exists | Extend these entities rather than introducing a second case system |
| `legal_backend/src/ai/legal-research/matter-research-context.service.ts` | Authorized matter document/research selection and capped context assembly exist | Reuse access checks; add canonical legal-context and source-version contracts |
| `legal_web/app/app/matters/[matterId]/workspace/page.tsx` and `work/page.tsx` | Document/research workspace and work hub already exist | Consolidate navigation around existing capabilities instead of rebuilding them independently |
| `docs/adr/ADR-002-canonical-research-workspace-and-filing.md` | ResearchWorkspace is durable session; AIOutput revisions and SavedResearch filing snapshots have separate purposes | Preserve that model; autosaving work must not silently file it |

Companion: `docs/UMBRELLA_ACCURACY_AND_LAWYER_OS_PLAN.md`. This plan adds country resolution, adaptive case UI and connected journeys; it does not replace accuracy, representation, deadline or access-control work in that plan.

## 3. One legal-context contract

Create a server-owned, versioned `LegalWorkContext` reused by research, Section Finder, drafting, case analysis, deadlines, document review, background workflows, mobile and Office integrations.

Required identity: authenticated tenant and user, optional matter ID, context version and resolution source. Legal scope: country, subdivision(s), legal system, forum/court ID, governing law where relevant, practice area, matter type/subtype, stage, represented party and procedural capacity, incident/relevant dates, research as-of date, output language and capability-pack version. Input scope: selected document/version IDs, research revision IDs and provision/version IDs. Unknown values remain unknown.

Resolution rules:

1. Attached work inherits the authorized matter context. A different jurisdiction requires an explicit comparative/foreign-law task scope or a deliberate matter update.
2. Standalone work uses the explicitly selected task jurisdiction, then the user's confirmed working preference, then the firm's configured default.
3. IP/device locale only suggests a country when onboarding or resolving an unknown preference. Ask once before jurisdiction-dependent generation; do not repeatedly interrupt established work.
4. Never fall back to India or any other country's law for an unsupported/unknown country. Keep document organization and neutral work available; explain the precise missing capability.
5. Matter changes create a context revision. Earlier outputs retain their original scope; mark dependent work as needing reassessment instead of rewriting it.
6. Case jurisdiction, interface language, billing currency, physical location and data hosting are separate settings. Changing one must not silently change the others.

Server enforcement: validate country/subdivision/forum combinations, matter ACLs and all selected artifacts before retrieval or queuing. Return the resolved context with each response. Persist a snapshot on queued jobs and output revisions. Cache identity includes tenant/access scope, legal context version, dates, input versions, capability/source versions and task purpose. A cache hit must still pass current access checks.

## 4. Country capability packs

Extend existing config with versioned packs containing legal systems/subdivisions, court hierarchy, source connectors and provenance, statute versions, citation conventions, document templates, terminology, practice-area playbooks and validated procedural rules. UI labels and supported languages are separate from legal coverage.

Capabilities are tracked individually: research, statutory lookup, case-law retrieval, treatment verification, drafting by document type, deadline calculation and court-form support. States: available, limited, unavailable. Display short, actionable explanations at the affected action; never imply all features work because a country is selectable.

Initial delivery: validate IN/US/KE flows and add UG as an explicit end-to-end rollout target; preserve GB behavior. For US work, ask for state/federal/forum context when the task depends on it, rather than treating FED as a universal default. Other countries use the same registry and source onboarding process, with measured coverage before features become available.

Country onboarding checklist: verify primary publishers and access/licensing, load law/version metadata, map courts and terminology, validate sample research and draft types with local practitioners, run historical/current-law and negative fixtures, enable features by cohort, monitor freshness and source outages. Do not ship generated procedural rules without this validation.

## 5. Proposed interface

Persistent matter header: case title and number; country/subdivision/forum; case type and stage; represented side; saved/sync state. A compact context bar remains visible in research and drafting. Country changes are local to standalone work unless the user explicitly updates the case.

| Case navigation | Contents and principal actions |
|---|---|
| Overview | Confirmed facts, missing essentials, next actions, upcoming events, recent work; Resume last work |
| Parties & facts | Client representation, procedural roles, sourced chronology, disputed/confirmed facts |
| Documents & evidence | Uploads, OCR status, folders, tags, versions, exhibits and page-linked facts; Research selection / Draft from selection |
| Research & authorities | Persistent sessions, filed memos, pinned provisions, cases and source passages; Continue / Use in draft |
| Drafts | In-progress and completed drafts, versions, linked sources, review status; Resume / Compare / Export |
| Tasks & hearings | Assigned work, events and approved deadlines; dependencies and completion state |
| Activity | Who changed what, when, context changes and artifact lineage |

Reuse `MatterWorkspaceShell`; retain deep links and redirects from existing work/workspace/draft routes. Billing, meetings and specialist tools remain discoverable in contextual secondary navigation. Avoid placing every specialist capability in the main tab row.

Desktop: navigation/sidebar, main work area, collapsible context/sources inspector. Small screens: one work area, compact header and context drawer; no essential action requires hover. Keyboard support, clear focus, accessible labels and visible error recovery are acceptance requirements. Use progressive loading, paginated lists and on-demand document previews for older devices.

Empty states offer relevant actions: a new criminal case suggests confirming represented side and adding case papers; an empty research tab offers research using the current case context. Show concrete missing fields rather than generic failure banners.

## 6. Case-type adaptive workflows

Use versioned playbook schemas keyed by country + forum + matter type/subtype + stage + represented side. Schemas describe intake fields, labels, sections, suggested documents, actions and rule dependencies. Do not scatter country/type conditionals throughout React and Flutter. Allow an Other/custom type and manual correction without losing data.

The following are illustrative UI groupings, not certified legal procedures or mandatory forms:

| Type | Relevant information | Contextual workspace/actions |
|---|---|---|
| Criminal | Charges/allegations, accused/prosecution/complainant role, custody/bail information, incident dates, witnesses, exhibits | Charge/provision panel, evidence chronology, hearing preparation, appropriate application drafts |
| Civil/commercial dispute | Claim/defence, parties, relief, disputed facts, value, service events | Pleadings, issue/evidence map, applications and settlement work |
| Family | Relationship, children where relevant, orders, relief and sensitive evidence | Restricted sensitive records, relevant applications, hearing preparation |
| Employment | Employee/employer role, contract, employment events, disputed payments | Chronology, correspondence, claim/response and remedy research |
| Property | Property identity, parties, title/tenancy documents and dispute/transaction type | Document/title checklist, issue research, transaction or dispute drafts |
| Transaction/advisory | Parties, governing law, obligations, milestones and negotiated positions | Clause review, agreement versions, advice and execution checklist |
| Appeal/review | Original decision and court, grounds, appellate forum and changed procedural roles | Record/index, ground-to-authority links and appeal drafts |

AI proposes classification and extracts candidate facts with page references. Lawyer confirmation establishes critical facts, represented side and forum. Facts remain labelled alleged, disputed, confirmed or inferred. Changing a type/stage updates visible suggestions while retaining all earlier artifacts and role history. Deadline suggestions require validated rules, evidenced trigger dates and exceptions; matter creation date is never the legal trigger.

## 7. Connected end-to-end journeys

### Case → documents → research → draft → return

1. Create case: choose/confirm country, necessary subdivision/forum, type, represented party and stage. Save a useful minimal case even if noncritical details are missing.
2. Upload papers: persist originals, process OCR asynchronously, show progress and retry. Extract candidate parties/facts with page provenance; request confirmation only for consequential ambiguity.
3. Start research from the case or selected text: automatically inherit case context; show selected inputs and let the lawyer narrow them. Save the session and every completed answer revision server-side.
4. Resolve provisions through Section Finder using the same context and relevant dates. Pin exact provision/subsection/version/source; crosswalks never silently replace historical law.
5. Select Use in draft: carry matter, representation, facts, selected research revision and authority pins into the existing drafting pipeline. Ask only for document-specific missing essentials.
6. Draft in the case workspace: autosave edits and versions; show sources beside relevant passages; keep AI suggestions distinguishable from approved text. Style learning from the lawyer's uploaded examples must not override jurisdictional requirements or import another client's facts.
7. Review/export: preserve editable working drafts and separate review/export/filing states. Export references the exact saved draft version. Court filing or sending is a separate explicit action.
8. Return later or on another device: open the case, resume the latest work, retrieve earlier research/draft versions and follow the source links back to documents and provisions.

### Standalone work → case

Standalone research and drafting remain first-class workflows. An Attach to case action checks permissions and jurisdiction compatibility, preserves original context and provenance, and handles client/matter reassignment deliberately. Linking does not regenerate or silently alter content. Already filed records are immutable snapshots; amendments create new versions.

### Finding everything again

Case search spans authorized document text, research, drafts, notes and authorities. Filter by artifact type, date, author, stage and status. Results show case, location, version, matching passage and an open/resume action. Global search retains case boundaries and permissions; search snippets must not reveal inaccessible content. Add recent cases, recent work and bookmarks. Browser back restores filters, selected document and editing location where practical.

## 8. Persistence and API plan

Keep Matter, Document, ResearchWorkspace, AIOutput and SavedResearch as canonical entities. Add relations/version fields where missing; avoid using a JSON-only index as the source of truth.

- Versioned legal context and representation history; versioned playbook assignment on a matter.
- Artifact lineage linking a draft version to research output versions, provision pins and source document versions. Keep working attachment separate from immutable filing.
- Matter activity events and per-user resume pointers; aggregate existing entities for the workspace rather than duplicating artifact bodies.
- Idempotent job creation and completion, optimistic concurrency for edits, atomic output/link persistence or transactional outbox reconciliation. A completed result must not become an orphan after a connection failure.
- Explicit job states: queued, running, awaiting_input, completed, failed, cancelled. Reopening a page reconnects to the same job rather than charging/running again.
- Access revocation applies to search, exports, attachments, background jobs and later reads. Deletion/retention processes remove derived searchable content consistently while preserving required audit metadata.

Proposed contracts (adapt route naming to existing modules): resolve legal context; retrieve feature capability matrix; retrieve applicable playbook; list paginated matter artifacts; attach an existing artifact; get/save resume state. Extend current research/draft commands with context and versioned selections rather than adding parallel generation endpoints. Validate both API requests and queue payloads.

## 9. Delivery sequence and ownership

| Phase | Deliverable | Main code areas | Exit condition |
|---|---|---|---|
| 0 — baseline | Inventory every web/mobile/add-in/agent entry point, current flags and supported-country behavior; record representative journeys | Existing audit/progress docs, route map and tests | Each entry point mapped to resolver, pipeline, storage and owner; ongoing fixes reconciled |
| 1 — context | Shared context resolver, capability registry, remove silent fallback, matter-context validation | Backend config/DTOs/jobs; web country context; Flutter country handling | IN/US/KE/UG/GB/unknown-country fixtures; no cross-country fallback |
| 2 — case shell | Persistent header, adaptive intake/playbook, clear representation, navigation consolidation | Matters service/schema, MatterWorkspaceShell, intake, mobile matter screens | Case type/side/stage changes preserve data; existing links still resolve |
| 3 — continuity | Case research/draft/document links, autosave, durable jobs, attach-to-case, resume and search | ResearchWorkspace, SavedResearch, documents, drafting session, work hub | Complete journey survives refresh, reconnect and device change |
| 4 — legal packs | Validate country sources, provision versions, document templates and date rules; UG end-to-end capability rollout | Legal sources, capability service, Section Finder, drafting adapters/playbooks | Feature-specific country benchmarks pass; limited capabilities clearly scoped |
| 5 — release | Cross-client parity, permission tests, low-memory/performance checks, migration and staged rollout | Web E2E, Flutter tests, add-ins, telemetry and feature flags | Release gates below pass with rollback rehearsal |

Do phases 0–1 before broad UI redesign. Prototype phase 2 against resolved context. Phase 4 source inventory can start during phase 0, but country feature activation waits for its own evidence. Assign backend/platform, web, mobile/integrations and jurisdiction-review owners before execution. Estimate duration after phase 0; source readiness and migration complexity are currently unmeasured.

## 10. Migration and rollout

Add nullable/versioned fields first and keep old readers compatible. Backfill only explicit existing country/type data; ambiguous values go into a review queue, never an inferred default. Run dry-run counts and sampled comparisons. Existing saved output keeps its original jurisdiction and content. New context snapshots apply to new work; historical records without sufficient metadata are labelled accordingly.

Roll out context resolution, adaptive shell, artifact continuity and country packs under independent server-side flags. Start with internal matters, then a selected tenant cohort. Maintain old deep links through adapters. Rollback disables new creation paths but preserves all new records and their read/export access. Do not drop schema fields until migration and rollback windows close.

## 11. Release gates

1. Country isolation: IN, US with state/federal distinctions, KE, UG, GB, unsupported and unknown-country cases across research, Section Finder, drafting and review. Selected-country law is used or a precise missing capability is returned; another country is never substituted.
2. Travel/cross-border: IP changes cannot alter an existing case. Comparative research records separate jurisdictions and labels foreign authority.
3. Role/type correctness: criminal defence and prosecution/complainant scenarios differ appropriately; civil claimant/respondent and appeal-role changes retain facts/history. Unknown representation blocks side-specific advocacy while allowing neutral work.
4. Continuity: upload → research → provision pin → draft → edit → reload → reopen on mobile → locate/export exact version. Earlier filings remain unchanged after follow-up research.
5. Isolation: unauthorized tenant, restricted matter, revoked access and mismatched document IDs cannot disclose artifacts or enter job context; search and exports obey the same rules.
6. Recovery: interrupted OCR, model/source timeout, duplicate request, stale tab, concurrent edits and job retry preserve work and do not double charge. Source changes invalidate affected caches appropriately.
7. Legal evidence: wrong-country citations, unavailable sources, repealed/historical law and unsupported forms cannot appear as verified current local law. Local practitioners review benchmark cases; no claim of universal legal accuracy.
8. UI quality: accessible keyboard flows, mobile reflow, lazy document loading, paginated activity/search and no forced full-document download merely to open a case. Establish measured load/generation budgets in phase 0 and enforce regression budgets thereafter.

Operational metrics: context mismatch rate, country fallback attempts, source retrieval failures by capability, artifact-link failures, save/recovery failures, duplicate jobs/charges, case resume success, latency and correction rates. Use IDs/counts/timings; do not log privileged case text in analytics.

## 12. Definition of done

A lawyer can create a case in a supported jurisdiction, see the appropriate case-type workflow, add documents, research local law, select provisions, draft for the correct represented side, save and review versions, leave, return and find the entire chain of work. All entry points use the same legal context and access rules. Countries with incomplete capabilities remain explicit and usable within their supported scope. Country, case type or navigation changes never silently lose work or change the law applied to existing artifacts.
