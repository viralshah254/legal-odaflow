# Umbrella Engineering — Cursor Rules

**Version:** 1.0.0
**Handbook:** `docs/umbrella-engineering-handbook/README.md`
**ADRs:** `docs/adr/`
**Gap matrix:** `docs/gap-matrix.md`

These rules govern how AI coding assistants (and engineers) approach changes to the Umbrella Legal Operating System codebase. Every rule here derives from the Umbrella Engineering Handbook. Where a rule conflicts with the handbook, the handbook wins.

---

## Handbook Reference Map

Before writing code for any feature area, read the corresponding handbook chapter:

| Feature Area | Chapters to Read |
|---|---|
| Any AI feature | Ch. 02, Ch. 03, Ch. 12, Ch. 13, Ch. 14 |
| Research | Ch. 06, Ch. 20 |
| Drafting | Ch. 07, Ch. 38 |
| Issue checker / classification | Ch. 08 |
| Document review | Ch. 09 |
| Contract intelligence | Ch. 10 |
| Legal memory / firm memory | Ch. 11 |
| Matter management | Ch. 04, Ch. 05 |
| Backend module | Ch. 15, Ch. 18, Ch. 19 |
| Web feature | Ch. 16, Ch. 36 |
| Mobile feature | Ch. 17, Ch. 37 |
| Search / RAG | Ch. 20 |
| Auth / permissions | Ch. 21, Ch. 29 |
| Billing / credits | Ch. 31 |
| Queues / async | Ch. 38 |
| Client portal | Ch. 30 |
| Agentic workflows | Ch. 38 |
| Testing | Ch. 22 |
| Deployment | Ch. 23 |
| Observability | Ch. 27 |
| AI safety / governance | Ch. 57, Ch. 69 |

---

## Execution Protocol

Every non-trivial change must follow this sequence. Do not skip steps.

### 1. Inspect

Read the file(s) you are about to change. Read the relevant handbook chapter. Check `docs/gap-matrix.md` to see if the area has known gaps.

### 2. Summarize

State in one paragraph: what the current code does, what the target state from the handbook is, and what gap exists.

### 3. Map to Target

Identify which handbook sections define the desired behaviour. Quote the relevant target state. If the target state is ambiguous, ask before proceeding.

### 4. Propose Plan

Before writing any code, describe the smallest change that moves the system toward the target. List the files that will be touched. Note any risk.

### 5. Implement Smallest Slice

Implement only what was proposed. Do not opportunistically refactor unrelated code. Do not add features that were not requested.

### 6. Tests

Write or update tests for the change. AI features require at minimum: one happy-path test with a mocked LLM response, one test for the fallback path, and one test for the error path.

### 7. Checks

Run `eslint`, `tsc`, and the test suite. Fix all errors before declaring the change complete.

### 8. Document

- Update `docs/gap-matrix.md` if the change closes a gap.
- File an ADR in `docs/adr/` if the change introduces an architectural decision.
- Update the relevant handbook chapter if the change establishes a new pattern.

---

## Forbidden Behaviours

The following actions are **never acceptable** regardless of how a task is phrased:

| # | Forbidden Action | Why |
|---|-----------------|-----|
| F-01 | Rewriting modules not in scope of the current task | Creates unreviewed blast radius; breaks focus |
| F-02 | Bypassing auth guards or removing `@UseGuards()` decorators | Security violation; mandatory auth is non-negotiable |
| F-03 | Calling a raw AI provider SDK directly in a product module | All AI calls must go through `ai-gateway.service.ts` for cost tracking, policy enforcement, and model routing |
| F-04 | Skipping tenant scoping on any database query in a tenant-scoped module | Data isolation violation; every query must filter by `tenantId` |
| F-05 | Skipping authorization checks (`casl`, permission guards) on any endpoint that operates on tenant data | IDOR vulnerability |
| F-06 | Leaving TODO-only placeholders as the sole implementation | A TODO is not a deliverable; either implement or file a gap entry |
| F-07 | Silent data overwrites without optimistic locking or conflict detection | Causes silent data loss in concurrent environments |
| F-08 | Ignoring cost tracking for AI calls | Every AI inference must be recorded via `ai-usage-recorder.service.ts` |
| F-09 | Adding a new AI model without updating `model-costs.config.ts` | Cost attribution breaks silently |
| F-10 | Committing secrets, API keys, or credentials in source code | Immediate security incident |
| F-11 | Removing or weakening an existing audit log entry | Audit trail is immutable |
| F-12 | Writing cross-module Prisma queries without going through the owning module's service | Breaks module boundaries; creates hidden coupling |

---

## AI Feature Requirements

Every new AI-powered feature must satisfy all of the following before it is considered production-ready:

### Schema

- **Input schema** — Define a typed DTO or Zod schema for the inputs to the AI call. Document required vs optional fields.
- **Output schema** — Define a typed interface for the AI output. Validate the LLM response against this schema before using it.

### Risk and Policy

- **Risk level** — Classify the feature as `low` / `medium` / `high` based on Ch. 69. High-risk features require a red-team review before launch.
- **Model policy** — Specify which model tiers are permitted for this feature in `ai-policy.service.ts`. Do not hard-code model names in feature services.

