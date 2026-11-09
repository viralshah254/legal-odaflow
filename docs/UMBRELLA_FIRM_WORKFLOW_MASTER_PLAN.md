# Umbrella country and firm workflow master plan

Planning date: 9 November 2026, Africa/Nairobi. Status: execution baseline following the user's authorization to finish planning and begin implementation. Commercial prices are the target catalog; production price changes and store publication remain separately controlled release actions.

Umbrella should give a lawyer one continuous place to manage a client relationship, understand a matter, examine evidence, research authorities, prepare drafts, obtain approval and meet obligations. The same matter, permissions, work history and subscription entitlements must follow the user between web, mobile and Office. Automation should prepare and organize work within a firm's policies while keeping consequential actions accountable to an authorized person.

This companion expands [the country and case workflow plan](UMBRELLA_COUNTRY_AND_CASE_WORKFLOW_PLAN.md). It preserves that plan and [the accuracy plan](UMBRELLA_ACCURACY_AND_LAWYER_OS_PLAN.md). Pricing decisions are developed in [the regional subscription strategy](UMBRELLA_REGIONAL_SUBSCRIPTION_STRATEGY.md). The active fixes belong to the other chat; its source files, progress records, deployment work and test fixtures must not be overwritten. Reconcile its final changes before creating implementation tickets or treating any older finding as unresolved.

## Product decisions

1. Matter is the canonical container. Use “Case” in litigation-facing labels where helpful, with the same underlying identity; an advisory or transaction matter need not have a court case number.
2. Resolve country, forum, dates, case type and represented side on the server. Physical location suggests onboarding preferences but cannot change the law governing an existing matter.
3. Make authorized matter knowledge available automatically. Retrieve the relevant evidence across documents and folders, preserve source anchors, and show coverage and exclusions. A model context window is not the matter database.
4. Keep roles, content permissions, information barriers and approval powers distinct. An administrator's ability to manage accounts is not blanket permission to read client material.
5. Save work continuously. Attaching research or a draft to a matter must not require copying text or regenerating it, and reopening a job must not trigger another charge.
6. Separate matter memory, firm precedents, public law and optional product improvement. Confidential work does not become a global training set by default.
7. Make mobile a full professional work surface. Prioritize parity for important journeys rather than reproducing every desktop layout.
8. Price the professional product regionally, with predictable subscriptions and measured AI usage. Apply store economics to purchase prices rather than charging extra credits for the same task on a phone.

## Existing foundations and planning implications

The repository already contains matter entities, parties, facts, folders, document review, research workspaces, saved research, drafting sessions, playbooks, access management, calendar events, task-calendar synchronization, automation workers, notification delivery, training consent and mobile professional screens. Extend these systems through shared contracts rather than introducing a second CRM or another independent research engine.

| Source area | Current foundation or gap | Planned treatment |
|---|---|---|
| `legal_backend/src/ai/legal-research/matter-research-context.service.ts` | Authorized selected documents and saved research, with 6,000 characters per document and 16,000 total document characters | Preserve authorization helpers; add indexed matter retrieval, folder scope and explicit coverage rather than assuming excerpts cover the whole record |
| `legal_backend/src/access/matter-access.service.ts` | FIRM_ADMIN, PARTNER and PARTNER_ADMIN have a role-based full-access shortcut | Replace unconditional content bypasses with resource policies and information barriers |
| `legal_backend/src/governance/tenant-role-permissions.service.ts` | Configurable role map alongside separate access logic; several defaults allow broad matter/calendar visibility | Unify policy evaluation and separate metadata, content, scheduling, finance and administration permissions |
| `legal_backend/src/access/matter-access-management.service.ts` | Grant, update and revoke matter membership | Add scoped authority to grant, expiration, external collaboration, effective-access preview and complete audit attribution |
| `legal_backend/src/calendar/calendar.service.ts` | Tenant-scoped event CRUD and tenant broadcasts | Evaluate matter/user visibility for reads and delivery; introduce participant scope, timezone semantics and connector contracts |
| `legal_backend/src/tasks/task-calendar-sync.service.ts` | Participants receive deadline events via find-then-create operations | Define uniqueness, atomic synchronization, date-only deadlines and cancellation semantics |
| `legal_backend/src/automations/automation.types.ts` | Five named triggers and three action families | Extend as versioned recipes with explicit permissions, approvals, budgets and replay guarantees |
| `legal_app/lib/app.dart`, `main.dart`, Firebase services | Foreground, background and cold-start push hooks exist | Verify recipient isolation, tenant switching, confidential previews, deep links and delivery recovery |
| `legal_app/lib/core/network/subscriptions_api.dart` and checkout screen | Backend checkout and a hosted payment WebView | Design store-native professional purchases and server entitlements; do not assume hosted checkout is permitted in every storefront |
| `legal_app/lib/core/pricing/local_pricing.dart` | Fixed FX fallbacks, $0.06 credit denomination and older margin assumptions | Replace purchasing fallbacks with the canonical regional/store catalog after pricing approval |
| Training-consent and retention modules | Consent and processing controls exist | Review scope, revocation and derived-data deletion for each processing purpose |

