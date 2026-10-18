-- Add authority bank fields to LegalAuthorityRecord
-- practiceArea: practice area tag for kind-based lookup (e.g. "Family", "Criminal")
-- draftKinds: array of draft kinds this authority is relevant for
-- autoDiscovered: true when added by the write-through pipeline (not manually seeded)

ALTER TABLE "LegalAuthorityRecord" ADD COLUMN IF NOT EXISTS "practiceArea" TEXT;
ALTER TABLE "LegalAuthorityRecord" ADD COLUMN IF NOT EXISTS "draftKinds" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "LegalAuthorityRecord" ADD COLUMN IF NOT EXISTS "autoDiscovered" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "LegalAuthorityRecord_practiceArea_idx" ON "LegalAuthorityRecord"("practiceArea");
CREATE INDEX IF NOT EXISTS "LegalAuthorityRecord_autoDiscovered_idx" ON "LegalAuthorityRecord"("autoDiscovered");
