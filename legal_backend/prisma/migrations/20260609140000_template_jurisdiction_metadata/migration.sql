-- Template jurisdiction metadata and denormalized documentKind on tenant copies
ALTER TABLE "SystemDocumentTemplate" ADD COLUMN IF NOT EXISTS "jurisdiction" TEXT;
ALTER TABLE "SystemDocumentTemplate" ADD COLUMN IF NOT EXISTS "conditionalFields" JSONB;

ALTER TABLE "DocumentTemplate" ADD COLUMN IF NOT EXISTS "documentKind" TEXT;
ALTER TABLE "DocumentTemplate" ADD COLUMN IF NOT EXISTS "jurisdiction" TEXT;
ALTER TABLE "DocumentTemplate" ADD COLUMN IF NOT EXISTS "conditionalFields" JSONB;

CREATE INDEX IF NOT EXISTS "DocumentTemplate_tenantId_countryCode_documentKind_idx"
  ON "DocumentTemplate"("tenantId", "countryCode", "documentKind");

CREATE INDEX IF NOT EXISTS "SystemDocumentTemplate_countryCode_documentKind_idx"
  ON "SystemDocumentTemplate"("countryCode", "documentKind");

-- Backfill documentKind on tenant copies from linked system templates
UPDATE "DocumentTemplate" dt
SET "documentKind" = st."documentKind",
    "jurisdiction" = st."jurisdiction",
    "conditionalFields" = st."conditionalFields"
FROM "SystemDocumentTemplate" st
WHERE dt."systemTemplateId" = st.id
  AND dt."documentKind" IS NULL;