These observations identify planning dependencies, not a complete security audit. Application code is changing in the active fixes chat; capture a fresh baseline at handoff.

## The complete client and matter journey

| Step | User experience | Durable result and automation |
|---|---|---|
| Lead and enquiry | Capture an enquiry, documents, contact details and source; route to an intake owner | Deduplicate contacts; propose follow-up task and conflict screening; retain a restricted intake record |
| Conflict and engagement | Review candidate conflicts, scope, jurisdiction, fees and client authority | Authorized conflict decision; engagement version; client and matter linkage; no automatic clearance based on name matching alone |
| Matter creation | Confirm country, forum if relevant, case type, procedural stage, represented people and objectives | Versioned legal context; team assignment; restricted access by default; appropriate playbook |
| Document intake | Upload multiple files or a folder tree; scan paper on mobile; see per-file progress | Originals, hashes, versions, OCR status, folder membership, malware quarantine and indexing jobs |
| Case understanding | Review a proposed chronology, parties, disputed facts, issues and missing evidence | Source-linked facts with confirmation states; tasks for essential gaps; no conversion of an opponent allegation into a client admission |
| Research | Ask a question from the matter, document selection, provision or chronology | Persistent research session with matter context, selected scope and answer revisions |
| Authorities | Open exact passages, compare similar cases and pin provisions | Versioned authority/provision pins with court, date, treatment, relevance and provenance |
| Draft | Select a suitable document or accept a suggested document type | A saved drafting session using confirmed representation, facts, evidence, selected authorities, jurisdiction pack and permitted style profile |
| Review | Compare revisions, resolve missing facts, add comments and request approval | Review assignment and exact-version approval; substantive changes invalidate earlier approval |
| Export and delivery | Preview an approved version, export or request authorized sending/filing | Immutable export record and source lineage; sending/filing remains a separately authorized action |
| Return | Open the case on another device and choose Resume last work | Restored session, document position, draft revision, job state and context; no duplicate task execution |
| Billing and closure | Review time, expenses and invoices; close with retention instructions | Approved financial records, outstanding obligations, archived read access, legal hold and retention schedule |

Acceptance journey: create a criminal-defence matter, upload a charge document, witness materials and correspondence into separate folders, correct an extracted date, ask a follow-up question, compare supportive and adverse cases, draft an application, obtain supervisor approval, export the approved revision, reopen on mobile and find every source. Repeat for a claimant/respondent civil dispute and a transaction with no court case number.

## Country and representation context

Extend the existing work context with a versioned legal context containing tenant, actor, matter, represented parties, capacity and side, proceeding, objectives, country, subdivisions, forum, governing law, case type, stage, relevant dates, research as-of date, output language and capability-pack version. Persist context snapshots on jobs and output versions.

For matter work, the authorized matter context takes priority. Standalone work uses an explicit task choice, confirmed preference, then firm default; unknown context requires a focused question before jurisdiction-dependent generation. Comparative work has separately labelled legal scopes. The interface language, billing country, device location and governing law are independent values.

Country packs describe support for research, case retrieval, statutory versions, treatment checks, document types, court forms and deadline rules separately. Preserve IN, KE, US and GB capabilities; plan UG explicitly. A selectable country is not proof that all features have adequate primary sources. Unsupported features return a precise limitation and preserve neutral document work without substituting another country's law.

Representation supports multiple clients, joint representation, counsel changes, separate proceedings and historical roles. A person may be a respondent in one proceeding and an appellant in another. Advocacy-specific output requires confirmed side/capacity; neutral summarization can proceed with the uncertainty recorded. Side reversal must change analysis and suggested relief without changing sourced facts or inventing favourable law.

## Matter context across documents and folders

Provide three clear scopes: Entire authorized matter, Selected folders and Selected documents. Entire authorized matter is the default for matter questions, subject to resource permissions and firm processing policy. Users can pin critical documents, exclude irrelevant material and narrow scope for an individual task. Show the scope beside the composer before execution.

The context service should:

1. Resolve current identity, matter membership, document restrictions, information barriers and processing policy before listing or searching artifacts.
2. Maintain an inventory of authorized originals, versions, OCR quality, language, folder path and indexing state. Process quarantined or unreadable files as explicit gaps.
3. Retrieve relevant chunks using lexical and semantic search, exact identifiers, legal entities, dates and document relationships. Traverse folder trees and deduplicate repeated versions without dropping substantive amendments.
4. Assemble a factual chronology and issue/evidence map with page/paragraph anchors. Preserve alleged, disputed, confirmed and inferred status, contradictions and OCR uncertainty.
5. Add authorized research revisions, court orders, pinned law, approved notes, prior drafts and task/event facts when relevant. Distinguish source documents from AI summaries and draft advocacy.
6. Produce a ContextManifest recording authorized scope, scope revision, document versions searched, passages supplied, pinned items, processing gaps, freshness and truncation. Do not report a file as read merely because its metadata was indexed.
7. For “review every document,” use a coverage-tracked batch workflow and report per-document completion. Ordinary question answering can retrieve relevant passages without claiming exhaustive review.
8. Recheck policy before each tool execution, persistence and delivery. Permission changes stop unauthorized continuations and prevent stale cached results or source snippets from being exposed.

