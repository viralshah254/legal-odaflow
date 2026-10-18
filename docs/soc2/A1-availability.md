# A1 — Availability

**Version:** 1.0  
**Last Updated:** 2026-06-18  
**Owner:** Engineering Lead  

---

## A1.1 — Availability Commitment

| Tier | Target Uptime | Max Downtime/Month |
|------|--------------|-------------------|
| Production API | 99.9% | ~44 minutes |
| AI processing (best-effort) | 99.5% | ~3.6 hours |

Planned maintenance is performed during off-peak hours (Sunday 02:00–04:00 UTC) and announced ≥ 48 hours in advance.

## A1.2 — Infrastructure Redundancy

### Compute
- Production API runs in a Docker Swarm cluster with minimum 2 replicas per service.
- Automatic restart policy on container failure.
- Load balancer distributes traffic across healthy replicas.

### Database (PostgreSQL)
- Primary + 1 read replica minimum in production.
- Automated daily backups with 30-day retention.
- Point-in-time recovery (PITR) enabled with 1-hour granularity.
- Backup restoration is tested quarterly.

### Cache (Redis)
- Redis Sentinel or Redis Cluster for HA.
- All BullMQ queue data is persistent (AOF enabled).
- Failure of Redis causes graceful degradation: AI jobs are queued in-process and retried when Redis recovers.

### Background Workers
- Worker processes are run separately from the API process.
- BullMQ retries failed jobs up to 3 times with exponential back-off.
- Dead letter queue retains failed jobs for 7 days for manual inspection.

## A1.3 — Disaster Recovery

| Metric | Target |
|--------|--------|
| Recovery Time Objective (RTO) | 4 hours |
| Recovery Point Objective (RPO) | 1 hour |

**DR procedure:**
1. Detect outage via uptime monitoring alert (< 2 minutes)
2. Assess scope: is it a code issue, infrastructure issue, or data issue?
3. Activate DR runbook (see `deployment/MIGRATION_RUNBOOK.md`)
4. If primary region is unavailable, promote read replica to primary
5. Point DNS to standby environment
6. Verify health endpoints and run smoke tests
7. Communicate with customers via status page

## A1.4 — Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Overall API health (DB connectivity, Redis, disk) |
| `GET /health/db` | Database connection check |
| `GET /health/redis` | Redis connection check |

Health check responses are monitored externally (Uptime Robot, BetterUptime, or equivalent) from at least 3 geographic locations.

## A1.5 — Capacity Planning

Infrastructure capacity is reviewed quarterly based on:
- Month-over-month tenant growth
- AI token usage trends
- Database storage growth rate
- Background job queue depth

Auto-scaling is configured for compute; database scaling requires a planned maintenance window.

---

*SLA metrics are reported monthly to the leadership team. DR test is conducted semi-annually.*
