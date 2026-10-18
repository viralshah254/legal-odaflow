-- Add client/matter linking columns to CourtDraftRecord
ALTER TABLE "CourtDraftRecord" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "CourtDraftRecord" ADD COLUMN IF NOT EXISTS "matterId" TEXT;
ALTER TABLE "CourtDraftRecord" ADD COLUMN IF NOT EXISTS "linkedClientName" TEXT;
CREATE INDEX IF NOT EXISTS "CourtDraftRecord_clientId_idx" ON "CourtDraftRecord"("clientId");
