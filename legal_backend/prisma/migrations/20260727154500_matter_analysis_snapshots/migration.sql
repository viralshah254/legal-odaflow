CREATE TABLE "MatterAnalysisSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "scope" TEXT NOT NULL DEFAULT 'full',
    "summary" TEXT NOT NULL,
    "risks" JSONB NOT NULL,
    "nextActions" JSONB NOT NULL,
    "evidenceGaps" JSONB NOT NULL,
    "contradictions" JSONB NOT NULL,
    "sourceDocumentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatterAnalysisSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MatterAnalysisSnapshot_tenantId_matterId_createdAt_idx"
ON "MatterAnalysisSnapshot"("tenantId", "matterId", "createdAt");

ALTER TABLE "MatterAnalysisSnapshot"
ADD CONSTRAINT "MatterAnalysisSnapshot_matterId_fkey"
FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
