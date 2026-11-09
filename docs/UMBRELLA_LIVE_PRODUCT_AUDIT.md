# Umbrella live product audit

Date: 9 November 2026 (Nairobi)
Environment: https://umbrella.okaylegal.ai
Status: public flow and authenticated lawyer journeys tested. Research output was blocked by a credit/entitlement error; draft generation failed on a missing template. No production-readiness certification.

## Scope actually exercised

- Opened `/app/home` in Brave: redirected to `/auth?redirect=%2Fapp%2Fhome` and showed Google, Apple, and email sign-in. This is expected access control, not a product defect.
- Inspected `/for-lawyers`, followed its Legal Research footer link to `/legal-ai`, then followed the free issue-checker link.
- Submitted one explicitly synthetic employer-side Kenyan employment query in `/legal-issue-checker` and inspected the returned analysis, accessibility tree, screenshot, and selected rendered DOM.
- Inspected `/demo` and switched the product tour to Lawyer matter hub. This is explicitly sample data, not evidence that authenticated workflows work.

No client messages, payments, invoices, account creation, or actual legal records were submitted. The synthetic analysis request was processed by the live product. No production security probing was performed.

## Reproduction input

Country: Kenya. County left optional/unselected.

> Synthetic product audit only: A Kenyan employee says they were dismissed without a hearing. I represent the employer. What information is missing before researching the applicable law? Do not invent facts or cases.

## Observed results

### LIVE-01 — High: confidence and outcome figures are insufficiently explained

The returned title was **Dismissal Without Hearing – Employer Information Gaps**. The Matter intelligence panel displayed **Confidence 70 percent**. Below it the result displayed **Estimated outcome strength 20–70% (mid: 45%)**, with an illustrative/not-a-legal-prediction caveat.

The analysis itself stated **No specific authorities were retrieved for this query** and said no cases or statutory provisions were cited as verified authority.

The query asked for missing information, supplied almost no facts, and identified the employer as the represented side. The UI did not explain whether the confidence score measured classification, factual support, or legal accuracy; nor did the outcome range identify clearly whose outcome or what outcome was being estimated. The caveat helps but does not resolve the unsupported impression of precision.

Fix: label classification confidence as classification, if retained. Replace outcome percentages with **insufficient information to assess** when material facts or source support are missing. Separate retrieval status, fact completeness, legal support, and human review. Do not imply this observation proves the numerical formula is wrong; its calculation was not inspected during this live test.

Acceptance: this exact sparse input produces no implied legal-success probability; the source gap appears before legal conclusions; any retained percentage has a precise, defensible meaning.

### LIVE-02 — Medium: analysis preview collapses structured content into one heading

The accessibility tree exposed the long educational preview as one heading. Read-only inspection of that rendered element confirmed `tag: H1`, containing the title, limitation, prose, raw `## Why information gaps matter here`, raw `## Key information missing`, and numbered-list text in a single element.

Fix: preserve Markdown line breaks and block structure through preview truncation; render the title, limitation, paragraphs, subheadings, and list items as distinct semantic elements. Truncate safely at block boundaries.

Acceptance: the same answer has one short title, readable paragraphs, actual secondary headings and list items; no literal Markdown heading tokens leak into prose; screen-reader heading navigation works.

### LIVE-03 — Medium: summary findings outrun the stated evidence limits

The key-findings area presented categorical legal statements, including a broad statement about probationary and casual staff, while the detailed analysis disclosed that no authorities were retrieved. This audit does not certify or refute that legal proposition; no authoritative-law adjudication was performed in this test.

Fix: carry the source limitation into the summary, not only the detailed body. Avoid categorical scope claims without supporting sources and applicable facts. Allow an information-gap answer to remain an information-gap answer.

Acceptance: summaries cannot imply stronger verification or broader legal scope than the underlying result.

### LIVE-04 — Medium: public promises need alignment with observable limitations

`/legal-ai` says every analysis links to statutes/case law users can check. The observed public preview explicitly had no retrieved authorities. The page also markets operation in every country, although other text distinguishes deep corpora from guidance elsewhere.

Fix: consistently explain that source-backed answers depend on jurisdiction, corpus availability, and the question; show a clear unsupported/research-incomplete state rather than an unconditional citation promise.

### LIVE-05 — Low: product discovery and jurisdiction defaults are inconsistent

On the lawyer landing page, both footer **Legal Research** and **Drafting** point to `/legal-ai`, rather than distinct task entry points. This is not a broken link, but adds navigation before the intended tool.

In the same in-app browser session, issue checker defaulted to Kenya while the demo booking form defaulted to India. A demo form is not a legal analysis, but inconsistent defaults weaken confidence in jurisdiction continuity. No demo form was submitted.

Fix: distinct capability links and explicit, consistent country defaults; never silently use a marketing-form default as matter jurisdiction.

## Positive observations

- The test respected the explicitly stated employer side in the title and educational preview. This single result does not establish role consistency across drafting or saved matters.
- The analysis disclosed missing sources instead of claiming verified cases.
- Missing-information categories included employee status, contract/policy terms, and procedural records.
- The demo clearly identifies itself as sample data, avoiding confusion with a working live matter.
- The protected home route correctly requested authentication.

