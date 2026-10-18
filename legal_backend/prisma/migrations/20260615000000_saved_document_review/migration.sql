-- CreateTable
CREATE TABLE "SavedDocumentReview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT,
    "matterId" TEXT,
    "fileName" TEXT NOT NULL,
    "documentType" TEXT,
    "reviewJson" JSONB NOT NULL,
    "extractedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedDocumentReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedDocumentReview_tenantId_idx" ON "SavedDocumentReview"("tenantId");

-- CreateIndex
CREATE INDEX "SavedDocumentReview_tenantId_clientId_idx" ON "SavedDocumentReview"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "SavedDocumentReview_tenantId_matterId_idx" ON "SavedDocumentReview"("tenantId", "matterId");

-- AddForeignKey
ALTER TABLE "SavedDocumentReview" ADD CONSTRAINT "SavedDocumentReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedDocumentReview" ADD CONSTRAINT "SavedDocumentReview_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedDocumentReview" ADD CONSTRAINT "SavedDocumentReview_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
