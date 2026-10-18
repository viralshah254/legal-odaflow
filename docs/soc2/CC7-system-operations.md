# CC7 — System Operations

**Version:** 1.0  
**Last Updated:** 2026-06-18  
**Owner:** Engineering Lead  

---

## CC7.1 — Vulnerability Detection

- **Dependency scanning:** `npm audit` and `dependabot` run on every PR and weekly on `main`.
- **Container scanning:** Docker images are scanned via Trivy on every build.
- **SAST:** Static analysis (ESLint security plugin, TypeScript strict mode) runs in CI.
- **Penetration testing:** Annual third-party pentest is contracted. Findings are tracked to closure.
- **OWASP Top 10:** All API endpoints are tested against the OWASP Top 10 as part of quarterly security reviews.

Critical/High vulnerabilities must be remediated within:
- **Critical:** 24 hours
- **High:** 7 days
- **Medium:** 30 days
- **Low:** Next planned release cycle

## CC7.2 — Monitoring and Alerting

### Application monitoring

- **Error tracking:** Sentry captures all unhandled exceptions with full stack traces, user context, and release version.
- **Uptime monitoring:** Synthetic health check pings `/health` every 60 seconds from 3 regions.
- **Alerting:** PagerDuty escalation triggers on:
  - 5xx rate > 1% for 2 minutes
  - P99 response time > 5 seconds for 5 minutes
  - Failed background worker jobs (BullMQ dead letter queue)
  - Redis connection loss

### Security event monitoring

- All `POST /auth/*` endpoints log authentication events to `AuditLog`.
- `401 / 403` rates are monitored; spikes trigger a security alert within 5 minutes.
- Failed login attempts > 5 in 60 seconds trigger rate limiting (ThrottlerGuard).

## CC7.3 — Incident Response

### Severity classification

| Severity | Definition | Response Time |
|----------|-----------|--------------|
| P0 | Data breach, system down | 15 minutes |
| P1 | Major feature degraded, potential data exposure | 1 hour |
| P2 | Significant degradation, no data risk | 4 hours |
| P3 | Minor issue, workaround available | 24 hours |

### Response procedure

1. **Detect:** Alert fires via Sentry, PagerDuty, or user report.
2. **Classify:** On-call engineer classifies severity within 15 minutes.
3. **Contain:** Isolate affected service, roll back if required.
4. **Notify:** P0/P1 — customers and stakeholders notified within 1 hour. Regulatory notification per jurisdiction law (typically 72 hours for GDPR/DPA breaches).
5. **Remediate:** Root cause addressed with code fix, configuration change, or process update.
6. **Post-mortem:** Written within 5 business days. Action items tracked to closure.
7. **Evidence:** All steps logged to incident tracker and linked to AuditLog entries.

## CC7.4 — Background Job Failure Alerting

All background workers (BullMQ) are monitored:

- Failed jobs are retained in the dead letter queue for 7 days.
- Job failure rate > 5% triggers a PagerDuty alert.
- Monitor scan workers (`MonitorScanScheduler`) and data retention workers (`DataRetentionWorker`) failures are logged to `AuditLog` with `action: SCHEDULER_FAILURE`.

---

*Reviewed quarterly. Incident post-mortems are kept for 3 years.*
