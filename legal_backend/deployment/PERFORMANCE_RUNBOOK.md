# Performance Runbook

## Web

- Profile dashboard, matters, documents, finance, and AI Command Center before release.
- Watch bundle size changes on high-traffic routes.
- Prefer paginated or scoped API calls for documents, matters, tasks, and audit logs.

## Backend

- Track latency for search, uploads, AI jobs, OCR workers, billing, and portal endpoints.
- Use `/health/readiness` for uptime probes and dependency status.
- Keep queue workers observable by job type, status, attempts, and completion time.

## Mobile

- Measure cold start, auth bootstrap, token refresh, and first dashboard render.
- Keep consumer and lawyer dashboards lightweight; defer heavy case/matter detail fetches.

## Release Gate

- No P0 route should regress by more than 20% without an owner and rollback note.
