CREATE TYPE "ManualCitationReviewStatus" AS ENUM (
  'pending',
  'in-review',
  'approved',
  'rejected',
  'replaced'
);

CREATE TYPE "ManualCitationReviewDecision" AS ENUM (
  'APPROVE',
  'REJECT',
  'REPLACE'
);

CREATE TYPE "ManualCitationEvidenceKind" AS ENUM (
  'PASSAGE',
  'IDENTITY_ONLY'
);

CREATE TABLE "ManualCitationReviewTask" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "aiOutputId" TEXT NOT NULL,
  "matterId" TEXT,
  "citationKey" TEXT NOT NULL,
  "citation" TEXT NOT NULL,
  "claim" TEXT,
  "auditEntry" JSONB NOT NULL,
  "status" "ManualCitationReviewStatus" NOT NULL DEFAULT 'pending',
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ManualCitationReviewTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManualCitationReview" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "aiOutputId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "decision" "ManualCitationReviewDecision" NOT NULL,
  "reviewerNote" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "sourceDocumentReference" TEXT,
  "sourceHash" TEXT,
  "exactPassage" TEXT,
  "pinpoint" TEXT,
  "evidenceKind" "ManualCitationEvidenceKind",
  "replacementCitation" TEXT,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ManualCitationReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManualCitationReviewTask_tenantId_aiOutputId_citationKey_key"
  ON "ManualCitationReviewTask"("tenantId", "aiOutputId", "citationKey");
CREATE INDEX "ManualCitationReviewTask_tenantId_aiOutputId_status_idx"
  ON "ManualCitationReviewTask"("tenantId", "aiOutputId", "status");
CREATE INDEX "ManualCitationReviewTask_tenantId_matterId_idx"
  ON "ManualCitationReviewTask"("tenantId", "matterId");
CREATE INDEX "ManualCitationReview_tenantId_aiOutputId_reviewedAt_idx"
  ON "ManualCitationReview"("tenantId", "aiOutputId", "reviewedAt");
CREATE INDEX "ManualCitationReview_taskId_reviewedAt_idx"
  ON "ManualCitationReview"("taskId", "reviewedAt");
CREATE INDEX "ManualCitationReview_reviewerId_idx"
  ON "ManualCitationReview"("reviewerId");

ALTER TABLE "ManualCitationReviewTask"
  ADD CONSTRAINT "ManualCitationReviewTask_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualCitationReviewTask"
  ADD CONSTRAINT "ManualCitationReviewTask_aiOutputId_fkey"
  FOREIGN KEY ("aiOutputId") REFERENCES "AIOutput"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualCitationReview"
  ADD CONSTRAINT "ManualCitationReview_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "ManualCitationReviewTask"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManualCitationReview"
  ADD CONSTRAINT "ManualCitationReview_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManualCitationReview"
  ADD CONSTRAINT "ManualCitationReview_aiOutputId_fkey"
  FOREIGN KEY ("aiOutputId") REFERENCES "AIOutput"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManualCitationReview"
  ADD CONSTRAINT "ManualCitationReview_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
