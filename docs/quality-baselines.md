# Umbrella Platform — Quality Baselines

**Version:** 1.0.0
**Date:** 2026-06-26
**Owner:** Engineering + Product
**Handbook chapters:** Ch. 12 — Verification Engine, Ch. 13 — Cost Optimization, Ch. 22 — Testing, Ch. 27 — Observability and Product Analytics, Ch. 57 — Product Governance and Release Readiness, Ch. 69 — AI Safety, Red-Teaming and Model Governance

---

## Purpose

This document defines the quality metrics that the Umbrella Legal Operating System must measure, track, and improve over time. For each metric it records the current measurement state, the target value, the measurement method, and the owner.

A feature may not be declared production-ready unless all "required before launch" metrics for that feature have a baseline measurement — even if that baseline is "we measured it and it is bad; here is the improvement plan."

---

## Measurement Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Measured and tracked in production |
| 🟡 | Partially measured or tracked on an ad-hoc basis |
| 🔴 | Not yet measured |

---

## 1. Citation Accuracy

**Definition:** The percentage of citations returned by the research engine and verification service that, when independently checked, point to a real, currently-valid legal source that actually supports the claim made.

| Attribute | Value |
|-----------|-------|
| Current status | 🔴 Needs measurement |
| Target | ≥ 95% of citations verified as real and on-point |
| Measurement method | Random sampling of production research outputs; manual legal review of N=50 citations per week; automated URL existence check; jurisdiction-validity check |
| Infrastructure required | Eval harness in `legal_backend/src/ai/eval/`; `SavedCitationReview` model; reviewer annotation UI |
| Owner | AI team |
| Priority | P0 — must measure before research feature is marketed to law firms |

**Instrumentation plan:**
1. Add `citationVerificationResult` field to the `AuditLog` entry for each research call.
2. Build a daily batch job that re-checks a random 5% of citations against their source URLs.
3. Track `citation_accuracy_rate` as a Prometheus counter, broken down by jurisdiction and source type.
4. Add to the weekly AI quality review dashboard.

---

## 2. Draft Acceptance Rate

**Definition:** The percentage of AI-generated document drafts that a user accepts without making substantive edits (defined as: no edits to more than 20% of generated text, measured at the section level).

| Attribute | Value |
|-----------|-------|
| Current status | 🔴 Needs measurement |
| Target | ≥ 70% section-level acceptance for India v1 (production engine); ≥ 75% for v2 |
| Measurement method | Track user edit events per section; compute `(sections accepted without edit) / (total sections shown)` |
| Infrastructure required | Front-end edit tracking events; `DraftSectionEditEvent` analytics event; backend aggregation |
| Owner | Product + AI team |
| Priority | P0 — must measure to validate v2 upgrade justification |

**Instrumentation plan:**
1. Emit `draft.section.accepted` and `draft.section.edited` product analytics events from the web drafting UI when a user confirms or edits a section.
2. Store edit deltas (character-level diff length as fraction of section length) in the analytics table.
3. Compute weekly acceptance rate by jurisdiction, document type, and engine version.
4. Surface in the AI command center dashboard.

---

## 3. Hallucination Rate

**Definition:** The percentage of AI-generated outputs (research memos, draft sections, issue analyses) that contain at least one factual claim that cannot be verified by any cited or retrievable source.

| Attribute | Value |
|-----------|-------|
| Current status | 🔴 Needs measurement |
| Target | ≤ 2% of outputs contain an unverifiable factual claim |
| Measurement method | Manual annotation of random sample (N=30/week per feature); automated claim extraction + citation matching via verification engine |
| Infrastructure required | Annotation tool (can be a simple admin UI); `HallucinationReport` model; eval cases in eval harness |
| Owner | AI team |
| Priority | P0 — hallucination in legal output is a liability risk |

**Instrumentation plan:**
1. Extend `section-verifier.service.ts` to emit a `verificationConfidenceScore` alongside each section.
2. Flag sections where `verificationConfidenceScore < 0.6` for manual review.
3. Build weekly report of flagged sections sent to AI team Slack channel.
4. Track `hallucination_flag_rate` (proxy metric) as Prometheus gauge.

