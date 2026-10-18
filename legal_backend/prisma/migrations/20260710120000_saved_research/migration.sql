-- CreateTable
CREATE TABLE "SavedResearch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" TEXT NOT NULL,
    "matterId" TEXT,
    "aiOutputId" TEXT,
    "title" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "countryCode" TEXT,
    "researchJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedResearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedResearch_tenantId_idx" ON "SavedResearch"("tenantId");

-- CreateIndex
CREATE INDEX "SavedResearch_tenantId_clientId_idx" ON "SavedResearch"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "SavedResearch_tenantId_matterId_idx" ON "SavedResearch"("tenantId", "matterId");

-- CreateIndex
CREATE INDEX "SavedResearch_tenantId_userId_idx" ON "SavedResearch"("tenantId", "userId");

-- AddForeignKey
ALTER TABLE "SavedResearch" ADD CONSTRAINT "SavedResearch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedResearch" ADD CONSTRAINT "SavedResearch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedResearch" ADD CONSTRAINT "SavedResearch_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