## Initial authenticated audit checklist (before sign-in)

The following was the initial checklist. Execution results and remaining limitations are recorded in the authenticated follow-up below:

| Workflow | Planned live check |
|---|---|
| Lawyer home and reminders | Overdue work, hearing/deadline visibility, action ownership, failed-job visibility |
| Client/matter creation | Required fields, represented party/capacity, jurisdiction, conflicts, validation, persistence |
| Research | Exact authority lookup, nonexistent citation handling, source opening, claim support, side reversal |
| Section finder | Exact act/section, invalid provision, historical/current distinctions, pinning |
| Drafting | Same facts on opposing sides, unsupported facts, missing inputs, citation integrity, editing/export |
| Billing | Time approval, invoice draft, currency/rates, duplicate submissions, allocation visibility; no payment execution |
| Automation | Suggestions versus completed actions, genuine verification, approval waits, failure/retry visibility |

Use clearly labelled synthetic records and preserve them for review unless the user authorizes removal. Coverage below distinguishes successful actions, failures, and untested behavior.

## Authenticated follow-up — 9 November 2026, approximately 01:54–02:02 Nairobi

Signed in as the user's Partner (Admin) account. The firm profile defaults to India; the browser location was Kenya. Initial displayed AI balance: 9 credits. No plan upgrade, credit purchase, automation installation, payment, or correspondence was performed.

### Records created and retained

- Client: **AUDIT ONLY — Synthetic Employer Ltd**, ID `cmw8fmj7e0450lr01mo9pirbb`; no email or phone supplied.
- Matter: **AUDIT ONLY — Synthetic employer dismissal — 2026-11-09**, ID `cmw8fn79s045klr01ds08p5uv`.
- Matter URL: https://umbrella.okaylegal.ai/app/matters/cmw8fn79s045klr01ds08p5uv?hub=1
- Country India; initial practice area Litigation & Disputes; matter type Litigation. These defaults were retained deliberately. The narrative explicitly described an employer/respondent employment dispute, to test adaptation from narrative and client side.
- Opponent: **AUDIT ONLY — Synthetic Employee**.
- Facts explicitly stated that dismissal was an allegation, disputed rather than admitted, and that dates, contract, dismissal letter and hearing records were absent.
- Conflict check returned Clear / No conflicts detected. Matter saved and was verified again after leaving and returning.
- A failed draft-generation attempt and a blocked verified-research attempt occurred. Displayed balance remained 9; backend credit-ledger effects were not independently audited.

### LIVE-06 — High: floating Copilot intercepts the matter Continue button

At the narrow in-app-browser viewport (approximately 900 pixels wide), the floating bottom-right AI Copilot button physically overlapped Continue. Clicking Continue twice opened Copilot rather than advancing. A screenshot confirmed the overlap. Closing Copilot and activating Continue with keyboard Enter advanced correctly.

Fix: reserve space for floating widgets, reposition them above form actions, and test bottom-right buttons at narrow desktop/tablet widths. Acceptance: pointer and keyboard both advance the same step without opening Copilot.

### LIVE-07 — High: false drafting completeness and signing readiness

Opening the new matter's Draft tab showed **17/17 answered**, **100%**, and **All required details captured — ready to finalise and sign**. No draft had been generated and the supplied facts explicitly listed missing material information. The matter questionnaire still showed **0 of 4 answered** on the overview.

Fix: calculate completeness from validated required values for the selected document and side, not field existence or a default count. Never announce signing readiness before generation, validation and review.

### LIVE-08 — High: matter-linked generation fails on missing template

Clicking Generate draft returned:

> No template found for document kind "wrongful_termination_petition" in IN. Please provision templates in Settings.

The workflow selected a petition kind although the narrative expressly said employer/respondent. This is a routing concern; no draft was produced, so actual wrong-side prose was not demonstrated.

Fix: select document type using confirmed representation and procedural posture; validate template availability before presenting generation readiness; offer supported alternatives without asking ordinary lawyers to provision internal templates.

### LIVE-09 — High: credit failure contradicts the displayed balance and requirement

Verified research was submitted for the deliberately fabricated citation `Audit Placeholder Industries v Imaginary Employee, (2099) 999 SCC 999`, asking for identity verification and no invented details.

The UI automatically refined the prompt, inferred **Case survey** (up to three judgments), and started research. It then displayed **You're out of AI credits**, **9 credits remaining**, and **1 credits needed**, offering top-up/upgrade. No research result was returned.

Fix: distinguish insufficient funds, reservation conflicts, plan restrictions, provider errors, and stale balances. Show the server-authoritative reason and amount. Citation-identity requests should not default to a broad case survey. This audit cannot say whether the backend balance or frontend error mapping is responsible.

Acceptance: 9 available credits cannot be described as insufficient for a displayed 1-credit task; error classification must be truthful. Re-run the fabricated-citation test after this blocker is fixed.

### LIVE-10 — High: inconsistent matter risk/evidence state

