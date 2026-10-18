-- CreateTable
CREATE TABLE "DraftingSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'template',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "templateId" TEXT,
    "forkedTemplateId" TEXT,
    "documentKind" TEXT,
    "countryCode" TEXT,
    "sourceQuery" TEXT,
    "fieldValues" JSONB,
    "clauseAnswers" JSONB,
    "workingHtml" TEXT,
    "unresolvedQuestions" JSONB,
    "sourceDocumentId" TEXT,
    "sourceFileName" TEXT,
    "sourceMimeType" TEXT,
    "sourceFormat" TEXT,
    "extractionStatus" TEXT,
    "documentId" TEXT,
    "clientId" TEXT,
    "matterId" TEXT,
    "completionScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DraftingSession_tenantId_idx" ON "DraftingSession"("tenantId");

-- CreateIndex
CREATE INDEX "DraftingSession_tenantId_userId_idx" ON "DraftingSession"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "DraftingSession_status_idx" ON "DraftingSession"("status");

-- AddForeignKey
ALTER TABLE "DraftingSession" ADD CONSTRAINT "DraftingSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftingSession" ADD CONSTRAINT "DraftingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
