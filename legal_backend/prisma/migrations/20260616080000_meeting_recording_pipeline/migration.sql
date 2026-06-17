-- Meeting Recording Pipeline migration
-- Adds full recording metadata, confidentiality, audio storage, and participant fields to Meeting

ALTER TABLE "Meeting"
  ADD COLUMN IF NOT EXISTS "clientId"                   TEXT,
  ADD COLUMN IF NOT EXISTS "createdByUserId"            TEXT,
  ADD COLUMN IF NOT EXISTS "source"                     TEXT NOT NULL DEFAULT 'manual_recording',
  ADD COLUMN IF NOT EXISTS "confidentiality"            TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS "participants"               JSONB,
  ADD COLUMN IF NOT EXISTS "visibilityAllowListUserIds" JSONB,
  ADD COLUMN IF NOT EXISTS "durationMs"                 INTEGER,
  ADD COLUMN IF NOT EXISTS "audioStorageKey"            TEXT;

-- Migrate existing status values from uppercase ("SCHEDULED") to lowercase ("draft")
UPDATE "Meeting" SET "status" = 'draft' WHERE "status" = 'SCHEDULED';
ALTER TABLE "Meeting" ALTER COLUMN "status" SET DEFAULT 'draft';

-- Indexes for access-control lookups
CREATE INDEX IF NOT EXISTS "Meeting_clientId_idx" ON "Meeting"("clientId");
CREATE INDEX IF NOT EXISTS "Meeting_createdByUserId_idx" ON "Meeting"("createdByUserId");