The source drawer should show “42 accessible files; 39 indexed; 3 awaiting OCR; 11 source passages used” where those counts are known. It must not reveal the names or number of inaccessible materials to a user without metadata permission. If a material folder is still processing, offer to wait or answer within the completed scope, and record the choice.

Incrementally update indexes and summaries when evidence changes. Preserve the exact context used for prior answers; mark affected work as needing reassessment instead of silently rewriting it. A new version of an important order should trigger a targeted impact review on dependent research, drafts and deadlines.

Uploaded text is untrusted evidence. Instructions embedded inside a PDF, email or precedent cannot authorize sharing, spending, tool use or policy changes. Public search queries must minimize confidential names and facts unless the user explicitly authorizes a task that requires them.

## Research and similar case intelligence

Research should identify the legal issue before searching. Extract candidate provisions, party roles, procedural posture, relief, disputed elements, burden, factual similarities, dates, court hierarchy and doctrinal synonyms. Ask a focused question when missing jurisdiction or posture materially changes the answer. Allow the lawyer to inspect and correct the search concepts.

Use a staged search plan: exact citations and party names; legal keywords and synonyms; semantic issue queries; jurisdiction/forum and time constraints; citation graph expansion; then targeted adverse-authority and treatment queries. Translate concepts where appropriate while preserving the original legal term. Historical questions retain law as of the relevant date; crosswalks cannot silently replace old legislation.

Rank by supported legal relevance, factual analogy, procedural fit, binding/persuasive status, currency and source quality. Use keyword search as one retrieval signal rather than the basis for legal conclusions. Never infer that two cases conflict merely because one has adverse treatment and another appears in the same result list.

Each case card contains:

| Field | Presentation rule |
|---|---|
| Case and identity | Full supported case name, court, jurisdiction, decision date/year, neutral/report citation and authoritative link |
| Issue and posture | The legal question, type of proceeding and stage addressed by the decision |
| Relevant facts | Concise source-backed similarities and material differences from this matter |
| Holding | Faithful paraphrase with pinpoint; direct quotations have quotation marks and exact passage anchors |
| Outcome | What the court actually ordered in this decision, including partial relief, remand or interlocutory disposition; unknown final outcome remains unknown |
| Relevance to our side | Supports, adverse, distinguishable or background, with reasons tied to confirmed representation |
| Authority status | Binding/persuasive assessment for the forum and treatment records with their own sources and checked date |
| Actions | Open judgment, compare, pin, ask a follow-up, add to issue map, use in draft and file research |

Do not label a case a “win” for the client merely because an application succeeded, and do not imply current good-law status without treatment evidence. Unknown fields remain visibly unknown. Retain adverse authorities and the strongest opposing argument. Advocacy controls how Umbrella frames truthful arguments; it does not change facts or suppress binding adverse law.

The answer includes a direct response, authorities, application to the matter, competing arguments, material missing evidence and appropriate next work. Follow-ups inherit the original scope and allow deliberate changes. Verification checks identity, actual passage support, quotation fidelity, jurisdiction, law-in-force and treatment separately; bounded repair is followed by reverification of the final answer and export. A missing essential source should lead to targeted retrieval, a question or withholding the affected proposition.

## Drafting and artifact linking

From any authorized research answer, document folder, provision or matter issue, offer Use in draft. Carry the matter, representation revision, source versions, chosen authorities, research answer revision and question objective. Ask only for document-specific essentials that the matter does not already establish. Suggested document types explain their fit and prerequisites.

Drafts retain country/forum format, correct procedural side, party names/capacities, relief, supporting facts, exhibits and source lineage. Permit at least five readable, distinct lawyer samples for a validated style profile, coordinated with the other chat's current work. Style never overrides legal requirements or imports sample clients, allegations or authorities into a new matter.

Provide Drafting, In review, Changes requested, Approved and Superseded states. Track comments, assignment, redlines and approval history. Structural completeness is not legal readiness. Export DOCX/PDF from a saved revision and verify numbering, page breaks, tables, annexures and signatures for the supported document pack.

Standalone research and drafts have Attach to matter and Create matter actions. Show the destination, current access and context compatibility before linking. Preserve original IDs and revisions. Linking is idempotent; it neither regenerates nor charges for the artifact. Copying into another confidential scope requires an explicit authorized action and records a new lineage relation.

Attaching work does not automatically widen access. Derived outputs retain restrictions from their contributing sources; a user must be entitled to the complete sensitive content they receive. Sharing a sanitized extract requires a separate review and release process. Linked sources that later become inaccessible must not leak through cached summaries or previews. A filed research snapshot remains distinct from autosaved working research, consistent with ADR-002.

