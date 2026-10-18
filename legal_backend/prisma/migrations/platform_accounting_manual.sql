-- Platform Accounting: PlatformRevenueEntry and PlatformExpense tables
CREATE TABLE IF NOT EXISTS "PlatformRevenueEntry" (
  "id"              TEXT NOT NULL,
  "source"          TEXT NOT NULL,
  "grossAmount"     DECIMAL(12,4) NOT NULL,
  "taxAmount"       DECIMAL(12,4) NOT NULL DEFAULT 0,
  "feeAmount"       DECIMAL(12,4) NOT NULL DEFAULT 0,
  "netAmount"       DECIMAL(12,4) NOT NULL,
  "currency"        TEXT NOT NULL,
  "countryCode"     TEXT,
  "planId"          TEXT,
  "tenantId"        TEXT,
  "userId"          TEXT,
  "paymentProvider" TEXT NOT NULL,
  "providerRef"     TEXT NOT NULL,
  "description"     TEXT,
  "occurredAt"      TIMESTAMP(3) NOT NULL,
  "metadata"        JSONB,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformRevenueEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformRevenueEntry_providerRef_key" ON "PlatformRevenueEntry"("providerRef");
CREATE INDEX IF NOT EXISTS "PlatformRevenueEntry_source_idx" ON "PlatformRevenueEntry"("source");
CREATE INDEX IF NOT EXISTS "PlatformRevenueEntry_occurredAt_idx" ON "PlatformRevenueEntry"("occurredAt");
CREATE INDEX IF NOT EXISTS "PlatformRevenueEntry_tenantId_idx" ON "PlatformRevenueEntry"("tenantId");
CREATE INDEX IF NOT EXISTS "PlatformRevenueEntry_countryCode_idx" ON "PlatformRevenueEntry"("countryCode");
CREATE INDEX IF NOT EXISTS "PlatformRevenueEntry_paymentProvider_idx" ON "PlatformRevenueEntry"("paymentProvider");

ALTER TABLE "PlatformRevenueEntry" 
  ADD CONSTRAINT "PlatformRevenueEntry_tenantId_fkey" 
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "PlatformExpense" (
  "id"          TEXT NOT NULL,
  "category"    TEXT NOT NULL,
  "vendor"      TEXT,
  "description" TEXT NOT NULL,
  "amount"      DECIMAL(12,4) NOT NULL,
  "currency"    TEXT NOT NULL,
  "taxAmount"   DECIMAL(12,4) NOT NULL DEFAULT 0,
  "expenseDate" TIMESTAMP(3) NOT NULL,
  "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  "receiptUrl"  TEXT,
  "createdById" TEXT,
  "snapshotRef" TEXT,
  "metadata"    JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlatformExpense_category_idx" ON "PlatformExpense"("category");
CREATE INDEX IF NOT EXISTS "PlatformExpense_expenseDate_idx" ON "PlatformExpense"("expenseDate");
