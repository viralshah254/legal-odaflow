-- Full platform operational schema additions

CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "taskReminders" BOOLEAN NOT NULL DEFAULT true,
    "billingAlerts" BOOLEAN NOT NULL DEFAULT true,
    "trustApprovalAlerts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MatterParty" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MatterParty_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MatterParty_matterId_idx" ON "MatterParty"("matterId");
CREATE INDEX "MatterParty_tenantId_idx" ON "MatterParty"("tenantId");
ALTER TABLE "MatterParty" ADD CONSTRAINT "MatterParty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatterParty" ADD CONSTRAINT "MatterParty_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ConflictCheck" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    "matterId" TEXT,
    "leadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "parties" JSONB,
    "result" JSONB,
    "checkedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConflictCheck_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ConflictCheck_tenantId_idx" ON "ConflictCheck"("tenantId");
CREATE INDEX "ConflictCheck_status_idx" ON "ConflictCheck"("status");
ALTER TABLE "ConflictCheck" ADD CONSTRAINT "ConflictCheck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MatterOutcomeAnalysis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "portalVisible" BOOLEAN NOT NULL DEFAULT false,
    "portalSummary" TEXT,
    "portalOutlookLabel" TEXT,
    "overallBand" TEXT NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    "confidence" TEXT NOT NULL DEFAULT 'LOW',
    "winProbability" JSONB,
    "lossProbability" JSONB,
    "settlementProbability" JSONB,
    "scenarios" JSONB,
    "factorsFor" JSONB,
    "factorsAgainst" JSONB,
    "solutions" JSONB,
    "missingEvidence" JSONB,
    "citations" JSONB,
    "disclaimers" JSONB,
    "aiOutputId" TEXT,
    "createdBy" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MatterOutcomeAnalysis_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MatterOutcomeAnalysis_matterId_idx" ON "MatterOutcomeAnalysis"("matterId");
CREATE INDEX "MatterOutcomeAnalysis_tenantId_status_idx" ON "MatterOutcomeAnalysis"("tenantId", "status");
ALTER TABLE "MatterOutcomeAnalysis" ADD CONSTRAINT "MatterOutcomeAnalysis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatterOutcomeAnalysis" ADD CONSTRAINT "MatterOutcomeAnalysis_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RateTable" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "rates" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateTable_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RateTable_tenantId_idx" ON "RateTable"("tenantId");
ALTER TABLE "RateTable" ADD CONSTRAINT "RateTable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CourtCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "courtName" TEXT,
    "caseNumber" TEXT,
    "cnrNumber" TEXT,
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourtCase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CourtCase_matterId_idx" ON "CourtCase"("matterId");
CREATE INDEX "CourtCase_tenantId_idx" ON "CourtCase"("tenantId");
ALTER TABLE "CourtCase" ADD CONSTRAINT "CourtCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourtCase" ADD CONSTRAINT "CourtCase_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CourtHearing" (
    "id" TEXT NOT NULL,
    "courtCaseId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "hearingType" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourtHearing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CourtHearing_courtCaseId_idx" ON "CourtHearing"("courtCaseId");
ALTER TABLE "CourtHearing" ADD CONSTRAINT "CourtHearing_courtCaseId_fkey" FOREIGN KEY ("courtCaseId") REFERENCES "CourtCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CourtFiling" (
    "id" TEXT NOT NULL,
    "courtCaseId" TEXT NOT NULL,
    "filedAt" TIMESTAMP(3),
    "filingType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourtFiling_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CourtFiling_courtCaseId_idx" ON "CourtFiling"("courtCaseId");
ALTER TABLE "CourtFiling" ADD CONSTRAINT "CourtFiling_courtCaseId_fkey" FOREIGN KEY ("courtCaseId") REFERENCES "CourtCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DocketEntry" (
    "id" TEXT NOT NULL,
    "courtCaseId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "source" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocketEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DocketEntry_courtCaseId_idx" ON "DocketEntry"("courtCaseId");
ALTER TABLE "DocketEntry" ADD CONSTRAINT "DocketEntry_courtCaseId_fkey" FOREIGN KEY ("courtCaseId") REFERENCES "CourtCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "scopes" JSONB,
    "config" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IntegrationConnection_tenantId_provider_key" ON "IntegrationConnection"("tenantId", "provider");
CREATE INDEX "IntegrationConnection_tenantId_idx" ON "IntegrationConnection"("tenantId");
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DocumentShareLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentShareLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentShareLink_token_key" ON "DocumentShareLink"("token");
CREATE INDEX "DocumentShareLink_documentId_idx" ON "DocumentShareLink"("documentId");
CREATE INDEX "DocumentShareLink_tenantId_idx" ON "DocumentShareLink"("tenantId");
