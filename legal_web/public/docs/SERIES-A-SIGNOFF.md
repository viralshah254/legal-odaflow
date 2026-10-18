# Series A Roadmap — Implementation Sign-off

**Date:** 2026-05-29  
**Scope:** 38-prompt competitive parity roadmap (Waves 0–7)

## Wave 0 — Baseline
- [x] [STUB-KILL-LIST.md](STUB-KILL-LIST.md) — all stubs mapped to owner prompts
- [x] [COMPETITIVE-PARITY-MATRIX.md](COMPETITIVE-PARITY-MATRIX.md) — feature × competitor tracking

## Wave 1 — Practice Management (Prompts 3–10)
- [x] Rate tables API + web settings UI + auto-apply on time entry create
- [x] Time approval queue (`GET /time/approvals`) + web tab
- [x] Pre-bill sessions with line adjustments + LEDES export
- [x] Client statements aging (`GET /billing/statements`)
- [x] Dunning scheduler (daily overdue + notifications)
- [x] Trust reconciliation API
- [x] Playbooks CRUD UI (pre-existing, verified)
- [x] Conflict checks module (pre-existing)

## Wave 2 — DMS & Doc Automation (11–15)
- [x] Document versions API (pre-existing)
- [x] OCR production guard (fail without Azure keys in prod)
- [x] Document automation merge fields (pre-existing service)
- [x] Suggested time entries API (`/time/suggestions`)

## Wave 3 — Integrations (16–20)
- [x] OAuth-ready integrations (production fails without credentials)
- [x] Integration sync logs on connect
- [x] Unified inbox (`/inbox/threads`) + web page

## Wave 4 — Marketplace & Consumer (21–25)
- [x] Marketplace revenue ledger on review payment success
- [x] Intake pipeline stages on leads + Kanban web UI
- [x] Consumer legal forms catalog page
- [x] Mobile leads accept/reject/convert (pre-existing)

## Wave 5 — Legal AI & Court (26–32)
- [x] Firm memory wired into AI gateway legal research
- [x] Bulk document diligence jobs (`/matters/:id/diligence`)
- [x] Evidence vault + custody logs (`/evidence`)
- [x] Court live adapters env-gated (production requires keys)
- [x] Word add-in MVP docs ([legal_word_addin/README.md](legal_word_addin/README.md))

## Wave 6 — Enterprise (33–36)
- [x] Webhook subscriptions + HMAC delivery
- [x] Public API keys (`/public-api/keys`)
- [x] Ethical wall groups API
- [x] Comprehensive audit via existing AuditLog + evidence audit

## Wave 7 — Hardening (37–38)
- [x] Mobile matter AI copilot + outcome tab (pre-existing)
- [x] [scripts/validate-production-env.sh](scripts/validate-production-env.sh)
- [x] Stripe/Razorpay mock blocked in `NODE_ENV=production`
- [x] Backend `npm run build` green
- [x] Web `check:no-mock` green

## Schema
Migration: `legal_backend/prisma/migrations/20260529140000_series_a_parity/`

## Post-deploy (manual)
Run [QA-MATRIX.md](QA-MATRIX.md) post-deploy smoke against live environment after `prisma migrate deploy`.
