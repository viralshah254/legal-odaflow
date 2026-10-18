-- CreateTable
CREATE TABLE "MatterAnalysisRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "runType" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "title" TEXT,
    "contentMarkdown" TEXT,
    "structuredOutput" JSONB,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatterAnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatterAnalysisRun_tenantId_matterId_runType_idx" ON "MatterAnalysisRun"("tenantId", "matterId", "runType");

-- AddForeignKey
ALTER TABLE "MatterAnalysisRun" ADD CONSTRAINT "MatterAnalysisRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterAnalysisRun" ADD CONSTRAINT "MatterAnalysisRun_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
