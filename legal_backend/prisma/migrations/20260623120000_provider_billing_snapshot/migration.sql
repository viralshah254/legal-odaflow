-- CreateTable
CREATE TABLE IF NOT EXISTS "ProviderBillingSnapshot" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "periodDate" DATE NOT NULL,
    "reportedUsd" DECIMAL(12,4) NOT NULL,
    "computedUsd" DECIMAL(12,4) NOT NULL,
    "varianceUsd" DECIMAL(12,4) NOT NULL,
    "variancePercent" DECIMAL(8,2),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderBillingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderBillingSnapshot_provider_periodDate_key" ON "ProviderBillingSnapshot"("provider", "periodDate");
CREATE INDEX IF NOT EXISTS "ProviderBillingSnapshot_periodDate_idx" ON "ProviderBillingSnapshot"("periodDate");
