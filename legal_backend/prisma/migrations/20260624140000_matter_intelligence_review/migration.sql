-- P15-03 Matter Intelligence review queue
CREATE TABLE IF NOT EXISTS "MatterIntelligenceReview" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "profileSnapshot" JSONB NOT NULL,
  "correction" JSONB,
  "recommendationMode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reviewerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "MatterIntelligenceReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MatterIntelligenceReview_status_createdAt_idx"
  ON "MatterIntelligenceReview"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "MatterIntelligenceReview_tenantId_idx"
  ON "MatterIntelligenceReview"("tenantId");
