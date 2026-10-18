CREATE TABLE "ResearchRetrievalGap" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "legalDomain" TEXT,
    "gapType" TEXT NOT NULL,
    "expectedAuthority" TEXT NOT NULL,
    "authorityFingerprint" TEXT NOT NULL,
    "queryFingerprint" TEXT NOT NULL,
    "aiOutputId" TEXT,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'open',
    "detail" JSONB,
    "resolvedAuthorityId" TEXT,
    "resolvedNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchRetrievalGap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchRetrievalGap_countryCode_gapType_authorityFingerprint_queryFingerprint_key"
ON "ResearchRetrievalGap"("countryCode", "gapType", "authorityFingerprint", "queryFingerprint");

CREATE INDEX "ResearchRetrievalGap_status_updatedAt_idx"
ON "ResearchRetrievalGap"("status", "updatedAt");

CREATE INDEX "ResearchRetrievalGap_countryCode_gapType_occurrenceCount_idx"
ON "ResearchRetrievalGap"("countryCode", "gapType", "occurrenceCount");

CREATE INDEX "ResearchRetrievalGap_aiOutputId_idx"
ON "ResearchRetrievalGap"("aiOutputId");
