# Production Definition of Done — Series A

Every feature in Umbrella must meet this bar before marking **Complete** in [MEGASPEC-ALIGNMENT.md](legal_web/MEGASPEC-ALIGNMENT.md).

## 1. Functional

- [ ] Happy path works end-to-end (UI → API → DB → UI)
- [ ] Edge cases handled (empty state, not found, forbidden, validation errors)
- [ ] `tenantId` enforced on all firm APIs (`TenantGuard` + query filters)
- [ ] RBAC enforced **server-side** (not only client `RoleGate`)
- [ ] Idempotent writes where applicable (webhooks, imports)

## 2. Data

- [ ] Prisma schema + migration applied
- [ ] Seed or fixture data for dev/smoke
- [ ] No drift between schema and runtime (no hardcoded duplicates of DB models)
- [ ] Background jobs for long work (OCR, embeddings, reports, imports) via `npm run start:worker`

## 3. AI features

- [ ] Credit reservation/debit via `AICreditLedger`
- [ ] `AIOutput` + usage logged
- [ ] Citations from retrieved sources OR explicit refusal (no fabricated case law)
- [ ] `LegalDisclaimer` on consumer-facing surfaces
- [ ] Lawyer approval gate for high-risk outputs where required

## 4. UX

- [ ] Loading, empty, and error states on every async view
- [ ] Mobile-responsive layout (firm OS + consumer)
- [ ] No `alert()` for production save success — use toast or inline confirmation
- [ ] No decorative controls (search, filters, saves) that do not persist or query
- [ ] Actionable error messages (not raw stack traces)

## 5. Reliability

- [ ] Retries on external integrations with sync log
- [ ] `npm run check:no-mock` passes in CI for production paths
- [ ] Mock/fallback only when `NODE_ENV=development` or explicit `ALLOW_MOCK_*` env
- [ ] Payment providers require live keys in production deploy checklist

## 6. Tests

- [ ] Contract test for new API routes (shape + auth)
- [ ] Unit test for critical business rules (trust negative, consent default DENIED)
- [ ] Playwright E2E for features on critical path (when user-facing flow is new)

## 7. Observability

- [ ] Sentry captures unhandled errors (web, backend, mobile)
- [ ] PostHog event on primary conversion step (where applicable)
- [ ] Structured log on job failure with `tenantId` / `matterId` context

## 8. Security

- [ ] DTO validation (`class-validator`)
- [ ] Rate limiting on public/auth endpoints (global throttler)
- [ ] `AuditLog` entry for sensitive mutations (trust, permissions, portal publish, data export)

## 9. Documentation

- [ ] `.env.example` updated for new variables
- [ ] MEGASPEC-ALIGNMENT row updated: Partial → Complete with evidence link
- [ ] API path listed in DEV-WORKFLOW or module README if non-obvious

## Anti-patterns (reject in PR review)

- Page returns 200 but data is not persisted
- "Connect" integration without OAuth token refresh
- Stub response in production for court/payments/AI without env guard
- Marking Complete without E2E or contract test for new surface

## PR checklist (copy into description)

```
- [ ] DoD sections above applicable to this PR
- [ ] No secrets in frontend
- [ ] Migration included if schema changed
- [ ] Worker job registered if async
```