---

## 4. Cost per Workflow

**Definition:** The average AI inference cost (in USD) per completed workflow, broken down by workflow type.

| Attribute | Value |
|-----------|-------|
| Current status | ✅ Tracked via `AICreditLedger` |
| Current tracking | Per-inference cost recorded by `ai-usage-recorder.service.ts` |
| Gaps | Per-workflow aggregation not yet implemented; no dashboard view |
| Target | Establish baseline in Q3 2026; reduce by 20% through model tiering and caching in Q4 2026 |
| Measurement method | Sum `AICreditLedger` entries by `workflowType` and `matterId`; normalise to USD |
| Owner | Engineering |
| Priority | P1 — cost tracking already exists; aggregation is a reporting improvement |

**Instrumentation plan:**
1. Add `workflowRunId` foreign key to `AICreditLedger` (requires Prisma migration).
2. Build aggregation query: `SELECT workflowType, AVG(totalCost), p50(totalCost), p95(totalCost) FROM AICreditLedger GROUP BY workflowType`.
3. Expose as `/admin/ai-costs/by-workflow` endpoint.
4. Render in the AI command center dashboard.

**Current baselines (to be measured):**

| Workflow | Estimated Cost Range | Target |
|----------|---------------------|--------|
| India document draft (full) | ~$0.15–$0.40 | < $0.25 |
| Legal research query | ~$0.05–$0.20 | < $0.10 |
| Document review (10-page doc) | ~$0.10–$0.30 | < $0.20 |
| Issue checker classification | ~$0.01–$0.05 | < $0.02 |

---

## 5. API Latency (p50 / p99)

**Definition:** Request latency at the 50th and 99th percentile for each major API route, measured from request receipt to response completion (excluding client network time).

| Attribute | Value |
|-----------|-------|
| Current status | 🔴 Needs systematic measurement per route |
| Target | See per-route targets below |
| Measurement method | HTTP middleware timing interceptor; export to Prometheus; visualise in Grafana |
| Infrastructure required | NestJS timing interceptor (may already exist); Prometheus histogram per route |
| Owner | Engineering |
| Priority | P1 |

**Per-route latency targets:**

| Route | p50 Target | p99 Target | Notes |
|-------|-----------|-----------|-------|
| `POST /ai/india-draft/section` | < 4s | < 15s | LLM latency dominates |
| `POST /ai/research` (sync) | < 3s | < 12s | Sync path only |
| `POST /consumers/classify` | < 2s | < 8s | |
| `POST /ai/document-review` | < 5s | < 20s | Depends on doc size |
| `GET /matters/:id` | < 100ms | < 300ms | No AI involved |
| `POST /matters` | < 200ms | < 500ms | |
| `GET /portal/*` | < 150ms | < 400ms | |
| Async job: India draft (full doc) | < 60s | < 180s | Queue worker latency |
| Async job: Research | < 30s | < 90s | Queue worker latency |

**Instrumentation plan:**
1. Add `TimingInterceptor` that records `route`, `method`, `durationMs`, `statusCode` as a Prometheus histogram.
2. Add queue job `startedAt` and `completedAt` timestamps to Bull job metadata.
3. Create Grafana dashboard with latency heatmaps per route.
4. Alert when p99 exceeds 2× target for 5 consecutive minutes.

---

## 6. User Edit Rate

**Definition:** The average number of character-level edits a user makes to an AI-generated output before saving or submitting it, normalised by output length. High edit rate = low quality.

| Attribute | Value |
|-----------|-------|
| Current status | 🔴 Needs measurement |
| Target | ≤ 15% of generated characters are replaced/deleted in a typical session |
| Measurement method | Front-end diff tracking between AI-generated text and user-submitted text; emit `draft.edit.delta` event |
| Infrastructure required | Client-side diff library; analytics event pipeline |
| Owner | Product + AI team |
| Priority | P2 — useful signal but not a launch blocker |

**Instrumentation plan:**
1. On draft section save, compute `levenshteinRatio(generated, saved)` client-side.
2. Emit `draft.edit.delta` event with `ratio`, `sectionType`, `documentType`, `jurisdiction`, `engine_version`.
3. Track weekly rolling average by segment.