On initial creation and revisit, overview showed **Active Low Risk**, **Updated Invalid Date**, and **No items identified** for risks, next actions and evidence gaps. On revisit a separate Matter intelligence panel identified missing **Termination Letter** and **Employment Records**, recommended obtaining the letter, and showed 70% confidence.

Fix: use explicit not-assessed/pending/failed states; render dates only when valid; derive all summaries from the same versioned analysis. An empty or failed analysis must not imply low risk or no gaps.

### LIVE-11 — Medium: unrelated content in a “Verified crosswalk” result

The built-in IPC §420 example returned IPC §420 → BNS §318(4), with “Verified crosswalk” and “Law current through 30 June 2026.” Within the expanded result it also displayed:

> Detailed fee tables are in Schedule I of this Act — consult India Code for the full schedule.

This fee-table instruction is contextually unrelated to the displayed cheating-offence lookup. Do not use this audit as legal certification of the rest of the crosswalk or bail/forum details.

The suggestion list also contained two near-identical IPC §420 entries differing only in punctuation. The deliberately invalid `BNSS 999999` returned only **Section lookup failed**, rather than a useful invalid-provision explanation. No fabricated provision was displayed for that query.

Fix: isolate act-specific template content; deduplicate canonical provisions; distinguish validation, corpus gaps and connector failure; make source/version verification inspectable per result.

### LIVE-12 — High: Tasks navigation does not expose a task queue

Clicking Tasks led to `/app/matters?workView=tasks`, displaying the standard Matters list/kanban and the synthetic matter card. No task queue, due dates, overdue filter, or task creation controls appeared in the inspected state.

Fix: implement the requested work view or route to a real task queue. Acceptance: Tasks immediately exposes assigned/overdue/upcoming work and links back to the relevant matter.

### LIVE-13 — Medium: automation expectations are not matched by visible setup/run state

The new matter says autonomy analysis will run automatically after creation/uploads, but Similar Cases, Opponent Analysis and Strategy Memos remained **Not yet run** on revisit several minutes later. The Automations page showed **No automations yet**, with recipes available to install. Copilot separately said it requires Professional or Solo.

This establishes confusing availability/status messaging, not proof that all automatic processing is broken: the Matter intelligence panel did populate later, and these may be separate systems.

Fix: distinguish plan-disabled, setup-required, queued, running, completed and failed. State which engine powers each action. Surface a run ID/error/next action rather than promising unconditional execution.

### LIVE-14 — Medium: invoice entry does not display currency

Opened New Invoice and selected the synthetic matter. The correct client populated. The form offered Amount, Status, Billing model and Due Date, but no visible currency label or selector before submission. Hourly billing appeared as a single manually entered amount, without visible time-entry calculation on this form. Pre-bill is a separate available path and was not exercised.

Fix: always show currency, tax treatment, and basis of calculation; offer approved-time selection where appropriate. No invoice was created, sent, paid, or marked paid. Concurrency/ledger integrity remain untested live.

### LIVE-15 — Low/Medium: onboarding and localisation polish impair usability

- Repeated page tours interrupted navigation; research jurisdiction confirmation and a tour appeared stacked.
- Raw keys appeared: `matters.recent_activity`, `matters.answered`, and `TUTORIALS.LABELS.SECTIONFINDER`. Browser console confirmed missing English messages.
- Dashboard showed 0 active matters together with an unexplained upward 12% indicator before creation. Its calculation was not verified.
- Matter country was shown as India from firm settings with no visible country selector in that step; research, by contrast, explicitly offered profile versus location. Make per-matter jurisdiction selection explicit and consistent.

## Execution summary and next repair order

| Journey | Result |
|---|---|
| Sign-in/session | Passed: authenticated workspace accessible |
| Synthetic client + matter | Passed persistence and conflict-check flow, with pointer-overlap workaround |
| Representation capture | Free-text side retained; no dedicated confirmed-side field observed |
| Matter overview | Conflicting analysis state, invalid date, premature Low Risk label |
| Matter drafting | False readiness; generation blocked by missing template |
| Section finder | Built-in lookup returned; unrelated content and duplicate suggestions observed; invalid query error unhelpful |
| Verified research | Blocked by contradictory credit error; legal-output accuracy not assessed |
| Client invoicing | Form inspected and client binding verified; no invoice submission |
| Tasks/reminders | Navigation showed matter list; reminder delivery not tested |
| Autonomy | Setup/status and plan gates inspected; actual autonomous workflow execution not established |

Repair order: (1) false readiness/risk labels and template/side routing; (2) credit/entitlement blocker; (3) overlapping controls and task routing; (4) contaminated section content; (5) consistent analysis/automation states; (6) currency and localisation. Then repeat live citation, draft-quality, export, reminders, and billing lifecycle tests on a suitably enabled test workspace.

Visual evidence of the persisted synthetic matter: [live-matter-2026-11-09.png](audit-evidence/live-matter-2026-11-09.png).

The created client and matter remain labelled AUDIT ONLY for review. No deletion was attempted. Application code and account plan/settings were not changed; onboarding tours were dismissed during navigation.
