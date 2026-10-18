# Competitive Parity Matrix

**Generated:** 2026-05-29  
**Purpose:** Living sign-off checklist for Series A/B competitive positioning vs Clio, Harvey, Smokeball, LegalZoom, and Filevine.  
**Sources:** [legal_web/MEGASPEC-ALIGNMENT.md](legal_web/MEGASPEC-ALIGNMENT.md), Series A Competitive Parity Roadmap (Prompts 1–38), Series B Dominance Roadmap (Prompts 39–50), [QA-MATRIX.md](QA-MATRIX.md), [STUB-KILL-LIST.md](STUB-KILL-LIST.md)

**Legend — OdaFlow Status:** `Shipped` | `Partial` | `Gap` | `Won` (differentiator)  
**Legend — Competitor column:** `Strong` | `Partial` | `Weak` | `N/A` (not their wedge)

---

## Category verdicts (investor questions)

| Feature (verdict) | Clio | Harvey | Smokeball | LegalZoom | Filevine | OdaFlow Status | Series A minimum | Prompt # |
|-------------------|------|--------|-----------|-----------|----------|----------------|------------------|----------|
| **Best practice management?** | Strong | N/A | Strong | Weak | Partial | **Shipped** — billing, trust, DMS, time, portal v2 uploads; env-gated OAuth | Parity+ on billing, trust, DMS, time, portal for IN/US SMB | **3–12**, **15–20**, **50** |
| **Best enterprise legal AI?** | Partial | Strong | Weak | Weak | Partial | **Partial** — gateway, research, copilot, outcome + firm benchmarks; gaps: law library scale, bulk diligence | Parity on research corpus, diligence-scale review, firm RAG; keep outcome governance lead | **26–28**, **32**, **45** |
| **Best consumer legal app?** | Weak | N/A | N/A | Strong | N/A | **Shipped** — issue checker, 15-section report, `/legal-forms` catalog + fill flow | Parity+ on guided flows + AI reports; checkout polish | **24–25** |
| **Best dual-sided AI OS (IN/US SMB)?** | Partial | Weak | Weak | Weak | Partial | **Contender** — consumer → marketplace → matter; gaps: marketplace pay E2E live verify, mobile parity | Definitive yes: marketplace pay, OAuth, mobile lawyer flows | **21–23**, **37**, **38** |
| **Best outcome-governed intelligence?** | Weak | Partial | Weak | N/A | Partial | **Won** — `MatterOutcomeAnalysis`, lawyer approval, portal publish, firm benchmarks, training consent DENIED | Extend firm memory + mobile outcome tab | **26**, **37**, **45** |

---

## MegaSpec modules (product parity rows)

