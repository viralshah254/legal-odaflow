-- CreateTable
CREATE TABLE "CaseAnalysisRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "consumerCaseId" TEXT NOT NULL,
    "lawyerLeadId" TEXT,
    "runType" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "inputHash" TEXT,
    "structuredOutput" JSONB,
    "contentMarkdown" TEXT,
    "citations" JSONB,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseAnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseAnalysisRun_tenantId_idx" ON "CaseAnalysisRun"("tenantId");

-- CreateIndex
CREATE INDEX "CaseAnalysisRun_consumerCaseId_idx" ON "CaseAnalysisRun"("consumerCaseId");

-- CreateIndex
CREATE INDEX "CaseAnalysisRun_lawyerLeadId_idx" ON "CaseAnalysisRun"("lawyerLeadId");

-- CreateIndex
CREATE INDEX "CaseAnalysisRun_runType_idx" ON "CaseAnalysisRun"("runType");

-- CreateIndex
CREATE INDEX "CaseAnalysisRun_createdAt_idx" ON "CaseAnalysisRun"("createdAt");

-- AddForeignKey
ALTER TABLE "CaseAnalysisRun" ADD CONSTRAINT "CaseAnalysisRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAnalysisRun" ADD CONSTRAINT "CaseAnalysisRun_lawyerLeadId_fkey" FOREIGN KEY ("lawyerLeadId") REFERENCES "LawyerLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
