-- AlterTable: DraftSectionFeedback — verification + model attribution
ALTER TABLE "DraftSectionFeedback" ADD COLUMN IF NOT EXISTS "verificationOutcome" TEXT;
ALTER TABLE "DraftSectionFeedback" ADD COLUMN IF NOT EXISTS "modelUsed" TEXT;

-- AlterTable: FirmDraftPreference — accuracy patterns + anti-examples
ALTER TABLE "FirmDraftPreference" ADD COLUMN IF NOT EXISTS "accuracyPatterns" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "FirmDraftPreference" ADD COLUMN IF NOT EXISTS "antiExamples" JSONB NOT NULL DEFAULT '[]';

-- CreateTable: DraftVerificationOutcome
CREATE TABLE IF NOT EXISTS "DraftVerificationOutcome" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "documentKind" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "courtDraftRecordId" TEXT,
    "draftJobId" TEXT,
    "verificationStatus" TEXT NOT NULL,
    "findings" JSONB NOT NULL DEFAULT '[]',
    "strippedCitations" JSONB NOT NULL DEFAULT '[]',
    "claimFailures" JSONB NOT NULL DEFAULT '[]',
    "repairAttempted" BOOLEAN NOT NULL DEFAULT false,
    "repairSucceeded" BOOLEAN NOT NULL DEFAULT false,
    "regenAttempts" INTEGER NOT NULL DEFAULT 0,
    "modelUsed" TEXT,
    "usedAsTraining" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftVerificationOutcome_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DraftVerificationOutcome_tenantId_documentKind_idx" ON "DraftVerificationOutcome"("tenantId", "documentKind");
CREATE INDEX IF NOT EXISTS "DraftVerificationOutcome_tenantId_usedAsTraining_idx" ON "DraftVerificationOutcome"("tenantId", "usedAsTraining");
CREATE INDEX IF NOT EXISTS "DraftVerificationOutcome_createdAt_idx" ON "DraftVerificationOutcome"("createdAt");

-- CreateTable: DraftCorrectionSignal
CREATE TABLE IF NOT EXISTS "DraftCorrectionSignal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "documentKind" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'IN',
    "wrongCitation" TEXT NOT NULL,
    "correctCitation" TEXT NOT NULL,
    "wrongSection" TEXT,
    "correctSection" TEXT,
    "authorityIdWrong" TEXT,
    "authorityIdCorrect" TEXT,
    "courtDraftRecordId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewNotes" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftCorrectionSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DraftCorrectionSignal_countryCode_status_idx" ON "DraftCorrectionSignal"("countryCode", "status");
CREATE INDEX IF NOT EXISTS "DraftCorrectionSignal_documentKind_status_idx" ON "DraftCorrectionSignal"("documentKind", "status");
CREATE INDEX IF NOT EXISTS "DraftCorrectionSignal_status_idx" ON "DraftCorrectionSignal"("status");
CREATE INDEX IF NOT EXISTS "DraftCorrectionSignal_tenantId_idx" ON "DraftCorrectionSignal"("tenantId");

-- CreateTable: AuthorityTrustScore
CREATE TABLE IF NOT EXISTS "AuthorityTrustScore" (
    "id" TEXT NOT NULL,
    "authorityId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'IN',
    "timesCited" INTEGER NOT NULL DEFAULT 0,
    "timesVerified" INTEGER NOT NULL DEFAULT 0,
    "timesStripped" INTEGER NOT NULL DEFAULT 0,
    "timesUserRemoved" INTEGER NOT NULL DEFAULT 0,
    "timesUserReadded" INTEGER NOT NULL DEFAULT 0,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorityTrustScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthorityTrustScore_authorityId_countryCode_key" ON "AuthorityTrustScore"("authorityId", "countryCode");
CREATE INDEX IF NOT EXISTS "AuthorityTrustScore_countryCode_trustScore_idx" ON "AuthorityTrustScore"("countryCode", "trustScore");

-- CreateTable: AzureFineTuneJob
CREATE TABLE IF NOT EXISTS "AzureFineTuneJob" (
    "id" TEXT NOT NULL,
    "documentKind" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL,
    "baseModel" TEXT NOT NULL,
    "azureJobId" TEXT,
    "fineTunedModel" TEXT,
    "deploymentName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "holdoutScore" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "modelAlias" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AzureFineTuneJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AzureFineTuneJob_status_idx" ON "AzureFineTuneJob"("status");
CREATE INDEX IF NOT EXISTS "AzureFineTuneJob_documentKind_sectionType_idx" ON "AzureFineTuneJob"("documentKind", "sectionType");