| Feature | Clio | Harvey | Smokeball | LegalZoom | Filevine | OdaFlow Status | Series A minimum | Prompt # |
|---------|------|--------|-----------|-----------|----------|----------------|------------------|----------|
| **Matters (case management)** | Strong | N/A | Strong | Weak | Strong | **Partial** — CRUD, timeline, collaborators, transfer, share | Playbooks, Kanban, conflicts, parties, command palette | **9**, **10** |
| **Time tracking** | Strong | N/A | Strong | N/A | Partial | **Shipped** — timers, rate tables, approvals, retainer warnings | Rate tables, approvals, retainer warnings, billing rules | **3**, **4**, **15** |
| **Expenses & disbursements** | Strong | N/A | Partial | N/A | Partial | **Partial** — expenses + claims workflow | Vendor directory, markup, GL mapping | **5**, **6** (with billing) |
| **Billing & invoicing** | Strong | N/A | Strong | N/A | Partial | **Shipped** — pre-bill, write-downs, LEDES, statements PDF, dunning API | Pre-bill, write-downs, LEDES, statements, dunning | **5**, **6**, **7** |
| **Online payments** | Strong | N/A | Partial | Strong | Partial | **Partial** — Stripe/Razorpay/M-Pesa adapters (mock without keys), portal pay + reconciliation UI | Live keys only in prod; no `*_mock_*` | **7**, **21**, **25** |
| **Trust accounting** | Strong | N/A | Strong | N/A | Partial | **Shipped** — reconciliation statements, no-negative guard | Reconciliation, statements, IOLTA pack, hard no-negative | **8** |
| **DMS** | Strong | Partial | Strong | Weak | Strong | **Partial** — folders, upload, version history, filter search | Version restore, permissions, OCR full-text hybrid search | **11**, **12** |
| **Document automation & forms** | Partial | N/A | Strong | Strong | Partial | **Partial** — merge fields, assembly engine, consumer form catalog | Questionnaires, conditionals | **13**, **14**, **24** |
| **Client intake & growth** | Strong | N/A | Partial | Partial | Strong | **Partial** — clients, KYC checklist, alerts | Pipeline CRM, booking, questionnaires | **22**, **23** |
| **Client portal** | Strong | N/A | Partial | Partial | Partial | **Shipped** — sign-in, progress, doc requests + client upload, pay, messages | Threaded messaging polish, prod hardening | **18**, **38**, **50** |
| **Calendar, scheduling, tasks** | Strong | N/A | Partial | N/A | Partial | **Partial** — calendar events, tasks | Court dates, SLA, dependencies, OAuth calendar sync | **16**, **34** |
| **Court & litigation** | Partial | N/A | Partial | N/A | Strong | **Partial** — court case, hearings, filings, docket; **stubs:** eCourts IN, US docket | Live `ECOURTS_API_URL` + CourtListener; no stub providers in prod | **29**, **30**, **31** |
| **Legal research & law library** | Partial | Strong | Weak | Weak | Partial | **Partial** — research AI, hybrid search, `/app/law-library` browse + ingest status | Curated authorities export; expanded connectors | **27** |
| **Integrations** | Strong | Partial | Partial | N/A | Strong | **Partial** — OAuth authorize, sync logs, manual retry dashboard | Live OAuth callbacks + QuickBooks/DocuSign webhooks | **16**, **17**, **19**, **20**, **47** |
| **Security, compliance, audit** | Strong | Strong | Partial | Partial | Strong | **Partial** — RBAC, alerts, copilot audit, training consent | SSO/SAML/SCIM, comprehensive audit log, ethical walls | **33**, **36** |
| **Support, migration, success** | Strong | N/A | Partial | Partial | Partial | **Partial** — Clio CSV upload UI + BullMQ enqueue; worker in progress | Production import validation; support tiers deferred post-38 | Post-**38**, **49** |
| **Community & content** | Partial | N/A | N/A | Partial | N/A | **Gap** | Deferred post-Series A | — |
| **Automation engine** | Strong | N/A | Partial | N/A | Strong | **Partial** — JSON rules, triggers, SLA breach scheduler | Visual builder, approvals, webhooks | **34**, **35** |
| **AI Copilot 2.0** | Partial | Strong | Weak | Weak | Partial | **Partial** — firm memory paths, morning brief, @agent, unified search | Law library scale; Word add-in; no mock in prod | **26**, **28**, **32**, **43**, **44**, **46** |
| **Marketplace (lawyer network)** | Weak | N/A | N/A | Weak | Partial | **Partial** — profiles, leads API, review requests | Payments E2E live verify, revenue share ledger | **21**, **37** |
| **Consumer platform** | Weak | N/A | N/A | Strong | N/A | **Shipped** — issue checker, `/legal-forms`, generate-draft links | Checkout polish, PostHog funnel | **24**, **25** |
| **Knowledge graph search** | Partial | Strong | Weak | N/A | Partial | **Shipped** — `GET /search/unified` + web entity badges | OpenSearch migration path | **46**, **48** |
| **Outcome benchmarks** | Weak | Partial | Weak | N/A | Partial | **Shipped** — `getFirmOutcomeBenchmarks` + matter vs firm average UI | Firm-wide analytics dashboard | **45** |

---

## Wave execution rows (Prompts 1–38)

