-- AlterTable Matter: add intake tracing + lifecycle fields
ALTER TABLE "Matter" ADD COLUMN IF NOT EXISTS "sourceLeadId" TEXT;
ALTER TABLE "Matter" ADD COLUMN IF NOT EXISTS "consumerCaseId" TEXT;
ALTER TABLE "Matter" ADD COLUMN IF NOT EXISTS "planningAnswers" JSONB;
ALTER TABLE "Matter" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

-- Indexes for Matter tracing fields
CREATE INDEX IF NOT EXISTS "Matter_tenantId_sourceLeadId_idx" ON "Matter"("tenantId", "sourceLeadId");
CREATE INDEX IF NOT EXISTS "Matter_tenantId_consumerCaseId_idx" ON "Matter"("tenantId", "consumerCaseId");

-- AlterTable Document: add generated doc fields
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "htmlContent" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "generatedFromTemplateId" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "aiDraftStatus" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "docxUrl" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "sourceConsumerDocId" TEXT;

-- Index for template-generated docs
CREATE INDEX IF NOT EXISTS "Document_generatedFromTemplateId_idx" ON "Document"("generatedFromTemplateId");
