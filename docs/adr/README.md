# Architecture Decision Records (ADRs)

**Owner:** Engineering
**Review cadence:** Referenced in every PR that introduces a significant architectural change

---

## What Is an ADR?

An Architecture Decision Record (ADR) is a short document that captures a significant architectural decision made during the development of the Umbrella Legal Operating System. It records the **context** in which the decision was made, the **decision** itself, the **alternatives** that were considered, and the **consequences** of the choice.

ADRs are the long-term memory of the engineering team. They explain *why* the system looks the way it does, which is often more valuable than the *what*.

---

## When to Write an ADR

Write an ADR when you are making a decision that:

- **Affects multiple modules or services** — e.g., changing how tenant context is propagated.
- **Has non-obvious trade-offs** — e.g., choosing pgvector over OpenSearch for a specific retrieval path.
- **Deviates from the Umbrella Engineering Handbook** — every deviation from a handbook chapter must have a corresponding ADR.
- **Introduces a new external dependency** — new AI provider, storage layer, queue backend, search engine.
- **Changes a shared data contract** — Prisma schema changes that affect three or more modules.
- **Establishes a new pattern** — a pattern that will be replicated across the codebase.
- **Reverts or supersedes a previous decision** — close the loop on prior ADRs.

You do **not** need an ADR for:

- Bug fixes that don't change architecture.
- Routine dependency version bumps.
- Feature additions that straightforwardly follow existing handbook guidance.
- Styling or UX changes.

---

## ADR Lifecycle

```
proposed → accepted → (deprecated | superseded)
```

| Status | Meaning |
|--------|---------|
| `proposed` | Under discussion; not yet approved. |
| `accepted` | Decision approved and in effect. |
| `deprecated` | Decision no longer relevant; system has moved on. |
| `superseded` | Replaced by a newer ADR (link provided). |

---

## File Naming Convention

```
ADR-NNN-short-hyphenated-title.md
```

- `NNN` is a zero-padded three-digit sequence number (e.g., `001`, `042`).
- The title should be a concise noun phrase describing the decision, not the outcome.
- Examples:
  - `ADR-001-modular-monolith-architecture.md`
  - `ADR-002-pgvector-for-semantic-search.md`
  - `ADR-015-draft-workspace-canonical-model.md`

---

## Process

1. **Author** copies `template.md`, fills it in, and opens a PR targeting `main`.
2. **Reviewers** (at least one senior engineer) comment on the PR.
3. **Author** incorporates feedback and changes status from `proposed` to `accepted`.
4. **Merge** — the ADR is now the authoritative record.
5. If a future decision supersedes this one, update the status field and add a `Superseded by` link; open a new ADR for the new decision.

---

## Index

| # | Title | Status | Date |
|---|-------|--------|------|
| [ADR-001](ADR-001-modular-monolith-architecture.md) | Modular Monolith Architecture | accepted | 2026-06-26 |
| [ADR-002](ADR-002-canonical-research-workspace-and-filing.md) | Canonical Research Workspace and Filing | accepted | 2026-07-27 |

---

## References

- [Handbook Ch. 01 — Platform Architecture](../umbrella-engineering-handbook/README.md)
- [ADR Template](template.md)
- [Michael Nygard's original ADR format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