## Firm roles and confidentiality

Use one policy engine for web, mobile, APIs, search, background workers, exports, websocket subscriptions and external sharing. Evaluate active tenant membership, action permission, matter/resource scope, explicit restrictions, ethical walls, data classification, time limits and processing purpose. Explicit denials and information barriers override broad role grants.

| Role | Default scope | Typical permissions | Separate approval required |
|---|---|---|---|
| Firm owner or managing partner | Assigned/authorized matters; firm governance metadata | Firm policy, billing and team administration | Restricted content, conflict override and exceptional access follow named governance policy |
| IT administrator | Identity, devices, integrations and operational metadata | Provision accounts, enforce MFA/SSO, manage approved integrations | Client-content access requires a distinct, time-limited grant |
| Matter partner or supervisor | Assigned matters | Strategy, review, team access within delegation and final work approval | Cross-wall sharing, trust transfers or other controlled acts |
| Associate or counsel | Assigned matters and permitted folders | Research, draft, edit, tasks and time recording | Final release where supervision is required |
| Trainee or paralegal | Assigned work and resources | Upload, organize, prepare and research within limits | Legal approval and external release |
| Intake or reception | Intake metadata and permitted scheduling | Leads, appointments and requests | Evidence, legal advice, restricted notes and broad matter searches |
| Finance | Engagement/rate/invoice/time metadata needed for duties | Prebills, receivables and permitted reports | Legal-content access and trust/payment acts outside delegated powers |
| Client or external counsel | Explicitly published resources | View/comment/upload in the shared space | Internal notes, strategy, unrelated matters and onward sharing |
| Knowledge curator | Approved precedent candidates and public sources | Review, tag and publish reusable knowledge | Restricted matter content or global improvement use |
| Support or platform operator | Operational metadata | Diagnose service health | Audited, expiring exceptional content access with tenant authorization where required |

Custom roles combine capabilities; they do not bypass resource checks. Separate view metadata, read content, upload, edit, delete, download/export, use with AI, invite/share, approve, bill and administer. Read-only is an action level rather than permission to see all matters. Provide restricted, named-team and deliberately firm-open matter policies; start new matters with the selected authorized team.

Folder/document inheritance may narrow matter permissions. Moving a folder previews the new effective scope and cannot silently expose its contents. Guest access is specific, expiring and revocable, with identity verification, optional download limits, watermarking and a share audit. No public-by-link confidential workspaces. Client portal AI searches only the resources deliberately published to that client.

The Share panel shows who can access, why they can access, what actions they can take, expiry, pending requests and an effective-access preview. Matter access owners approve requests; legal holds and ethical-wall changes use compliance policy. Invitations cannot be accepted into a different tenant by accident. Bulk grants and removals have previews and audit records.

Revocation removes search/index visibility, future job access, subscriptions to realtime channels, signed download access and app caches. Recheck queued work before delivering. Treat locally exported documents as outside technical recall; the product must not promise to erase a file already downloaded by a recipient.

Baseline safeguards include encryption, MFA, auditable access changes, secure uploads, session expiry, accessible audit history and strict tenant separation for every paid tier. Enterprise expansion adds SSO/SCIM, DMS information-barrier integrations, residency options, customer key arrangements where supported and negotiated operational controls. Never advertise certifications that Umbrella has not obtained.

## Approval and delegation workflows

Approval objects identify the exact artifact version or action payload, matter/context revision, approver eligibility, required sequence, expiry and decision. A change to the approved text, recipient, attachment, amount or material context invalidates the approval. Checking a generic “reviewed” box does not authorize a later changed send or payment.

Provide review queues for drafts/advice, client publication, external messages, deadline confirmation, conflict decisions, knowledge promotion, access exceptions and financial operations. Support sequential and parallel review, delegation to an eligible substitute, comments, rejection, changes requested and escalations. A person with lost matter access cannot continue as approver. Absence of a response never counts as approval.

Routine internal preparation can run under firm policy: organize files, propose tasks, produce a draft, assemble a hearing bundle or flag missing evidence. Client/opponent sending, court filing, material deadline confirmation, privilege-sensitive disclosure and trust/payment actions require the configured explicit authority and exact-action approval. Record conflicts of duty and require separate initiator/approver where financial policy demands it.

## CRM and proactive matter operations

Connect enquiry, conflict review, engagement, client, matter, tasks, time/expenses, prebill, invoice, collections and closure. Each stage has an owner, status, next action, due date and reason for a blocked transition. Support individual and organizational clients, multiple contacts, related matters and deliberately restricted client identity.

