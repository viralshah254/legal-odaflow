# ADR-002 — Canonical Research Workspace and Filing

**Status:** accepted
**Date:** 2026-07-27
**Author(s):** Engineering
**Reviewers:** Engineering
**Handbook chapters:** Ch. 02 — Legal Intelligence Engine, Ch. 12 — Verification Engine, Ch. 38 — Agentic Workspaces and Orchestration

---

## Context

Legal research previously treated each AI answer as an isolated result. Follow-up facts, answers to open questions, authority changes, and matter context could be retained in browser state, but there was no durable session that ordered those inputs and outputs. Saved research and manual citation decisions also had overlapping UI concerns without a clear persistence boundary.

The upgrade must preserve tenant and matter access controls, keep automated verification claims honest, allow a legacy research fallback during rollout, and avoid turning a mutable AI answer into an immutable matter filing by accident. Citation relationship graphing remains a separate, incomplete capability.

---

## Decision

We will use `ResearchWorkspace` as the canonical durable research session. Structured context items belong to the workspace, while each completed answer remains an immutable `AIOutput` linked through an ordered workspace revision.

`SavedResearch` is a filing snapshot, not the live workspace. Filing captures the selected answer, verification metadata, provenance, client, and optional matter at that point in time. A subsequent workspace revision does not mutate an earlier filing.

Manual citation review remains independent from automated verification. A lawyer decision is appended as a separate review record and audit event; it does not rewrite `citationAudit`, `verified`, or `safeForReliance`. Any future promotion to a matter document must preserve both the memo body and verification/provenance appendix.

The rollout order is:

1. `RESEARCH_WORKSPACE_FOLLOW_ON` — workspace, context, and revisions.
2. `RESEARCH_MANUAL_CITATION_REVIEW` — independent lawyer review tasks.
3. `RESEARCH_MATTER_FILING` — client/matter filing and document promotion.

All flags are disabled in production unless explicitly enabled. Disabled endpoints return a structured 404 with `code: FEATURE_UNAVAILABLE` and `fallback: legacy_research`, using tenant and user context for evaluation. Development/test defaults may enable early stages; filing remains explicitly opt-in.

---

## Alternatives Considered

### Option A — Canonical workspace with immutable outputs and filing snapshots (chosen)

**Description:** Separate the mutable session, immutable generated revisions, filing snapshot, and human review records.

**Pros:**
- Reloadable follow-on research without overwriting prior answers.
- Clear audit and access-control boundaries.
- Honest separation between automated and human verification.

**Cons:**
- More entities and explicit reconciliation after partial failures.
- Filing snapshots can intentionally diverge from later workspace revisions.

**Why chosen:** It preserves provenance and rollback safety while supporting iterative research.

### Option B — Mutate one research answer in place

**Description:** Store only the latest answer and context on one record.

**Pros:**
- Simpler reads and fewer records.

**Cons:**
- Loses revision history and weakens evidentiary provenance.
- Makes filed results change after later follow-ups.

**Why rejected:** It is not auditable enough for legal work.

### Option C — Treat saved research as the session

**Description:** Append follow-ups and manual decisions directly to `SavedResearch`.

**Pros:**
- Reuses an existing client/matter-facing entity.

**Cons:**
- Conflates work in progress with an intentional filing.
- Makes matter filing mandatory for general research.

**Why rejected:** Session lifecycle and filing lifecycle have different access and immutability requirements.

---

## Consequences

### Positive

- Question → context → revision flows can be reloaded and compared.
- Saved matter/client research is a stable point-in-time record.
- Manual review cannot silently upgrade automated safe-for-reliance status.
- Each capability can be rolled out or withdrawn independently.

### Negative / Trade-offs

- The frontend must gracefully reconcile workspace failures while keeping the answer usable.
- Server-side matter-document promotion remains unavailable until a document service can atomically persist generated content and provenance.
- This decision does not complete a citation relationship/treatment graph.

### Neutral / Operational Notes

- Product telemetry uses IDs, counts, booleans, modes/statuses, and elapsed milliseconds only. Queries, names, passages, source URLs, and legal content are prohibited.
- Tenant/user flag context and existing matter ACL checks are both required.

---

## Migration Plan

1. Enable workspace follow-ons for internal tenants and monitor revision completion/fallback rates.
2. Enable manual review for a lawyer cohort and monitor decisions and time-to-decision.
3. Enable filing for selected tenants after snapshot and document-export checks pass.
4. Keep legacy research available while any of the flags are disabled.

---

## Rollback Plan

Disable the affected feature flag. New requests receive the structured feature-unavailable response and the web client falls back to legacy/session-only research. Existing `ResearchWorkspace`, `AIOutput`, `SavedResearch`, and manual review records remain readable and are not deleted. Roll back stages in reverse order: filing, manual review, workspace follow-ons.

---

## Open Questions

| Question | Owner | Target Date | Resolution |
|----------|-------|-------------|------------|
| Which document-service API will atomically promote generated markdown plus verification provenance? | Platform | TBD | Open |
| When will citation relationship and treatment graph coverage meet the production definition? | Legal AI | TBD | Open |

---

## References

- `legal_backend/src/platform/research/`
- `legal_backend/src/ai/legal-research/manual-citation-review.service.ts`
- `legal_backend/src/ai/legal-research/saved-research.service.ts`
- `docs/gap-matrix.md`
