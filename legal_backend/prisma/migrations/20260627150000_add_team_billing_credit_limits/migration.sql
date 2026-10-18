-- Migration: add_team_billing_credit_limits
-- Adds per-user AI credit limits, seat billing fields, invitation tracking,
-- billing timezone on Tenant, and operationId idempotency on AICreditLedger.

-- Tenant: billing timezone
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "billingTimezone" TEXT NOT NULL DEFAULT 'UTC';

-- TenantUser: AI credit allocation
ALTER TABLE "TenantUser" ADD COLUMN IF NOT EXISTS "monthlyCreditLimit" INTEGER;
ALTER TABLE "TenantUser" ADD COLUMN IF NOT EXISTS "creditCycleOverrideAt" TIMESTAMP(3);

-- TenantUser: seat billing
ALTER TABLE "TenantUser" ADD COLUMN IF NOT EXISTS "isBillableSeat" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TenantUser" ADD COLUMN IF NOT EXISTS "billingStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "TenantUser" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TenantUser" ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);

-- TenantUser: composite index for status queries
CREATE INDEX IF NOT EXISTS "TenantUser_tenantId_status_idx" ON "TenantUser"("tenantId", "status");

-- User: invitation tracking
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "invitationToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "invitationStatus" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "invitedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "invitationExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "invitationAcceptedAt" TIMESTAMP(3);

-- User: unique index on invitationToken (partial — only when set)
CREATE UNIQUE INDEX IF NOT EXISTS "User_invitationToken_key"
  ON "User"("invitationToken")
  WHERE "invitationToken" IS NOT NULL;

-- AICreditLedger: operationId for idempotency
ALTER TABLE "AICreditLedger" ADD COLUMN IF NOT EXISTS "operationId" TEXT;

-- Composite index for per-user cycle usage queries
CREATE INDEX IF NOT EXISTS "AICreditLedger_tenantId_userId_createdAt_idx"
  ON "AICreditLedger"("tenantId", "userId", "createdAt");

-- Index for operationId lookups
CREATE INDEX IF NOT EXISTS "AICreditLedger_operationId_idx"
  ON "AICreditLedger"("operationId")
  WHERE "operationId" IS NOT NULL;

-- Partial unique index: one operationId per tenant (nulls are ignored)
CREATE UNIQUE INDEX IF NOT EXISTS "AICreditLedger_tenantId_operationId_key"
  ON "AICreditLedger"("tenantId", "operationId")
  WHERE "operationId" IS NOT NULL;
