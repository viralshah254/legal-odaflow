# Series B Dominance Roadmap — Implementation Sign-off

**Date:** 2026-05-29  
**Scope:** 50-prompt competitive dominance roadmap (Waves 0–9)  
**Bar:** Parity + beat incumbents on autonomy, UX, dual-sided flywheel

## Wave 0 — Baseline (Prompts 1–2)
- [x] [STUB-KILL-LIST.md](STUB-KILL-LIST.md) — extended to Series B prompts 1–50
- [x] [COMPETITIVE-PARITY-MATRIX.md](COMPETITIVE-PARITY-MATRIX.md) — Series B target column + prompt map 1–50

## Wave 1 — Billing & trust (Prompts 3–8)
- [x] Rate tables auto-apply on manual + timer stop (`resolveRateForUserId`)
- [x] Time submit/reject + retainer warnings on billable create
- [x] Invoice blocks unapproved billable time; `createFromApprovedTime`
- [x] Pre-bill write-downs in LEDES export
- [x] Statement PDF text endpoint `GET /billing/statements/pdf`
- [x] Payment webhook reconciliation + dunning status API
- [x] Trust reconciliation statement `GET /billing/trust/reconciliation/:id/statement`
- [x] Web: pre-bill write-down UI, statements PDF, payments reconcile, trust reconciliation tab

## Wave 2 — Matter ops & DMS (Prompts 9–15)
- [x] Playbooks auto-execute on matter create (`executePlaybook`)
- [x] Conflicts check API + matter list filters wired web
- [x] DMS version restore + share links
- [x] OCR prod guard + OCR text in search
- [x] Merge fields + `generateFromTemplate` + questionnaire CRUD
- [x] Suggested time approve → time entry API

## Wave 3 — Integrations (Prompts 16–20)
- [x] OAuth authorize URL endpoint + integration sync scheduler + manual retry
- [x] Email sync stub → timeline entries
- [x] QuickBooks invoice export endpoint (env-gated)
- [ ] Live OAuth callback tokens (requires provider credentials in prod)

## Wave 4 — Marketplace & consumer (Prompts 21–25)
- [x] Marketplace revenue ledger on review pay
- [x] Public booking page `/book/[lawyerSlug]` + API
- [x] Consumer form library by country + generate links
- [x] PostHog checkout events in BuyCreditsModal

## Wave 5 — Legal AI & court (Prompts 26–32)
- [x] Firm memory in matter summary + document draft gateway paths
- [x] Law library admin ingest endpoint + web form
- [x] Bulk diligence batch progress + realtime
- [x] US docket: no stub fallback in production
- [x] Evidence vault web UI
- [x] Word add-in manifest + taskpane

## Wave 6 — Enterprise & hardening (Prompts 33–38)
- [x] Public API v1.0.0 + real webhook test delivery
- [x] Automation SLA breach scheduler + flow preview UI
- [x] SAML login stub + SCIM provision API
- [x] Admin audit search UI + ethical walls governance page
- [x] Mobile outcome/leads/copilot wiring
- [x] `post-deploy-smoke.sh` + `validate-production-env.sh` expanded

## Wave 7 — UX excellence (Prompts 39–42)
- [x] Skip link + main landmark on app shell
- [x] Radix toast system
- [x] Onboarding 6-step wizard
- [x] Command palette create actions

## Wave 8 — Autonomous AI (Prompts 43–46)
- [x] Proactive morning brief API + copilot Insights tab
- [x] Copilot @agent orchestration
- [x] Unified search `/search/unified` + web entity badges
- [x] Firm outcome benchmarks + vs firm average UI

## Wave 9 — Scale & ecosystem (Prompts 47–50)
- [x] [OPENSEARCH-MIGRATION.md](OPENSEARCH-MIGRATION.md) migration path
- [x] Integration retry dashboard
- [x] Migration BullMQ worker for Clio CSV import
- [x] Integration tests (`billing-trust.spec.ts`, `ai-credits.spec.ts`)
- [x] Invoice `billingModel` (HOURLY/FIXED/CONTINGENCY/MILESTONE/SUBSCRIPTION)
- [x] Portal v2 client doc request uploads

---

## Sign-off criteria (Prompt 50)

- [x] Parity matrix wave rows updated to Shipped/Partial/Won (live-env items Partial)
- [x] Backend build + 46 tests pass
- [x] Web build passes
- [ ] Post-deploy smoke against live env (run `scripts/post-deploy-smoke.sh` after deploy)
