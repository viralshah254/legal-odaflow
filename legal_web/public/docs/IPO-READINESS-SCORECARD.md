# IPO Readiness Scorecard

Track this before every investor or production-readiness review.

| Area | Target | Evidence |
| --- | --- | --- |
| Security | Tenant isolation, encrypted sensitive fields, guarded admin, verified webhooks | Security tests, audit logs, privacy center |
| Reliability | Readiness probes, migration runbooks, CI gates | `/health/readiness`, CI, migration runbook |
| UX | Route-complete web app, mobile companion, accessible states | Web build, Flutter tests, accessibility checklist |
| Revenue | Billing, trust, payments, marketplace conversion | Finance controls, seeded invoice/payment flow |
| Compliance | Consent, retention, export/delete, regional controls | Data governance runbook, consent screens |
| AI Quality | Grounded citations, source trace, cost monitoring, approval workflows | Research UI, AI Command Center, Copilot plans |
| Support | Demo data, portal, auditability, operational runbooks | Seed data, portal, deployment docs |

Status should be reviewed as: `green`, `yellow`, or `red`, with an owner and next action for any yellow/red area.