| Trigger | Preparation and internal automation | Human control |
|---|---|---|
| New enquiry | Deduplicate, categorize, assign intake and prepare acknowledgement | Conflict clearance and client-facing content follow firm policy |
| Engagement signed | Create authorized matter, team and playbook checklist | Confirm scope, jurisdiction and representation |
| Evidence uploaded | OCR/index, propose facts/issues, detect duplicates and missing items | Confirm consequential facts and dates |
| Case stage changed | Update relevant checklist and propose upcoming work | Confirm court-rule deadlines and external tasks |
| Hearing approaching | Assemble chronology, latest orders, authorities, drafts and evidence gaps | Lawyer checks and approves bundle |
| Research completed | Save answer revision, notify requester and offer issue/draft linkage | Filing, promotion and client release remain distinct |
| Material evidence changed | Identify affected research/drafts and request reassessment | Lawyer resolves substantive changes |
| Matter inactive | Show stale work and prepare follow-up/task proposal | Avoid automated client contact without authorized rules |
| Work approved | Request time capture or prepare prebill from approved entries | Financial approval before invoice dispatch |
| Invoice overdue | Internal alert and proposed collection follow-up | Client reminder under approved cadence, channel and consent |
| Closing requested | Check open obligations, balances, originals and retention | Responsible lawyer authorizes closure |

Automations need a run record, deduplication key, initiating event version, acting identity/service scope, budget, retries, cancellation, dependency states and delivery history. Use a transactional outbox and idempotent effects. A crashed worker must not duplicate a reminder, invoice or draft charge. Prevent trigger loops and escalating fan-out. Each recipe has a dry run, visible owner, pause control and audit trail.

The firm home shows My work, Team work where authorized, Due soon, Overdue, Awaiting approval, Blocked, Recent matters and Resume. Surface actionable changes instead of generating a daily wall of generic AI advice. Internal morning briefs summarize only authorized matters, with links to the actual work and clear ownership.

## Calendars and legal deadlines

Keep hearing appointments, ordinary meetings, task due dates, legal deadlines, reminders and preparation work as related but distinct records. A task due on a date should not automatically reserve a one-hour meeting. Store date-only deadlines separately from timed appointments, preserving court timezone, user timezone and daylight-saving behavior.

Every legal deadline records its source rule/order, version, jurisdiction, trigger event and evidence, calculation method, calendar/holiday set, exceptions, certainty state and confirming lawyer. Missing trigger dates produce a question or candidate deadline, not a date inferred from matter creation. Rule changes and adjournments create an auditable recalculation proposal and update dependent preparation tasks after review.

Provide personal, matter, team and firm calendars constrained by access. For scheduling colleagues without content rights, show authorized free/busy blocks without case titles, client names or privileged notes. External calendar exports default to a neutral title and a protected Umbrella link. Sensitive calendars cannot be shared merely because someone can administer the integration.

Plan Google Calendar and Microsoft 365 adapters behind a common connector interface: explicit OAuth scope, per-user/per-tenant ownership, refresh-token protection, provider event IDs, revision/ETag handling, cancellation, recurrence and exceptions, webhook renewal, incremental sync and full reconciliation. Choose direction per calendar; never silently overwrite a confirmed court deadline with an external edit. Surface sync errors and provide retry/reconnect.

Test all-day events, month-end, leap days, DST, travelling lawyers, court holidays, recurring-event exceptions, adjournments, deleted events, token revocation and concurrent edits. Reconcile one internal deadline with multiple user calendar projections without producing duplicates.

## Reminders alerts and notifications

Build a durable notification center shared by web and app, with unread state, assignment, acknowledgement, escalation and history. Channels include in-app, web push, APNs/FCM and email where configured; SMS/WhatsApp are later opt-in integrations with separate delivery, privacy and cost controls.

Firm templates define suggested reminders such as hearing preparation at seven days and one day, with a final timed reminder appropriate to the event. These are user workflow defaults, not legal deadline rules. Quiet hours apply to routine notifications; urgent exceptions require an explicit recipient policy. Users can snooze ordinary work, while critical confirmed deadlines retain an accountable owner and escalation path.

Push previews use neutral wording by default. Opening an alert authenticates, resolves the right tenant, rechecks matter/resource access and then opens the exact task, event, draft revision or approval. Permission changes can remove stale notifications without leaving confidential titles in the inbox. Reset badges across devices and distinguish unread, acknowledged and completed work.

Delivery records distinguish queued, submitted to channel, provider-accepted, failed, retried and user-acknowledged where measurable. Provider acceptance is not proof that a lawyer saw an alert. Critical work escalates to an authorized backup if acknowledgement is missing; it never silently assumes delivery. Handle duplicate webhooks, missing tokens, disabled OS permissions, offline devices and expired sessions.

## User interface and counts

Use one matter shell with Overview, Documents, Research, Drafts, Tasks and calendar, and Activity. Parties/facts, finance, settings and specialist tools remain contextual secondary destinations. Persistent header: matter title, country/forum, case type, represented side, stage and sync state. Desktop supports navigation, work area and source inspector; mobile uses a focused work area and contextual drawers.

