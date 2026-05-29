-- Transformation Spec Phases 0-1: compliance, training governance, legal sources, AI cost tracking

-- CreateTable
CREATE TABLE "CountryCompliancePolicy" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "allowConsumerGuidance" BOOLEAN NOT NULL DEFAULT true,
    "allowDocumentGeneration" BOOLEAN NOT NULL DEFAULT true,
    "allowLawyerMarketplace" BOOLEAN NOT NULL DEFAULT true,
    "requireLawyerReviewForAdvice" BOOLEAN NOT NULL DEFAULT true,
    "requireDisclaimerOnEveryOutput" BOOLEAN NOT NULL DEFAULT true,
    "allowTrainingOptIn" BOOLEAN NOT NULL DEFAULT true,
    "requireExplicitTrainingConsent" BOOLEAN NOT NULL DEFAULT true,
    "allowAutomatedDecisioning" BOOLEAN NOT NULL DEFAULT false,
    "restrictedPhrases" JSONB,
    "approvedProductLabels" JSONB,
    "dataResidencyRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultDataRegion" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountryCompliancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT,
    "scope" TEXT NOT NULL,
    "consentStatus" TEXT NOT NULL DEFAULT 'DENIED',
    "consentTextVersion" TEXT NOT NULL DEFAULT '1.0',
    "jurisdictionCountryCode" TEXT NOT NULL,
    "canUseForPromptImprove" BOOLEAN NOT NULL DEFAULT false,
    "canUseForEvaluation" BOOLEAN NOT NULL DEFAULT false,
    "canUseForFineTuning" BOOLEAN NOT NULL DEFAULT false,
    "requiresAnonymization" BOOLEAN NOT NULL DEFAULT true,
    "grantedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingConsentAuditLog" (
    "id" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingConsentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTrainingPermission" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT,
    "allowedForTraining" BOOLEAN NOT NULL DEFAULT false,
    "allowedForEvaluation" BOOLEAN NOT NULL DEFAULT false,
    "allowedForAnonymizedAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "consentId" TEXT,
    "anonymizationStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "redactionStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "approvedForDataset" BOOLEAN NOT NULL DEFAULT false,
    "approvedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTrainingPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnonymizationJob" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "piiDetected" JSONB,
    "redactionMap" JSONB,
    "outputText" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AnonymizationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingDataset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "datasetType" TEXT NOT NULL,
    "countryCode" TEXT,
    "practiceArea" TEXT,
    "issueType" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "sourcePolicy" TEXT,
    "createdById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingDatasetItem" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "inputText" TEXT NOT NULL,
    "expectedOutput" TEXT,
    "metadata" JSONB,
    "consentId" TEXT,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingDatasetItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalSource" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "baseUrl" TEXT,
    "apiAvailable" BOOLEAN NOT NULL DEFAULT false,
    "scrapingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "licenseTerms" TEXT,
    "refreshFrequency" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentHash" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentHash_pkey" PRIMARY KEY ("id")
);

-- CreateTable (text-only; no pgvector embedding column)
CREATE TABLE "EmbeddingChunk" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "countryCode" TEXT,
    "jurisdiction" TEXT,
    "modelName" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AICreditLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT,
    "eventType" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "costUsd" DECIMAL(10,4),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AICreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIBudgetPolicy" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT,
    "monthlyBudgetUsd" DECIMAL(10,2),
    "dailyBudgetUsd" DECIMAL(10,2),
    "maxCostPerTaskUsd" DECIMAL(10,4),
    "alertAtPercent" INTEGER NOT NULL DEFAULT 80,
    "hardStopAtPercent" INTEGER NOT NULL DEFAULT 100,
    "mrrUsd" DECIMAL(10,2),
    "targetNetMargin" DECIMAL(4,2) NOT NULL DEFAULT 0.40,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIBudgetPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitEconomicsSnapshot" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "avgRevenue" DECIMAL(10,2) NOT NULL,
    "avgAiCost" DECIMAL(10,4) NOT NULL,
    "avgServerCost" DECIMAL(10,4) NOT NULL,
    "avgPaymentFee" DECIMAL(10,4) NOT NULL,
    "avgGrossMargin" DECIMAL(10,4) NOT NULL,
    "avgNetMargin" DECIMAL(10,4) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitEconomicsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CountryCompliancePolicy_countryCode_key" ON "CountryCompliancePolicy"("countryCode");

