-- CreateTable
CREATE TABLE "SystemDocumentTemplate" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "practiceArea" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL_TEMPLATE',
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "matterType" TEXT,
    "documentKind" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemDocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "DocumentTemplate" ADD COLUMN "countryCode" TEXT,
ADD COLUMN "practiceArea" TEXT,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'CUSTOM',
ADD COLUMN "systemTemplateId" TEXT;

-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN "primaryPracticeArea" TEXT,
ADD COLUMN "templatesLibraryProvisionedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SystemDocumentTemplate_countryCode_practiceArea_idx" ON "SystemDocumentTemplate"("countryCode", "practiceArea");

-- CreateIndex
CREATE UNIQUE INDEX "SystemDocumentTemplate_countryCode_practiceArea_name_key" ON "SystemDocumentTemplate"("countryCode", "practiceArea", "name");

-- CreateIndex
CREATE INDEX "DocumentTemplate_tenantId_practiceArea_idx" ON "DocumentTemplate"("tenantId", "practiceArea");

-- CreateIndex
CREATE INDEX "DocumentTemplate_systemTemplateId_idx" ON "DocumentTemplate"("systemTemplateId");

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_systemTemplateId_fkey" FOREIGN KEY ("systemTemplateId") REFERENCES "SystemDocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
