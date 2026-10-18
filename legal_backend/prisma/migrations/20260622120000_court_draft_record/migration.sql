-- CreateTable
CREATE TABLE "CourtDraftRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "label" TEXT,
    "subtitle" TEXT,
    "category" TEXT,
    "countryCode" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "caseDetails" TEXT,
    "clientName" TEXT,
    "courtName" TEXT,
    "opposingParty" TEXT,
    "draftText" TEXT NOT NULL,
    "verificationAudit" JSONB,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "creditLedgerId" TEXT,
    "requiresLawyerReview" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtDraftRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourtDraftRecord_tenantId_userId_createdAt_idx" ON "CourtDraftRecord"("tenantId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "CourtDraftRecord_tenantId_kind_idx" ON "CourtDraftRecord"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "CourtDraftRecord_countryCode_idx" ON "CourtDraftRecord"("countryCode");

-- AddForeignKey
ALTER TABLE "CourtDraftRecord" ADD CONSTRAINT "CourtDraftRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtDraftRecord" ADD CONSTRAINT "CourtDraftRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
