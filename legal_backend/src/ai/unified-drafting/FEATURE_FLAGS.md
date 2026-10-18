# Unified Drafting Engine — Feature Flags

## Rollout Controls

| Flag | Type | Default | Effect |
|---|---|---|---|
| `UNIFIED_DRAFT_ENGINE_ENABLED` | `true\|false` | `false` | Master switch. Must be `true` for any routing to occur. |
| `UNIFIED_DRAFT_ENGINE_PERCENT` | `0–100` | `0` | Percentage of requests routed to the unified engine. Uses stable per-user hash so the same user always routes consistently. |
| `SHADOW_EVALUATION_PERCENT` | `0–100` | `2` | Percentage of v1-routed drafts that also run v2 in shadow mode for quality comparison. |
| `DRAFT_ENGINE_V2` | `true\|false` | `false` | Legacy: route all India drafts through v2 engine (not unified). |
| `DRAFT_ENGINE_V2_PER_KIND` | `true\|false` | `false` | Legacy: route specific document kinds to v2. |
| `DRAFT_ENGINE_V2_SHADOW` | `true\|false` | `false` | Legacy: shadow mode for v2. Controlled by `SHADOW_EVALUATION_PERCENT` when true. |

## Recommended Rollout Stages

```
Stage 0 (internal):
  UNIFIED_DRAFT_ENGINE_ENABLED=true
  UNIFIED_DRAFT_ENGINE_PERCENT=0
  SHADOW_EVALUATION_PERCENT=2
  → No users affected. Shadow runs on 2% of traffic for quality measurement.

Stage 1 (internal users):
  UNIFIED_DRAFT_ENGINE_PERCENT=5
  → Internal team users route to unified engine.

Stage 2 (canary):
  UNIFIED_DRAFT_ENGINE_PERCENT=10
  → 10% of all users. Monitor latency, cost, citation accuracy.

Stage 3 (expanded):
  UNIFIED_DRAFT_ENGINE_PERCENT=50
  → A/B comparison. Run golden set evaluation.

Stage 4 (full):
  UNIFIED_DRAFT_ENGINE_PERCENT=100
  → All users on unified engine.
  → Retire DRAFT_ENGINE_V2 and DRAFT_ENGINE_V2_SHADOW flags.
```

## Rollback

Set `UNIFIED_DRAFT_ENGINE_ENABLED=false` to instantly route all traffic back to the legacy path without data loss. Completed jobs remain accessible at `GET /draft-jobs/:jobId`.

## Quality Gates Before Each Stage Increase

- P50 latency for standard 10-page filing < 35 s
- P95 latency < 75 s
- Citation accuracy on golden set ≥ parity with legacy
- Zero certified drafts with unresolved critical issues
- Premium model usage < 10% of standard-tier jobs
- Full-document regeneration < 5% of jobs