The composer offers Ask about this matter, Research law, Draft a document and Prepare next work. Show matter scope and the active legal context beside it. Questions and follow-ups stay attached to their work session. Empty states offer the next useful action; failure states preserve entered text and saved progress.

Counts should be server-calculated within authorized scope and have stable definitions:

| Counter | Definition and action |
|---|---|
| Documents | Unique accessible documents; separate versions, OCR pending and quarantined items |
| Research | Saved working sessions; separately show filed memos and running jobs |
| Drafts | Working documents, with in-review and approved subsets; versions do not inflate the document count |
| Tasks | Open, overdue and due-soon, with explicit timezone/date boundary |
| Approvals | Eligible pending decisions, grouped by urgency and assigned reviewer |
| Calendar | Upcoming authorized events within the labelled time window |
| Alerts | Unread actionable notifications; acknowledged items and completed tasks remain distinct |
| Evidence gaps | Unresolved confirmed gap records, not an opaque generated risk score |

Every badge opens the filtered list it counts. Paginated lists return totals and a freshness marker; realtime invalidation refreshes them after access and status changes. Unknown/loading counts are not zero. Never leak restricted objects through totals, search facets, autocomplete, recent items or analytics.

Support keyboard navigation, screen readers, visible focus, reduced motion, readable legal citations, selectable text, accessible tables, zoom and narrow screens. Floating assistants must not cover primary actions. Distinguish unsaved edits, local save, server save, indexed material and synced content rather than displaying a single misleading success state.

## Mobile review and delivery plan

The app already contains professional matter, document, research, drafting, CRM, calendar, finance, team, automation and notification screens. Treat it as an integration and usability modernization, not a rewrite by default. Audit actual API use, role checks, country handling and persistence on each route; a screen's existence is not parity evidence.

| Journey | Required mobile behavior |
|---|---|
| Identity | Firm invitation, MFA/SSO where available, personal/firm workspace switch and multiple firm memberships; server-derived role/capabilities |
| Home | My tasks, hearings, approvals, unread alerts, recent work and authorized counts |
| Matter | Same context, parties, stage, scope and artifacts as web; responsive facts and source review |
| Documents | Camera/scan, multiple uploads, folder navigation, OCR progress, text search, page anchors and readable PDF/DOCX views |
| Research | Ask/follow up by text or approved voice input, scope folders/files, stream job status, inspect cases and pin authorities |
| Draft | Start from matter/research, answer missing essentials, edit/autosave, compare important changes, request review and export |
| Approval | Read exact version, source support and changes before deciding; do not approve from a truncated push preview |
| CRM and calendar | Intake, client contacts within rights, tasks, appointments, reminders and time capture |
| Firm operations | Authorized team/access management, budgets, automation status and financial approval workflows |
| Billing | Server-backed entitlement, store-localized purchase, restore/manage subscription and clear personal versus firm payer |

Do not create separate unverified “role logins.” One authenticated identity has memberships and capabilities in the chosen workspace. Deep links and push taps cannot bypass these checks. UI hides irrelevant controls while APIs still enforce all permissions.

Add resumable uploads, incremental loading and pagination for low-bandwidth devices. Offline reading is an explicit firm policy with encrypted, expiring local content and reauthentication; disable for restricted matters where appropriate. Offline edits enter a conflict-aware queue. Require connectivity for final approval, external release, trust actions and purchases. Clear local data on sign-out/tenant switch as policy requires and purge on revocation when the device reconnects; remote deletion cannot be guaranteed while a device remains offline.

Maintain a web/mobile/API parity matrix with feature, endpoint, permissions, offline behavior and acceptance test. Share schemas and canonical catalog/context responses, not separate country and credit mathematics. Run device tests for foreground/background/killed-app alerts, account switching, long documents, keyboard editing, weak network, accessibility and purchase restoration.

## Knowledge bank and controlled learning

| Knowledge boundary | Contents | Who can use it | Promotion rule |
|---|---|---|---|
| Public legal bank | Licensed/official statutes, judgments, versions, treatment and source metadata | Users entitled to the corresponding product/country capability | Source validation, rights and freshness review |
| Private matter memory | Evidence, confirmed facts, issues, research, drafts and decisions | Current authorized matter/resource users | Remains within matter restrictions |
| Firm knowledge library | Approved precedents, playbooks, clause standards and reusable research | Explicit firm/library groups, subject to walls | Responsible reviewer confirms rights, sanitization, currency and permitted audience |
| Personal drafting memory | Style profile and approved preferences | The lawyer, plus explicitly granted firm use | Separate permission for reuse; raw samples stay protected |
| Product improvement and evaluation | Purpose-approved, minimized datasets and non-content quality metrics | Authorized improvement systems | Separate scoped consent, rights review, screening, controlled release and deletion policy |

“Self learning” initially means better retrieval, structured matter memory, lawyer-confirmed corrections, approved preferences and curated firm precedents. It does not mean silently updating shared model weights with client documents. Generated answers and repeated user acceptance cannot establish legal truth; a correction requires source validation or an explicit factual instruction with provenance.