-- CreateIndex
CREATE INDEX "TrainingConsent_userId_idx" ON "TrainingConsent"("userId");

-- CreateIndex
CREATE INDEX "TrainingConsent_tenantId_idx" ON "TrainingConsent"("tenantId");

-- CreateIndex
CREATE INDEX "TrainingConsent_consentStatus_idx" ON "TrainingConsent"("consentStatus");

-- CreateIndex
CREATE INDEX "TrainingConsentAuditLog_consentId_idx" ON "TrainingConsentAuditLog"("consentId");

-- CreateIndex
CREATE INDEX "DocumentTrainingPermission_documentId_idx" ON "DocumentTrainingPermission"("documentId");

-- CreateIndex
CREATE INDEX "DocumentTrainingPermission_tenantId_idx" ON "DocumentTrainingPermission"("tenantId");

-- CreateIndex
CREATE INDEX "AnonymizationJob_sourceType_sourceId_idx" ON "AnonymizationJob"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "AnonymizationJob_status_idx" ON "AnonymizationJob"("status");

-- CreateIndex
CREATE INDEX "TrainingDataset_datasetType_idx" ON "TrainingDataset"("datasetType");

-- CreateIndex
CREATE INDEX "TrainingDataset_countryCode_idx" ON "TrainingDataset"("countryCode");

-- CreateIndex
CREATE INDEX "TrainingDatasetItem_datasetId_idx" ON "TrainingDatasetItem"("datasetId");

-- CreateIndex
CREATE INDEX "TrainingDatasetItem_consentId_idx" ON "TrainingDatasetItem"("consentId");

-- CreateIndex
CREATE INDEX "LegalSource_countryCode_idx" ON "LegalSource"("countryCode");

-- CreateIndex
CREATE INDEX "LegalSource_enabled_idx" ON "LegalSource"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ContentHash_hash_key" ON "ContentHash"("hash");

-- CreateIndex
CREATE INDEX "ContentHash_sourceType_sourceId_idx" ON "ContentHash"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddingChunk_sourceType_sourceId_chunkIndex_modelName_key" ON "EmbeddingChunk"("sourceType", "sourceId", "chunkIndex", "modelName");

-- CreateIndex
CREATE INDEX "EmbeddingChunk_countryCode_idx" ON "EmbeddingChunk"("countryCode");

-- CreateIndex
CREATE INDEX "EmbeddingChunk_contentHash_idx" ON "EmbeddingChunk"("contentHash");

-- CreateIndex
CREATE INDEX "AICreditLedger_userId_idx" ON "AICreditLedger"("userId");

-- CreateIndex
CREATE INDEX "AICreditLedger_tenantId_idx" ON "AICreditLedger"("tenantId");

-- CreateIndex
CREATE INDEX "AICreditLedger_createdAt_idx" ON "AICreditLedger"("createdAt");

-- CreateIndex
CREATE INDEX "AIBudgetPolicy_tenantId_idx" ON "AIBudgetPolicy"("tenantId");

-- CreateIndex
CREATE INDEX "AIBudgetPolicy_userId_idx" ON "AIBudgetPolicy"("userId");

-- CreateIndex
CREATE INDEX "UnitEconomicsSnapshot_countryCode_planKey_idx" ON "UnitEconomicsSnapshot"("countryCode", "planKey");

-- CreateIndex
CREATE INDEX "UnitEconomicsSnapshot_periodStart_idx" ON "UnitEconomicsSnapshot"("periodStart");

-- AddForeignKey
ALTER TABLE "TrainingConsent" ADD CONSTRAINT "TrainingConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingConsent" ADD CONSTRAINT "TrainingConsent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingConsentAuditLog" ADD CONSTRAINT "TrainingConsentAuditLog_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "TrainingConsent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTrainingPermission" ADD CONSTRAINT "DocumentTrainingPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTrainingPermission" ADD CONSTRAINT "DocumentTrainingPermission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingDatasetItem" ADD CONSTRAINT "TrainingDatasetItem_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "TrainingDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingDatasetItem" ADD CONSTRAINT "TrainingDatasetItem_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "TrainingConsent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICreditLedger" ADD CONSTRAINT "AICreditLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AICreditLedger" ADD CONSTRAINT "AICreditLedger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIBudgetPolicy" ADD CONSTRAINT "AIBudgetPolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIBudgetPolicy" ADD CONSTRAINT "AIBudgetPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
