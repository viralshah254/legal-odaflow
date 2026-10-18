-- Umbrella remediation: scoped idempotency and draft release snapshots (local migration).
ALTER TABLE "CourtDraftRecord" ADD COLUMN IF NOT EXISTS "contentRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CourtDraftRecord" ADD COLUMN IF NOT EXISTS "releaseSnapshotJson" JSONB;

ALTER TABLE "DraftJob" ADD COLUMN IF NOT EXISTS "operation" TEXT NOT NULL DEFAULT 'draft_generate';
ALTER TABLE "DraftJob" ADD COLUMN IF NOT EXISTS "requestFingerprint" TEXT;
ALTER TABLE "DraftJob" ADD COLUMN IF NOT EXISTS "dispatchStatus" TEXT NOT NULL DEFAULT 'pending_dispatch';

DROP INDEX IF EXISTS "DraftJob_idempotencyKey_key";
CREATE UNIQUE INDEX IF NOT EXISTS "DraftJob_tenantId_userId_operation_idempotencyKey_key"
  ON "DraftJob"("tenantId", "userId", "operation", "idempotencyKey");

CREATE TABLE IF NOT EXISTS "WorkContextOperation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "clientId" TEXT,
  "matterId" TEXT,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkContextOperation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkContextOperation_tenantId_userId_idempotencyKey_key"
  ON "WorkContextOperation"("tenantId", "userId", "idempotencyKey");

ALTER TABLE "DraftHumanReview" ADD COLUMN IF NOT EXISTS "evidenceRevision" TEXT;
ALTER TABLE "DraftHumanReview" ADD COLUMN IF NOT EXISTS "courtProfileId" TEXT;
ALTER TABLE "DraftHumanReview" ADD COLUMN IF NOT EXISTS "contentRevision" INTEGER;
ALTER TABLE "DraftHumanReview" ADD COLUMN IF NOT EXISTS "releaseDigest" TEXT;
