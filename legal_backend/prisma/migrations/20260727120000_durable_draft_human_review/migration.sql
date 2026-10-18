CREATE TABLE "DraftHumanReview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "caseRecordId" TEXT NOT NULL,
    "caseRecordVersion" INTEGER NOT NULL,
    "playbookVersion" TEXT NOT NULL,
    "draftHash" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "reviewedByUserId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "invalidated" BOOLEAN NOT NULL DEFAULT false,
    "invalidatedReason" TEXT,
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftHumanReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DraftHumanReview_tenantId_draftId_reviewedAt_idx"
ON "DraftHumanReview"("tenantId", "draftId", "reviewedAt");

CREATE INDEX "DraftHumanReview_tenantId_reviewedByUserId_idx"
ON "DraftHumanReview"("tenantId", "reviewedByUserId");

CREATE INDEX "DraftHumanReview_draftHash_idx"
ON "DraftHumanReview"("draftHash");

ALTER TABLE "CourtDraftRecord"
ADD COLUMN "sourceRegistryJson" JSONB,
ADD COLUMN "citationAppendixJson" JSONB,
ADD COLUMN "filingReadinessJson" JSONB;
