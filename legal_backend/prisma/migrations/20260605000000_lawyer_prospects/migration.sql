-- CreateTable
CREATE TABLE "ProspectImportRun" (
    "id" TEXT NOT NULL,
    "batchLabel" TEXT NOT NULL,
    "sourceSummary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ProspectImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawyerProspect" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "organisation" TEXT,
    "practiceAreas" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "whatsappConfidence" TEXT,
    "email" TEXT,
    "emailConfidence" TEXT,
    "website" TEXT,
    "profileUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'import',
    "dedupeKey" TEXT NOT NULL,
    "outreachStatus" TEXT NOT NULL DEFAULT 'NEW',
    "importRunId" TEXT,
    "scrapedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LawyerProspect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LawyerProspect_dedupeKey_key" ON "LawyerProspect"("dedupeKey");

-- CreateIndex
CREATE INDEX "LawyerProspect_country_idx" ON "LawyerProspect"("country");

-- CreateIndex
CREATE INDEX "LawyerProspect_source_idx" ON "LawyerProspect"("source");

-- CreateIndex
CREATE INDEX "LawyerProspect_outreachStatus_idx" ON "LawyerProspect"("outreachStatus");

-- CreateIndex
CREATE INDEX "LawyerProspect_email_idx" ON "LawyerProspect"("email");

-- CreateIndex
CREATE INDEX "LawyerProspect_phone_idx" ON "LawyerProspect"("phone");

-- CreateIndex
CREATE INDEX "LawyerProspect_importRunId_idx" ON "LawyerProspect"("importRunId");

-- CreateIndex
CREATE INDEX "ProspectImportRun_status_idx" ON "ProspectImportRun"("status");

-- CreateIndex
CREATE INDEX "ProspectImportRun_startedAt_idx" ON "ProspectImportRun"("startedAt");

-- AddForeignKey
ALTER TABLE "LawyerProspect" ADD CONSTRAINT "LawyerProspect_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ProspectImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
