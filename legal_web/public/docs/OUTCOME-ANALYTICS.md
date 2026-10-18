# Matter Outcome Analytics — Spec Summary

Structured litigation outcome intelligence for lawyers, with optional client portal sharing. This is **not** a consumer "win your case" feature.

## Purpose

Help licensed attorneys assess matter prospects using probabilistic bands, scenario analysis, and actionable strategy options — grounded in matter facts, issues, arguments, and retrieved authorities.

## Core principles

1. **No guaranteed outcomes** — express win/loss/settlement as **probability bands** (low/mid/high), not single percentages shown to clients.
2. **Lawyer approval required** — analyses default to `NEEDS_REVIEW`; portal exposure requires explicit approval.
3. **Client-safe portal view** — clients see plain-language outlook labels and summaries only when `portalVisible` is true and status is `APPROVED`.
4. **Citations & disclaimers** — every analysis includes legal disclaimers; AI must not invent citations.
5. **Tenant isolation** — all endpoints enforce tenant guard and matter access.

## Data model

`MatterOutcomeAnalysis` (Prisma):

| Field | Description |
|-------|-------------|
| `version` | Incremented per matter on each generation |
| `status` | `NEEDS_REVIEW` → `APPROVED` (lawyer workflow) |
| `portalVisible` | Whether approved summary appears on client portal |
| `portalSummary` | Lawyer-edited plain-language text for clients |
| `portalOutlookLabel` | e.g. Cautious, Balanced, Favorable |
| `overallBand` | VERY_LOW … VERY_HIGH or INSUFFICIENT_DATA |
| `confidence` | LOW, MEDIUM, HIGH |
| `winProbability` / `lossProbability` / `settlementProbability` | JSON bands `{ low, mid, high }` |
| `scenarios` | Named outcomes with likelihood labels |
| `factorsFor` / `factorsAgainst` | Structured factor lists |
| `solutions` | Prioritized recommended actions |
| `missingEvidence` | Gaps that would change the analysis |
| `citations` | Retrieved authority references |
| `disclaimers` | Required legal notices |

## API (backend)

Module: `legal_backend/src/matter-outcome/`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/matters/:matterId/outcome-analysis/generate` | Generate new analysis (AI credits debited) |
| `GET` | `/matters/:matterId/outcome-analysis` | List analyses (newest first) |
| `GET` | `/matters/:matterId/outcome-analysis/:id` | Single analysis |
| `PATCH` | `/matters/:matterId/outcome-analysis/:id` | Update status, portal fields |
| `GET` | `/portal/matters/:matterId/outcome-summary` | Client-visible summary (gated) |

AI task type: `CASE_OUTCOME_ANALYSIS` (50 credits default).

## Web UI

Route: `/app/matters/[matterId]/outcome`

- Generate analysis from matter brain context
- Band charts for win/loss/settlement
- Factors, scenarios, recommended solutions
- Approve and publish toggle for client portal
- `LegalDisclaimer` on all views

Firm reports: `/app/reports` includes `outcomeAnalysesPendingReview` count.

## Mobile (planned)

- Matter detail → Outcome tab (read + request refresh)
- Lawyer approves portal visibility from app

## Compliance gates

- Default status `NEEDS_REVIEW` until lawyer approves
- Block marketing language ("guaranteed win")
- Audit via `AIOutput` + existing AI usage logging
- Consumer surfaces do **not** show raw win/loss percentages

## Related modules

- **Court** (`/app/matters/[id]/court`) — docket/hearing data improves outcome context over time
- **Matter brain** — facts, issues, arguments feed the analysis prompt
- **Analytics** — firm-wide pending review counts in reports API

## References

- Full platform plan: operational phases in repo planning docs
- Production rules: `PRODUCTION-SPEC.md` § AI and disclaimer requirements
- Implementation: `legal_backend/src/matter-outcome/`, `legal_web/lib/api/matter-outcome.ts`