Implement a promotion workflow: nominate, permission/rights check, remove privileged/client-specific details where permitted, detect residual identifiers, expert review, assign jurisdiction/document type/version/expiry, publish to the allowed library and audit. Anonymization alone is not permission to reuse. Privilege, contractual restrictions, source licences and conflicts may prohibit promotion altogether.

Fine-tuning, if later justified, is a separate gated program with dataset lineage, tenant purpose consent, independent evaluations, leakage testing and a model rollback plan. Explain that removing data from an already trained model is not equivalent to deleting a retrieval record; avoid training on data requiring prompt revocation unless a workable deletion strategy exists. Training, evaluation, analytics, style learning and ordinary inference need distinct purpose controls.

Every reusable item tracks owner, origin, revision, source/support, allowed audience, processing purposes and review date. Corrections create versions. Withdrawal removes dependent embeddings/caches and flags affected outputs; retention/legal holds govern preserved originals. Never mix confidential firm precedents into a public index or use another firm's work to answer a question without authorized sharing.

## Architecture and persistence contracts

Retain Matter, Document, ResearchWorkspace, AIOutput, SavedResearch and existing drafting entities. Introduce or extend typed contracts for legal-context revisions, representation, resource policies, artifact lineage, context manifests, approval decisions, notification deliveries, calendar projections, knowledge promotions and billing catalog/entitlements. Map each to the existing schema before adding a new model.

Shared services: policy resolution; legal context/capabilities; matter inventory and retrieval; artifact linking/versioning; verified research/drafting; workflow orchestration; calendar/reminders; notifications; pricing/entitlements. APIs and queue messages carry actor, tenant, matter, request/run identity, context revision, scope and idempotency key. Service accounts cannot acquire more content rights than their delegated task.

Use optimistic concurrency for edits, atomic output/link persistence or a reconciled outbox, and stable job states: queued, running, awaiting input, awaiting approval, completed, failed and cancelled. Resuming a page reconnects to the same run. Context and permission changes are checked at execution and delivery, not only at enqueue time.

Security-sensitive caches include access scope/policy revision as well as country/date/context, source versions, input versions and pipeline versions. A cache hit still requires current authorization. Avoid raw document text in routine logs and external monitoring. Trace runs with protected identifiers and authorized diagnostic access.

## Additional operational requirements

- Conflict checks, identity verification and engagement authority before work is shared with a prospective client; intake confidentiality exists before a paid matter.
- Privilege labels and clawback workflows, redaction with visual verification, sealed/minor-sensitive records and appropriate segregation.
- Malware scanning, content-type validation, safe document conversion, OCR confidence and prompt-injection containment.
- Retention, client file export, legal hold, deletion of derivatives, firm offboarding and emergency continuity access.
- Backups, restoration drills, incident response, data location, subprocessor controls and provider retention/training settings appropriate to each tenant's contract.
- Source outages and stale-law monitoring; preserve work and fail clearly rather than substituting unsupported authorities.
- Budgets per firm, user and matter; cost estimates, cancellation and controlled long-running document review.
- Time and expense capture distinct from AI credits; prebill/invoice/trust authorization and reconciliation remain separate financial systems.
- Integration consent, least-privilege scopes, token revocation, external-sharing boundaries and permission synchronization with future DMS connectors.
- Measured accessibility, app crash-free operation, low-memory performance and readable exported legal documents.

These are product requirements for the implementation and pilot. Jurisdiction-specific retention, professional conduct and financial rules need approved country policies rather than generated assumptions.

## Phases and implementation backlog

The user has authorized implementation after planning review and confirmed that the other chats are complete. Preserve their completed fixes. Reconcile the recorded local baseline, then execute the backlog below. Store configuration and production publication remain gated on the catalog, entitlements, sandbox tests and release evidence rather than a blanket assertion that the entire platform is ready.

| Phase | Deliverables | Dependencies and exit gate |
|---|---|---|
| 0 | Reconcile active fixes; inventory routes, permissions, artifacts, mobile parity and pricing sources | Record one baseline and owner per subsystem; no overlapping edits |
| 1 | Approve regional subscriptions, credit rules, store economics and migration treatment | Pricing strategy decisions signed off; no changes to live prices yet |
| 2 | Unified policy and legal/representation context; remove country fallback | Cross-tenant, ethical-wall, role/side and country tests pass across entry points |
| 3 | Document inventory, folder retrieval, context manifest and artifact linking | Multi-folder questions use authorized evidence; source/version and revocation tests pass |
| 4 | Canonical research, similar-case cards, drafting continuity and exact-version approvals | End-to-end matter journey accepted by lawyers in pilot jurisdictions |
| 5 | CRM recipes, calendar connectors, deadline review and durable notifications | Retry, timezone, acknowledgement, escalation and privacy journeys pass |
| 6 | Mobile professional parity and store-native billing/entitlements | Same jobs/artifacts/access on app and web; sandbox purchase/restore/revoke tests pass |
| 7 | Curated firm knowledge, preference memory and permissioned promotion | No cross-matter/tenant leakage; rights, withdrawal and review workflows verified |
| 8 | Internal pilot, selected firms, production observation and measured expansion | Release gates and rollback rehearsal pass for each enabled capability |