| Feature | Clio | Harvey | Smokeball | LegalZoom | Filevine | OdaFlow Status | Series A minimum | Prompt # |
|---------|------|--------|-----------|-----------|----------|----------------|------------------|----------|
| Stub & mock inventory | — | — | — | — | — | **Shipped** (this audit wave) | `STUB-KILL-LIST.md` complete | **1** |
| Competitive parity matrix (living doc) | — | — | — | — | — | **Shipped** (this doc) | All modules + prompts mapped | **2** |
| Rate tables + billing rules | Strong | N/A | Strong | N/A | Partial | **Shipped** | CRUD + apply on time entry create | **3** |
| Time entry approvals + retainer | Strong | N/A | Strong | N/A | Partial | **Shipped** | Submit/approve/reject; block invoice until approved | **4** |
| Pre-bill review + write-downs | Strong | N/A | Strong | N/A | Partial | **Shipped** | `PreBillSession` + web UI | **5** |
| LEDES export + statements | Strong | N/A | Partial | N/A | Partial | **Shipped** | LEDES 1998B + real statement PDFs | **6** |
| Dunning + payment reconciliation | Strong | N/A | Partial | N/A | Partial | **Shipped** | Bull dunning + webhook reconciliation; kill payment mocks | **7** |
| Trust reconciliation + IOLTA | Strong | N/A | Strong | N/A | Partial | **Shipped** | Period close + trust statements | **8** |
| Matter playbooks + Kanban | Partial | N/A | Partial | N/A | Strong | **Shipped** | Playbook execute on create + matter Kanban | **9** |
| Conflicts + parties + matter UX | Strong | N/A | Strong | N/A | Strong | **Shipped** | Conflict check + parties tab + filters | **10** |
| Document version history | Strong | Partial | Strong | Weak | Strong | **Shipped** | Version restore + share links | **11** |
| OCR + full-text search (live Azure) | Partial | Strong | Partial | Weak | Partial | **Shipped** (prod guard) | Azure live + search includes OCR text | **12** |
| Merge fields + assembly | Partial | N/A | Strong | Strong | Partial | **Shipped** | `generateFromTemplate` on matter | **13** |
| Questionnaires + conditional clauses | Partial | N/A | Strong | Strong | Partial | **Shipped** | Questionnaire CRUD API | **14** |
| Passive / assisted time capture | Weak | N/A | Strong | N/A | Partial | **Shipped** | Suggested time approve → time entry | **15** |
| Google Calendar + Outlook OAuth | Strong | N/A | Partial | N/A | Partial | **Partial** | OAuth authorize URL + sync retry; live callbacks env-gated | **16** |
| Gmail/Outlook email sync | Strong | N/A | Partial | N/A | Partial | **Partial** | Email sync stub → timeline | **17** |
| Zoom / Meet / Teams import (live) | Strong | N/A | Weak | N/A | Partial | **Partial** | OAuth authorize + native record fallback | **19** |
| QuickBooks + DocuSign | Strong | N/A | N/A | N/A | Partial | **Partial** | OAuth + invoice export endpoint | **20** |
| Marketplace payments E2E | Weak | N/A | N/A | Weak | Partial | **Shipped** | Revenue ledger on review pay | **21** |
| Intake pipeline CRM | Strong | N/A | N/A | Partial | Strong | **Shipped** | Kanban leads New → Engaged | **22** |
| Booking + intake questionnaires | Strong | N/A | N/A | Partial | Strong | **Shipped** | Public booking page + lead API | **23** |
| Consumer checkout polish | Weak | N/A | N/A | Strong | N/A | **Shipped** | PostHog checkout events + receipts | **25** |
| Curated law library + citation export | Partial | Strong | Weak | Weak | Partial | **Partial** — Law Library UI + IN corpus sync + hybrid search API | Citation export polish; admin ingest dashboard | **27** |
| Bulk document review (diligence) | Weak | Strong | Weak | N/A | Partial | **Shipped** — web diligence + vault bulk trigger + `diligence-agent` | Mobile bulk review UI | **28** |
| India eCourts live connector | Partial | N/A | N/A | N/A | N/A | **Partial** (prod throws without env) | Live CNR API when `ECOURTS_API_URL` set | **29** |
| US CourtListener / PACER docket live | Partial | N/A | N/A | N/A | Strong | **Partial** (no stub fallback in prod) | Live sync when CourtListener token set | **30** |
| Evidence vault + chain of custody | Weak | N/A | N/A | N/A | Strong | **Shipped** | Evidence web UI + custody API | **31** |
| Microsoft Word add-in (MVP) | Weak | Strong | N/A | N/A | Partial | **Shipped** | `legal_word_addin/` manifest + taskpane | **32** |
| SSO/SAML + SCIM | Strong | Strong | Partial | Partial | Strong | **Partial** — SAML ACS JWT issuance + SCIM provision API | Full IdP signature validation in production | **33** |
| Visual automations + SLA | Strong | N/A | Partial | N/A | Strong | **Shipped** | Flow preview + SLA breach scheduler | **34** |
| Comprehensive audit log + ethical walls | Strong | Strong | Partial | Partial | Strong | **Shipped** | `/admin/audit` search + governance walls | **36** |
| Mobile lawyer + consumer parity | Strong | N/A | Partial | Partial | Partial | **Shipped** | Leads convert, copilot chips, outcome tab | **37** |
| Production hardening + QA sign-off | Strong | Strong | Strong | Strong | Strong | **Partial** | Scripts ready; post-deploy smoke requires live env | **38** |

