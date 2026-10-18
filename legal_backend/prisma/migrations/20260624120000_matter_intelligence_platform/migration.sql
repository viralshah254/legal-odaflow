-- Matter Intelligence Platform v2 — profile/graph/taskGraph + form metadata + selection events

-- Ensure JurisdictionForm exists before ALTER (table may predate migration history)
CREATE TABLE IF NOT EXISTS "JurisdictionForm" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT,
  "countryCode"  TEXT NOT NULL,
  "jurisdiction" TEXT,
  "practiceArea" TEXT NOT NULL,
  "formName"     TEXT NOT NULL,
  "formNumber"   TEXT,
  "authority"    TEXT NOT NULL,
  "sourceUrl"    TEXT NOT NULL,
  "description"  TEXT,
  "category"     TEXT,
  "feeInfo"      TEXT,
  "isSystem"     BOOLEAN NOT NULL DEFAULT true,
  "lastUpdated"  TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JurisdictionForm_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "JurisdictionForm_countryCode_practiceArea_idx" ON "JurisdictionForm"("countryCode", "practiceArea");
CREATE INDEX IF NOT EXISTS "JurisdictionForm_countryCode_jurisdiction_idx" ON "JurisdictionForm"("countryCode", "jurisdiction");

ALTER TABLE "ConsumerCase" ADD COLUMN IF NOT EXISTS "matterProfile" JSONB;
ALTER TABLE "ConsumerCase" ADD COLUMN IF NOT EXISTS "matterGraph" JSONB;
ALTER TABLE "ConsumerCase" ADD COLUMN IF NOT EXISTS "matterTaskGraph" JSONB;

ALTER TABLE "Matter" ADD COLUMN IF NOT EXISTS "matterProfile" JSONB;
ALTER TABLE "Matter" ADD COLUMN IF NOT EXISTS "matterGraph" JSONB;
ALTER TABLE "Matter" ADD COLUMN IF NOT EXISTS "matterTaskGraph" JSONB;

ALTER TABLE "DraftingSession" ADD COLUMN IF NOT EXISTS "matterProfile" JSONB;
ALTER TABLE "DraftingSession" ADD COLUMN IF NOT EXISTS "matterGraph" JSONB;
ALTER TABLE "DraftingSession" ADD COLUMN IF NOT EXISTS "matterTaskGraph" JSONB;

ALTER TABLE "JurisdictionForm" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE TABLE IF NOT EXISTS "MatterIntelligenceEvent" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "matterProfileHash" TEXT NOT NULL,
  "practiceArea" TEXT NOT NULL,
  "subPracticeArea" TEXT,
  "nature" TEXT NOT NULL,
  "documentId" TEXT,
  "documentKind" TEXT,
  "tenantId" TEXT,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatterIntelligenceEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MatterIntelligenceEvent_matterProfileHash_eventType_idx"
  ON "MatterIntelligenceEvent"("matterProfileHash", "eventType");
CREATE INDEX IF NOT EXISTS "MatterIntelligenceEvent_practiceArea_subPracticeArea_idx"
  ON "MatterIntelligenceEvent"("practiceArea", "subPracticeArea");
CREATE INDEX IF NOT EXISTS "MatterIntelligenceEvent_tenantId_createdAt_idx"
  ON "MatterIntelligenceEvent"("tenantId", "createdAt");