Mobile interface design, source-pack inventory and calendar connector design can overlap after contracts stabilize. Knowledge promotion depends on the policy model; it must not be introduced as a shortcut before confidentiality is established.

| Ticket | Scope | Acceptance evidence |
|---|---|---|
| PLAN-01 | Baseline and parity inventory | Each user journey mapped to current API, pipeline, persistence, access and owner |
| PLAN-02 | Canonical policy model | IT admin, finance, associate, partner and guest negative-access scenarios pass |
| PLAN-03 | Legal context and representation | IN/KE/US/GB/UG/unknown and side reversal fixtures; no travel-driven changes |
| PLAN-04 | Matter inventory and folders | Nested folders, duplicate versions, OCR gaps and permission inheritance handled |
| PLAN-05 | Context manifest and retrieval | Relevant multi-document passages and explicit coverage recorded; access filtering precedes retrieval |
| PLAN-06 | Research and similar-case contract | Real case identity, year, pinpoints, procedural outcome, adverse law and source-specific treatment |
| PLAN-07 | Durable linking and resume | Attach, refresh, reconnect, retry and device switch preserve identity and avoid duplicate charge |
| PLAN-08 | Draft lifecycle and approvals | Exact approved revision exported; edits and changed recipients invalidate approval |
| PLAN-09 | CRM event recipes | Intake-to-close journey with accountable owners, dry run, cancellation and deduplication |
| PLAN-10 | Calendar and deadline model | Date-only/timezone distinction; validated trigger rules; sync conflict and adjournment tests |
| PLAN-11 | Notification center | Privacy-safe push, tenant-aware deep links, acknowledgements and escalations on web/app |
| PLAN-12 | Professional mobile parity | Same authorized matter journey, documents, research, drafts and approvals on devices |
| PLAN-13 | Regional catalog and entitlements | Correct region/store quote, no stale fallback checkout, purchase replay and duplicate-subscription protection |
| PLAN-14 | Governed knowledge library | Reviewed promotion, provenance, stale-law flags, consent purpose and withdrawal tests |
| PLAN-15 | Operations and rollout | Restore drill, source outage, worker crash, access revocation and rollback demonstrations |

## Release acceptance and measurable outcomes

Require complete journeys for solo lawyers, supervised associates, restricted matter teams, finance/reception staff and external guests. Cover criminal defence and opposing capacities, civil disputes and transactions. Test supported country packs independently; a strong result for one country cannot enable another.

Mandatory scenarios include multiple folders and long documents; missing/OCR-corrupted evidence; contradictory facts; adverse authorities; law as of a historical date; a changed represented side; travel; access revoked mid-job; a source document becoming restricted; a moved folder; a duplicate upload; simultaneous edits; approval of an obsolete draft; failed payment; duplicate store event; calendar cancellation; DST; denied push permission; and an offline phone reconnecting after removal from the firm.

Measure task completion, source coverage, unsupported claim rate, lawyer correction time, retrieval recall, time to first useful response, total job latency, approval turnaround, notification acknowledgements, failed deliveries, duplicate effects, actual AI cost, credit accuracy and device stability. Report samples and distributions; do not invent universal accuracy or speed claims.

Initial engineering targets: normal saved-work navigation and badge responses p95 under two seconds on the agreed environment; no lost saved edits on refresh/reconnect; no duplicate effect in replay/crash tests; no unauthorized content or metadata disclosed in the negative test set. Set research/draft latency targets after measuring the deployed provider and real document sets, with separate targets for quick questions and exhaustive review.

Before enabling each stage: compatible additive migrations, explicit handling of ambiguous historical records, access-aware backfill, feature flags, tenant cohort rollout, preserved deep links, reversible routing and no destructive schema cleanup during the rollback window. Historical outputs keep their original context; missing metadata never becomes invented certainty.

## Decisions for the next product review

The default proposal is a restricted/team matter model, private matter memory, separate approval for client release, professional subscription pricing as specified in the companion, and staged IN/KE validation with US/GB and UG capability gates. Decide pilot firms/document types, initial approval delegation, calendar connector order, offline policy and contractual residency needs before estimating implementation dates. Public consumer pricing is a separate audience decision; it should not silently redefine the professional $100 minimum.

## External product references

[Harvey Spaces](https://www.harvey.ai/platform/spaces) describes matter collaboration, resource-level controls, ethical walls and audit trails. [Legora Portal](https://legora.com/product/portal) describes shared-file querying and controlled external collaboration. These support the proposed emphasis on governed shared context; they are vendor product descriptions, not independent verification or a claim that Umbrella already offers equivalent controls.

App-store payment references and fee assumptions are documented alongside the pricing proposal so they can be reviewed before any store configuration.