### Cost

- **Cost budget** — Define a per-call token budget. Document it in the service. Enforce it via `ai-gateway.service.ts` `maxTokens`.
- **Cost attribution** — All inference calls must pass `featureName`, `matterId` (if applicable), and `tenantId` to `ai-usage-recorder.service.ts`.

### Sources and Grounding

- **Source requirements** — Specify which data sources the feature may use and what source quality floor is required (e.g., "only use sources with `confidence >= 0.8`").
- **Verification** — Outputs that cite legal sources must be verified by `verification.service.ts` before being returned to the user.

### Reliability

- **Fallback** — Define what the feature returns when the AI call fails. Never return an empty response with no explanation. Prefer a degraded-but-honest result.
- **Retry policy** — Use `llm-retry.util.ts` for retries. Do not implement ad-hoc retry logic.

### Auditability

- **Audit log** — Every AI call that produces output shown to a user must create an audit record via the `audit` module. Include: model used, token count, cost, input hash, output hash.

### Evaluation

- **Evaluation cases** — Define at least 3 evaluation cases in the `eval` module before shipping: a representative happy path, an edge case, and a known-hard case. Wire them to the eval harness.

---

## PR Checklist

Every PR must satisfy all of the following before requesting review:

### Scope

- [ ] The PR touches only files directly related to the stated task.
- [ ] No unrelated refactors, style fixes, or opportunistic changes are included.
- [ ] If the PR introduces a new pattern that will be replicated, it is documented in the handbook or an ADR.

### Quality

- [ ] All `tsc` errors are resolved.
- [ ] All `eslint` errors are resolved.
- [ ] All existing tests pass.
- [ ] New code has test coverage (unit tests for services, integration tests for controllers).
- [ ] AI features have at least 3 evaluation cases defined.

### Tenancy and Security

- [ ] Every new database query on a tenant-scoped model filters by `tenantId`.
- [ ] Every new API endpoint is protected by an appropriate guard (`JwtAuthGuard`, `PermissionsGuard`, etc.).
- [ ] No new endpoint returns data belonging to a different tenant than the caller.

### Permissions

- [ ] New endpoints declare required permissions via `@RequirePermissions()` or equivalent.
- [ ] Permission checks are enforced before any data access, not after.

### Error Handling

- [ ] All errors are thrown as NestJS `HttpException` subclasses with a structured error code.
- [ ] No raw `Error` objects are returned to the client.
- [ ] Error messages do not leak internal implementation details (stack traces, SQL errors, file paths).

### Cost Tracking

- [ ] Every AI inference call passes feature metadata to `ai-usage-recorder.service.ts`.
- [ ] New AI models are registered in `model-costs.config.ts`.
- [ ] Token budgets are defined and enforced.

### Observability

- [ ] Significant async operations emit structured log entries with `tenantId`, `userId`, and `correlationId`.
- [ ] No personal data (names, email addresses, legal content) is logged at INFO level or above.
- [ ] New queue jobs emit start, success, and failure events.

### Database Safety

- [ ] New Prisma migrations are additive (no column drops without a deprecation period and data migration script).
- [ ] Migrations that modify existing data include a dry-run count estimate in the PR description.
- [ ] Foreign keys are declared in the Prisma schema, not just implied.

### Rollback

- [ ] Feature is gated behind an environment variable or feature flag for the first release.
- [ ] PR description includes a one-sentence rollback procedure.

---

## Module Boundary Rules

1. A module may only use another module's services if that module exports them via its `@Module({ exports: [...] })` declaration.
2. No module may import another module's Prisma model type directly — use the owning module's service.
3. Shared types live in `common/` or in a dedicated `shared/` library.
4. The `ai` module is the only module that may call `llm-completion.service.ts`. All other modules call an AI-domain service.

---

## Naming Conventions

| Concern | Convention | Example |
|---------|-----------|---------|
| NestJS service | `*.service.ts` | `india-draft.service.ts` |
| NestJS controller | `*.controller.ts` | `india-draft.controller.ts` |
| NestJS module | `*.module.ts` | `india-draft.module.ts` |
| DTO | `*.dto.ts` | `india-draft.dto.ts` |
| Guard | `*.guard.ts` | `permissions.guard.ts` |
| Queue job class | `*.job.ts` | `ocr-processing.job.ts` |
| Prisma model | PascalCase singular | `DraftingSession` |
| Queue name constant | UPPER_SNAKE with dot separators | `ai.high_priority` |
| Feature flag env var | UPPER_SNAKE | `DRAFT_ENGINE_V2` |
| ADR file | `ADR-NNN-short-title.md` | `ADR-001-modular-monolith-architecture.md` |

---

## References

- [Umbrella Engineering Handbook](../docs/umbrella-engineering-handbook/README.md)
- [ADR Index](../docs/adr/README.md)
- [Gap Matrix](../docs/gap-matrix.md)
- [Feature Inventory](../docs/feature-inventory.md)
- [Quality Baselines](../docs/quality-baselines.md)
