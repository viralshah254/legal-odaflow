# ADR-001 — Modular Monolith Architecture

**Status:** accepted
**Date:** 2026-06-26
**Author(s):** Engineering Team
**Handbook chapters:** Ch. 01 — Platform Architecture, Ch. 15 — Backend Architecture, Ch. 26 — Engineering Principles

---

## Context

Umbrella is an AI-native Legal Operating System with a large and growing feature surface: research, drafting, issue analysis, document review, contract intelligence, matter management, client portal, billing, marketplace, and more. As of June 2026 the backend (`legal_backend/`) contains approximately 80+ NestJS modules sharing a single PostgreSQL database (~105 Prisma models), a single Bull queue backend with multiple named queues, a shared OpenSearch instance, and a shared pgvector index.

Early in development there was a question of whether to build as a microservices cluster (each domain as an independently deployed service), a true monolith (single module boundary), or a modular monolith (single deployment unit with strong internal module boundaries).

The team evaluated this decision against the following constraints:

- **Team size:** Small engineering team; operational overhead of microservices is high.
- **Data model:** Heavy cross-domain joins are required (e.g., Matter ↔ Document ↔ DraftingSession ↔ AICreditLedger). Distributed transactions would be needed in a microservices model.
- **AI pipeline latency:** Many AI workflows require sequential cross-domain calls within a single request. Network hops between services would add latency with no benefit at current scale.
- **Tenant isolation:** Multi-tenancy is enforced at the application layer today. A microservices model would require re-implementing tenant context propagation across service boundaries.
- **Cost:** Separate deployments, separate databases, and separate observability stacks are expensive in both infrastructure cost and engineering time.
- **Handbook guidance:** Chapter 01 explicitly specifies a modular monolith as the baseline architecture with a clear extraction path for services that need independent scaling later.

The existing codebase demonstrates the modular monolith pattern: NestJS modules have explicit `imports`/`exports`, no module directly calls another module's repository or service without importing it, and shared concerns (auth, tenancy, Prisma, config) live in a shared kernel (`common/`, `prisma/`, `config/`).

---

## Decision

We will build and maintain Umbrella as a **modular monolith**: a single deployable NestJS application (`legal_backend/`) composed of well-bounded modules that communicate through explicit NestJS dependency injection, not HTTP or message queues. Asynchronous work is delegated to Bull queues but remains within the same process and codebase.

Module extraction into independent microservices is explicitly deferred until a module has demonstrated a clear scaling bottleneck that cannot be addressed within the monolith (e.g., CPU-bound OCR processing reaching monolith CPU limits, or a module requiring a different deployment cadence for compliance reasons).

The following structural rules enforce the modular monolith:

1. No module may import a class from another module's file without that module explicitly exporting the class.
2. All cross-module communication goes through injected service interfaces, never through direct Prisma model access from another module's domain.
3. Shared data concerns (tenant ID, user ID, permission context) are propagated via `LegalRequestContext` injected by the global auth guard — not passed as function arguments.
4. Queue names are declared in a central constants file; no module may create ad-hoc queues.
5. Database migrations are managed centrally via Prisma; no module owns a separate database or schema.

---

## Alternatives Considered

### Option A — Modular Monolith (chosen)

**Description:** Single NestJS application with strict module boundaries. One PostgreSQL database, one Bull queue process, one deployment artifact.

**Pros:**
- Zero distributed transaction complexity.
- Simple cross-module queries via Prisma.
- Low operational overhead (one Dockerfile, one deploy pipeline).
- Shared AI context (`LegalRequestContext`) trivially available to all modules.
- Refactoring across modules is a single PR.
- Easy to onboard new engineers — one codebase to understand.

**Cons:**
- A bug in one module can bring down the entire service.
- Cannot scale individual modules independently (e.g., OCR vs. drafting).
- Module boundaries can erode over time without active enforcement.
- Large codebase — build times increase as the app grows.

**Why chosen:** The team is small, the data model is deeply relational, and the performance constraints don't yet justify the operational overhead of microservices. The module boundary discipline of NestJS provides sufficient isolation at this stage.

---

### Option B — Domain-Separated Microservices

**Description:** Each major domain (matters, drafting, research, billing, etc.) deployed as an independent NestJS service communicating over HTTP or gRPC, with its own database.

**Pros:**
- Independent scaling per domain.
- Faults in one service don't crash others.
- Can use different tech stacks per service in the future.

