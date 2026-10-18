# Umbrella U34 migration and rollout notes

1. Apply [legal_backend/prisma/migrations/20261018_umbrella_u01_u10/migration.sql](legal_backend/prisma/migrations/20261018_umbrella_u01_u10/migration.sql) in non-production first.
2. Backfill `DraftJob.operation = 'draft_generate'` where null.
3. Conservatively mark pre-remediation verified sources as `needs-review` when audit shows field-presence promotion only.
4. Canary via `UNIFIED_DRAFT_ALLOWLIST_TENANTS` before raising `UNIFIED_DRAFT_ENGINE_PERCENT`.
5. Rollback routing flags only; do not re-enable client-writable verification audits.
