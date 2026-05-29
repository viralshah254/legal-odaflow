-- AI Model Router + Credit Wallet schema extensions

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "aiCreditsRemaining" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AIUsageLog" ADD COLUMN IF NOT EXISTS "modelTier" TEXT;
ALTER TABLE "AIUsageLog" ADD COLUMN IF NOT EXISTS "retrievalCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AIUsageLog" ADD COLUMN IF NOT EXISTS "estimatedCostUsd" DECIMAL(10,6);
ALTER TABLE "AIUsageLog" ADD COLUMN IF NOT EXISTS "chargedCredits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AIUsageLog" ADD COLUMN IF NOT EXISTS "creditValueUsd" DECIMAL(10,6);
ALTER TABLE "AIUsageLog" ADD COLUMN IF NOT EXISTS "platformMarginUsd" DECIMAL(10,6);

CREATE TABLE IF NOT EXISTS "AIModelCostConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "modelTier" TEXT NOT NULL,
    "inputCostPer1M" DECIMAL(10,6) NOT NULL,
    "outputCostPer1M" DECIMAL(10,6) NOT NULL,
    "cachedInputCostPer1M" DECIMAL(10,6),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AIModelCostConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AIModelCostConfig_provider_modelName_key" ON "AIModelCostConfig"("provider", "modelName");

CREATE TABLE IF NOT EXISTS "AICreditRate" (
    "id" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "countryCode" TEXT,
    "userSegment" TEXT NOT NULL,
    "baseCredits" INTEGER NOT NULL,
    "minCredits" INTEGER NOT NULL DEFAULT 1,
    "maxCredits" INTEGER NOT NULL DEFAULT 500,
    "modelTier" TEXT NOT NULL,
    "markupMultiplier" DECIMAL(8,2) NOT NULL DEFAULT 1.0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AICreditRate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AICreditRate_taskType_userSegment_idx" ON "AICreditRate"("taskType", "userSegment");

CREATE TABLE IF NOT EXISTS "CreditPack" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "bonusCredits" INTEGER NOT NULL DEFAULT 0,
    "price" DECIMAL(10,2) NOT NULL,
    "userSegment" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreditPack_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreditPack_packId_countryCode_userSegment_key" ON "CreditPack"("packId", "countryCode", "userSegment");

CREATE TABLE IF NOT EXISTS "AIPromptTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "userTemplate" TEXT NOT NULL,
    "outputSchema" JSONB,
    "modelTier" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AIPromptTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AIPromptTemplate_key_version_key" ON "AIPromptTemplate"("key", "version");

CREATE TABLE IF NOT EXISTS "CreditReservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT,
    "taskType" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreditReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CreditReservation_userId_idx" ON "CreditReservation"("userId");
CREATE INDEX IF NOT EXISTS "CreditReservation_tenantId_idx" ON "CreditReservation"("tenantId");
CREATE INDEX IF NOT EXISTS "CreditReservation_status_idx" ON "CreditReservation"("status");