**Cons:**
- Requires distributed transactions (Saga pattern) for operations that span domains (e.g., creating a matter and its first research task atomically).
- Network latency between services adds 5–50ms per hop in AI pipelines that make many cross-domain calls.
- Per-service Prisma schemas are complex to keep consistent.
- Tenant context must be re-propagated via HTTP headers or tokens on every cross-service call.
- Operational cost (Kubernetes, service mesh, per-service observability) is prohibitive at current team size.

**Why rejected:** The data model and AI pipeline call patterns make microservices expensive with no clear benefit at current scale. The team would spend more time managing inter-service infrastructure than building legal features.

---

### Option C — Single-Layer Monolith (no module boundaries)

**Description:** One NestJS application with no enforced module separation — all services accessible from anywhere.

**Pros:**
- Minimal boilerplate.
- Fast initial development speed.

**Cons:**
- No architectural guardrails — cross-cutting concerns (tenancy, auth, billing) leak into every feature module.
- Impossible to reason about the system as it grows.
- Refactoring becomes a full-codebase exercise.

**Why rejected:** Already ruled out by the handbook and by the current codebase state, which demonstrates good module discipline.

---

## Consequences

### Positive

- Low operational complexity: one deployment artifact, one database, one queue backend.
- Cross-domain queries are straightforward Prisma relations — no distributed data consistency concerns.
- Shared AI context (`LegalRequestContext`) is available to every module via DI without network overhead.
- New engineers can onboard from a single codebase.
- Refactoring and cross-cutting improvements (e.g., adding tenancy checks) can be done in a single PR.

### Negative / Trade-offs

- The entire application goes down if the monolith crashes — no partial degradation at the service level.
- OCR processing, AI inference, and web serving compete for the same process resources. Mitigation: offload heavy work to Bull queue workers which can be scaled as separate process replicas.
- Module boundary erosion is a real risk as the team grows. Mitigation: enforce NestJS module `exports` discipline; add lint rule to prevent direct cross-module Prisma access.
- Build and test times increase as the codebase grows. Mitigation: Nx or Turborepo build caching; parallelised test suites.

### Neutral / Operational Notes

- The Bull queue workers (ocr-processing, ai.high_priority, ai.low_priority, notifications.dispatch, automations.execute, legal.ingest, migration.import, search.index) share the same codebase but can be deployed as separate worker processes to isolate resource usage.
- Future extraction of a module into a microservice requires: (1) an ADR, (2) moving the module to a new package, (3) replacing DI imports with an HTTP/gRPC client, (4) adding distributed transaction handling if needed.

---

## Migration Plan

No migration required — the modular monolith is the current architecture. This ADR ratifies the existing decision and establishes the structural rules going forward.

Enforcement actions required after acceptance:

1. Add ESLint rule prohibiting direct Prisma model imports across module boundaries (owner: Backend Lead, target: Q3 2026).
2. Add architecture fitness test that asserts NestJS module exports are declared for any publicly consumed service (owner: Backend Lead, target: Q3 2026).
3. Document queue name constants in `legal_backend/src/common/queue-names.constants.ts` if not already centralised (owner: Backend Lead, target: Q3 2026).

---

## Rollback Plan

This decision describes the current architecture, so "rollback" means migrating to microservices — a multi-month effort. The trigger for that migration would be:

- A specific module consistently causing >5% of production incidents due to resource contention that cannot be resolved within the monolith.
- A module requiring a different deployment cadence (e.g., a compliance-gated module needing independent releases).
- Team growth beyond ~25 engineers where the single-codebase coordination cost outweighs the distribution cost.

If a module extraction is warranted, the process is:
1. File a new ADR for the specific extraction.
2. Create an `nx` workspace and move the module.
3. Introduce an internal HTTP/gRPC client.
4. Deploy both old and new in parallel behind a feature flag.
5. Validate parity, then cut over.

---

## Open Questions

| Question | Owner | Target Date | Resolution |
|----------|-------|-------------|------------|
| Should Bull queue workers be split into a separate deployment target now or only when CPU contention is measured? | Backend Lead | Q3 2026 | Pending |
| Should we adopt `@nestjs/cqrs` for intra-module command/query separation to further enforce boundaries? | Backend Lead | Q3 2026 | Pending |

---

## References

- [Handbook Ch. 01 — Platform Architecture](../umbrella-engineering-handbook/README.md)
- [Handbook Ch. 15 — Backend Architecture](../umbrella-engineering-handbook/README.md)
- [NestJS Module documentation](https://docs.nestjs.com/modules)
- [Martin Fowler — Modular Monolith](https://martinfowler.com/bliki/MonolithFirst.html)
