# Migration Runbook

Use this checklist before applying production database migrations.

## Preflight

- Confirm the migration has a reviewed rollback plan.
- Take a verified database backup and record the backup identifier.
- Run `npm run build` and the backend security regression tests.
- Run Prisma migration status against the target database.
- Confirm the release has a maintenance window or rollback owner.

## Apply

- Apply migrations from a single deployment runner.
- Watch `/health/readiness`, application logs, and database latency.
- Block traffic cutover if readiness is degraded for database checks.

## Rollback

- Prefer forward fixes for additive migrations.
- For destructive migrations, restore from the recorded backup only after approval.
- Record the incident, affected tenants, and follow-up action items.
