-- CreateTable: DraftSectionFeedback
CREATE TABLE "DraftSectionFeedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentKind" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "rating" TEXT NOT NULL,
    "editCategories" TEXT[],
    "aiGeneratedText" TEXT NOT NULL,
    "userEditedText" TEXT,
    "editDistance" INTEGER NOT NULL DEFAULT 0,
    "editRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usedAsTraining" BOOLEAN NOT NULL DEFAULT false,
    "courtDraftRecordId" TEXT,
    "draftSectionV3Id" TEXT,
    "draftJobSectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftSectionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DraftSectionFeedback_tenantId_documentKind_sectionType_idx" ON "DraftSectionFeedback"("tenantId", "documentKind", "sectionType");
CREATE INDEX "DraftSectionFeedback_tenantId_usedAsTraining_idx" ON "DraftSectionFeedback"("tenantId", "usedAsTraining");
CREATE INDEX "DraftSectionFeedback_rating_idx" ON "DraftSectionFeedback"("rating");
CREATE INDEX "DraftSectionFeedback_createdAt_idx" ON "DraftSectionFeedback"("createdAt");

-- CreateTable: FirmDraftPreference
CREATE TABLE "FirmDraftPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentKind" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL,
    "exampleTexts" JSONB NOT NULL DEFAULT '[]',
    "avoidPatterns" TEXT[],
    "styleNotes" TEXT,
    "acceptanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmDraftPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FirmDraftPreference_tenantId_documentKind_sectionType_key" ON "FirmDraftPreference"("tenantId", "documentKind", "sectionType");
CREATE INDEX "FirmDraftPreference_tenantId_idx" ON "FirmDraftPreference"("tenantId");