---

## OdaFlow differentiators (preserve — not competitor parity)

| Feature | Clio | Harvey | Smokeball | LegalZoom | Filevine | OdaFlow Status | Series A minimum | Prompt # |
|---------|------|--------|-----------|-----------|----------|----------------|------------------|----------|
| Dual-sided consumer → marketplace → matter funnel | Weak | Weak | Weak | Weak | Partial | **Won** | Harden marketplace pay + intake (**21–23**) | **21–23** |
| AI gateway (credits, compliance, audit) | Partial | Strong | Weak | Weak | Partial | **Won** | No mock in prod paths | **26**, **38** |
| Outcome analytics + portal publish | Weak | Partial | Weak | N/A | Partial | **Won** | Mobile outcome + firm memory refresh | **26**, **37** |
| Training consent default DENIED | Partial | Partial | N/A | N/A | Partial | **Won** | Maintain; document in audit (**36**) | **36** |
| Multi-country payments (Stripe, Razorpay, M-Pesa) | Partial | N/A | N/A | Partial | N/A | **Won** (with mock fallback) | Live keys mandatory in prod | **7**, **25** |
| Native meeting → transcript → timeline | Partial | N/A | Weak | N/A | Partial | **Won** (partial wiring) | Live meeting OAuth (**19**) | **19** |

---

## Prompt quick reference (all 38)

| # | Title | Primary competitor | QA-MATRIX touchpoints |
|---|-------|-------------------|------------------------|
| 1 | Stub kill list | Production | Phase 0 real API |
| 2 | Parity matrix doc | All | — |
| 3 | Rate tables | Clio | Time/billing |
| 4 | Time approvals | Clio | Time |
| 5 | Pre-bill | Clio | Billing |
| 6 | LEDES + statements | Clio | Billing |
| 7 | Dunning + reconciliation | Clio/LawPay | Payments stub; post-deploy pay |
| 8 | Trust reconciliation | CosmoLex | Trust |
| 9 | Playbooks + Kanban | Clio/Filevine | Playbooks |
| 10 | Conflicts + parties + UX | Clio | Matters |
| 11 | DMS versions | Clio | DMS |
| 12 | OCR full-text | Clio/Harvey | OCR |
| 13 | Merge fields | Smokeball | Doc automation |
| 14 | Questionnaires | Smokeball | Doc automation |
| 15 | Passive time | Smokeball | Time |
| 16 | Calendar OAuth | Clio | Integrations |
| 17 | Email sync | Clio | Comms |
| 18 | Unified inbox | Clio/MyCase | Portal |
| 19 | Meeting import live | Clio | Meetings |
| 20 | QuickBooks + DocuSign | Clio | Integrations |
| 21 | Marketplace pay E2E | Lawmatics | Marketplace |
| 22 | Intake pipeline | Lawmatics | Leads |
| 23 | Booking + questionnaires | Clio Grow | Intake |
| 24 | Consumer form library | LegalZoom | Consumer |
| 25 | Consumer checkout polish | LegalZoom | Mobile checkout |
| 26 | Firm memory in gateway | Harvey | AI/copilot |
| 27 | Law library | Lexis+ | Research |
| 28 | Bulk doc review | Harvey | AI |
| 29 | eCourts live | India court | Phase 4 court |
| 30 | US docket live | Filevine | Phase 4 court |
| 31 | Evidence vault | Filevine | Court |
| 32 | Word add-in MVP | Spellbook | AI drafting |
| 33 | SSO/SCIM | Clio enterprise | SSO |
| 34 | Visual automations | Clio | Automations |
| 35 | Webhooks + public API | Clio | Public API |
| 36 | Audit log + ethical walls | Harvey | Admin audit |
| 37 | Mobile parity | MyCase | Mobile |
| 38 | Production QA sign-off | Series A | Post-deploy smoke |

---

## Series B execution rows (Prompts 39–50)

