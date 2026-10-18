# Matter Intelligence QA Matrix (P21)

Golden fixtures: `legal_backend/src/ai/matter-intelligence/__tests__/golden-fixtures.ts`

| Fixture | Surface | Expected practiceArea | Expected documentKind / curated | Must NOT surface |
|---------|---------|----------------------|--------------------------------|------------------|
| Arjun Patel (wrongful termination) | draft-intent resolve | employment_labour | india_wrongful_termination @ 0.96 | employment_contract, arbitration petition |
| Maintenance revision | draft-intent + analyze | family_matrimonial | india_maintenance_order_revision | criminal revision |
| Bail application | draft-intent | litigation_disputes | india_regular_bail_bnss_480 | NDA, contract |
| Consumer defective product | intake classify | consumer | consumer complaint kinds | corporate MSA |
| NDA drafting | draft-intent | corporate_commercial | nda / india mutual nda | court petitions |

## Per-surface checklist
- [ ] **Intake** — issues + actions in preview; profile persisted on case create
- [ ] **Draft intent** — MI panel visible; low-confidence hides cross-practice forms
- [ ] **Matter workspace** — profile/graph available on matter detail API
- [ ] **Copilot** — find_draft uses matter profile when matter selected
- [ ] **India draft** — pre-draft gate blocks missing termination letter
- [ ] **Portal** — lead list includes miLeadScore

Run: `npm test -- --testPathPattern="matter-intelligence|mi-intake|contract/matter"` in `legal_backend`.
