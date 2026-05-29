-- Series A parity schema extensions

ALTER TABLE "Matter" ADD COLUMN IF NOT EXISTS "retainerBalance" DECIMAL(12,2);
ALTER TABLE "Matter" ADD COLUMN IF NOT EXISTS "retainerCurrency" TEXT;
ALTER TABLE "LawyerLead" ADD COLUMN IF NOT EXISTS "intakeStage" TEXT DEFAULT 'NEW';

ALTER TABLE "AutomationRule" ADD COLUMN IF NOT EXISTS "requiresApproval" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AutomationRule" ADD COLUMN IF NOT EXISTS "slaMinutes" INTEGER;
ALTER TABLE "AutomationRule" ADD COLUMN IF NOT EXISTS "escalationAction" JSONB;

CREATE TABLE IF NOT EXISTS "PreBillSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matterId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "writeDownPercent" DECIMAL(5,2),
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PreBillSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PreBillLineAdjustment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "adjustedMinutes" INTEGER,
    "writeDownPercent" DECIMAL(5,2),
    "notes" TEXT,
    CONSTRAINT "PreBillLineAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TrustReconciliation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "openingBalance" DECIMAL(12,2) NOT NULL,
    "closingBalance" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reconciledBy" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrustReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SuggestedTimeEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matterId" TEXT,
    "source" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "narrative" TEXT,
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SuggestedTimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MarketplaceRevenueEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "leadId" TEXT,
    "reviewRequestId" TEXT,
    "grossAmount" DECIMAL(10,2) NOT NULL,
    "platformFee" DECIMAL(10,2) NOT NULL,
    "lawyerPayout" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketplaceRevenueEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EvidenceItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "documentId" TEXT,
    "chainOfCustody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EvidenceCustodyLog" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidenceCustodyLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EthicalWallGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "matterIds" JSONB NOT NULL,
    "userIds" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EthicalWallGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WebhookSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PublicApiKey" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BulkDocumentReviewJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "documentIds" JSONB NOT NULL,
    "summaryMatrix" JSONB,
    "aiOutputId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "BulkDocumentReviewJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IntegrationSyncLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "IntegrationSyncLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UnifiedInboxThread" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    "matterId" TEXT,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "UnifiedInboxThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UnifiedInboxMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "senderId" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnifiedInboxMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PreBillSession_tenantId_idx" ON "PreBillSession"("tenantId");
CREATE INDEX IF NOT EXISTS "TrustReconciliation_tenantId_idx" ON "TrustReconciliation"("tenantId");
CREATE INDEX IF NOT EXISTS "SuggestedTimeEntry_tenantId_userId_idx" ON "SuggestedTimeEntry"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "EvidenceItem_matterId_idx" ON "EvidenceItem"("matterId");
CREATE INDEX IF NOT EXISTS "BulkDocumentReviewJob_matterId_idx" ON "BulkDocumentReviewJob"("matterId");

ALTER TABLE "PreBillLineAdjustment" ADD CONSTRAINT "PreBillLineAdjustment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PreBillSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvidenceCustodyLog" ADD CONSTRAINT "EvidenceCustodyLog_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnifiedInboxMessage" ADD CONSTRAINT "UnifiedInboxMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "UnifiedInboxThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