| Feature | Clio | Harvey | Smokeball | LegalZoom | Filevine | OdaFlow Status | Series B minimum | Prompt # |
|---------|------|--------|-----------|-----------|----------|----------------|------------------|----------|
| Skip link + main landmark | Partial | N/A | Partial | N/A | Partial | **Shipped** | WCAG shell landmarks on app layout | **39** |
| Radix toast system | Strong | N/A | Partial | Partial | Partial | **Shipped** | No `alert()` in app surfaces | **40** |
| Onboarding 6-step wizard | Strong | N/A | Partial | Strong | Partial | **Shipped** | `/app/onboarding` first-run flow | **41** |
| Command palette create actions | Strong | N/A | Partial | N/A | Partial | **Shipped** | ⌘K create matter/time/invoice | **42** |
| Proactive morning brief | Weak | Strong | N/A | N/A | N/A | **Shipped** | Copilot Insights tab + brief API | **43** |
| Copilot @agent orchestration | Weak | Strong | N/A | N/A | N/A | **Shipped** | Multi-agent dispatch in copilot | **44** |
| Firm outcome benchmarks | Weak | Partial | Weak | N/A | Partial | **Shipped** | `getFirmOutcomeBenchmarks` + vs firm average UI | **45** |
| Unified knowledge search (web) | Partial | Strong | Weak | N/A | Partial | **Shipped** | `GET /search/unified` + entity badges | **46** |
| Integration retry dashboard | Strong | N/A | Partial | N/A | Strong | **Shipped** | Sync logs + `POST /integrations/:provider/sync` | **47** |
| OpenSearch migration path | Strong | Strong | N/A | N/A | Strong | **Gap** | Index abstraction + dual-write plan | **48** |
| Migration BullMQ + Clio CSV | Strong | N/A | Partial | N/A | Partial | **Partial** — `POST /migration/clio/import` + settings upload UI | Full production worker + entity mapping | **49** |
| CI integration + AI credit tests | Strong | Strong | N/A | N/A | Partial | **Gap** | Contract tests in CI pipeline | **49** |
| Portal v2 client uploads | Strong | N/A | Partial | Partial | Partial | **Shipped** (partial) | Client doc upload for requests | **50** |
| Advanced billing (contingency/milestone) | Strong | N/A | Strong | N/A | Partial | **Gap** | Contingency + milestone invoice types | **50** |

---

## Prompt quick reference (Series B: 39–50)

| # | Title | Primary competitor | QA-MATRIX touchpoints |
|---|-------|-------------------|------------------------|
| 39 | Skip link + landmarks | UX | Series B Phase 7 |
| 40 | Radix toast system | UX | Series B Phase 7 |
| 41 | Onboarding wizard | UX | Series B Phase 7 |
| 42 | Command palette actions | UX | Series B Phase 7 |
| 43 | Morning brief | Harvey | Series B Phase 8 |
| 44 | @agent orchestration | Harvey | Series B Phase 8 |
| 45 | Outcome benchmarks | Filevine | Series B Phase 8 |
| 46 | Unified search web | Harvey | Series B Phase 8 |
| 47 | Integration retry dashboard | Clio | Series B Phase 9 |
| 48 | OpenSearch path | Elastic | Series B Phase 9 |
| 49 | Migration worker + CI tests | Clio | Series B Phase 9 |
| 50 | Portal v2 + advanced billing | Clio | Series B Phase 9 |

---

## Sign-off criteria (Prompt 38 / 50)

Update **OdaFlow Status** to `Shipped` or `Won` when:

1. Series A/B minimum column is met in staging + production smoke.
2. Related rows in [STUB-KILL-LIST.md](STUB-KILL-LIST.md) show no outstanding `must_be_live_in_prod` without env guard.
3. [QA-MATRIX.md](QA-MATRIX.md) checkboxes for that vertical are `[x]`.
4. Category verdict rows read **Yes** with evidence links (demo script, env checklist, E2E run).

**Target after Prompt 50**

| Category verdict | Target |
|------------------|--------|
| Practice management | **Yes** (Parity+) |
| Enterprise legal AI | **Yes** (Parity) |
| Consumer legal | **Yes** (Parity+) |
| Dual-sided AI OS (IN/US SMB) | **Yes** |
| Outcome-governed intelligence | **Yes** (Leader) |

---

*Maintain this file when executing Prompts 3–50. Do not edit the Cursor plan file — update this matrix and MEGASPEC-ALIGNMENT instead.*