---

## 7. Failure Rate

**Definition:** The percentage of AI workflow requests that result in an error (5xx response or queue job failure), broken down by feature and error type.

| Attribute | Value |
|-----------|-------|
| Current status | 🟡 Basic HTTP error rate tracked; queue job failure rate not aggregated |
| Target | < 1% failure rate for all production AI features |
| Measurement method | HTTP 5xx rate per route; Bull queue `failed` job count per queue name; error type breakdown |
| Infrastructure required | Prometheus counter for HTTP errors by route; Bull queue metrics exporter |
| Owner | Engineering |
| Priority | P1 |

**Instrumentation plan:**
1. Add Prometheus counter `api_errors_total{route, status_code, error_code}`.
2. Export Bull queue metrics (`waiting`, `active`, `failed`, `completed`) to Prometheus via `bull-board` or custom exporter.
3. Alert when failure rate for any route exceeds 2% for 10 consecutive minutes.
4. Track failure reasons: `llm_timeout`, `llm_rate_limit`, `context_too_long`, `verification_failed`, `db_error`.

---

## 8. AI Model Evaluation Coverage

**Definition:** The percentage of production AI features that have at least 3 automated evaluation cases in the eval harness.

| Attribute | Value |
|-----------|-------|
| Current status | 🔴 Eval harness skeleton exists; no wired evaluation cases |
| Target | 100% of P0 features covered before general availability |
| Features requiring eval cases | Research, India drafting v1, India drafting v2, document review, issue checker |
| Owner | AI team |
| Priority | P0 |

**P0 Feature Eval Requirements:**

| Feature | Min Eval Cases | Required Scenarios |
|---------|---------------|-------------------|
| Research | 5 | Simple query, complex multi-issue query, obscure jurisdiction, contradictory sources, stale source detection |
| India Drafting v1 | 5 | Employment agreement, NDA, service agreement, edge-case party names, jurisdiction-specific clause |
| India Drafting v2 | 5 | Same as v1; plus section-level verification pass/fail |
| Document Review | 4 | Standard contract, high-risk clause detection, multi-page doc, redline comparison |
| Issue Checker | 4 | Single clear issue, multi-issue, ambiguous situation, out-of-scope situation |

---

## 9. Security and Compliance Metrics

| Metric | Current Status | Target | Priority |
|--------|---------------|--------|---------|
| Auth bypass incidents | 🟡 Not systematically tracked | 0 per quarter | P0 |
| Tenant data leak incidents | 🟡 Not systematically tracked | 0 per quarter | P0 |
| Secret rotation compliance | 🔴 Manual | 100% of secrets rotated per policy | P1 |
| Dependency vulnerability age | 🔴 Not measured | 0 critical vulns > 30 days old | P1 |
| Audit log completeness | 🟡 Present for major features | 100% of user-facing AI outputs have an audit record | P0 |

---

## 10. Review Cadence

| Frequency | Review |
|-----------|--------|
| Daily | Failure rate alert check; cost anomaly check |
| Weekly | Citation accuracy sample review; draft acceptance rate report; hallucination flag review |
| Monthly | Full quality dashboard review; eval harness coverage check; cost per workflow trend |
| Quarterly | Red-team exercise (per Ch. 69); model accuracy calibration review; handbook vs implementation gap review |

---

## Appendix A — Metric Collection Infrastructure

| Tool | Purpose | Status |
|------|---------|--------|
| Prometheus | Metrics collection | 🟡 Deployed; not all metrics instrumented |
| Grafana | Dashboards | 🟡 Deployed; dashboards incomplete |
| Bull Board | Queue monitoring | 🟡 Available in dev; not in production |
| AI Eval Harness | `legal_backend/src/ai/eval/` | 🔴 Skeleton only |
| Product Analytics | Custom events via analytics module | 🟡 Infrastructure exists; coverage incomplete |
| `AICreditLedger` | Per-inference cost tracking | ✅ Production |

---

*Update this document whenever a metric moves from "needs measurement" to "being tracked." Record the date a baseline was first established in the Notes column.*
