-- Per-run research/drafting quality telemetry, recorded for every jurisdiction.
ALTER TABLE "AIUsageLog" ADD COLUMN IF NOT EXISTS "telemetry" JSONB;
