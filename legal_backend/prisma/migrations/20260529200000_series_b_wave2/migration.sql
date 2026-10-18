-- Document OCR text for tenant documents
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "extractedText" TEXT;

-- Questionnaire builder for document automation
CREATE TABLE IF NOT EXISTS "Questionnaire" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Questionnaire_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Questionnaire_tenantId_idx" ON "Questionnaire"("tenantId");
CREATE INDEX IF NOT EXISTS "Questionnaire_templateId_idx" ON "Questionnaire"("templateId");

DO $$ BEGIN
    ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Questionnaire" ADD CONSTRAINT "Questionnaire_templateId_fkey"
        FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
