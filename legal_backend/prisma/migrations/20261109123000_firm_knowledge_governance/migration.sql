ALTER TABLE "EmbeddingChunk" ADD COLUMN "tenantId" TEXT;
-- Preserve the private scope already recorded by ingestion. Unknown/nonexistent
-- tenant IDs remain private strings; deletion must never make a chunk public.
UPDATE "EmbeddingChunk" SET "tenantId" = "metadata"->>'tenantId'
WHERE jsonb_typeof("metadata"->'tenantId') = 'string' AND length("metadata"->>'tenantId') > 0;
CREATE INDEX "EmbeddingChunk_tenantId_idx" ON "EmbeddingChunk"("tenantId");
CREATE TABLE "FirmKnowledgeItem" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "matterId" TEXT, "documentId" TEXT, "rightsExpiresAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL, "lastEditedById" TEXT NOT NULL, "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "content" TEXT NOT NULL, "contentHash" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1, "rightsBasis" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FirmKnowledgeItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FirmKnowledgeItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FirmKnowledgeItem_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FirmKnowledgeItem_tenantId_sourceType_sourceId_key" ON "FirmKnowledgeItem"("tenantId", "sourceType", "sourceId");
CREATE INDEX "FirmKnowledgeItem_tenantId_status_idx" ON "FirmKnowledgeItem"("tenantId", "status");
CREATE INDEX "FirmKnowledgeItem_tenantId_matterId_idx" ON "FirmKnowledgeItem"("tenantId", "matterId");
CREATE TABLE "FirmKnowledgeReview" (
  "id" TEXT NOT NULL, "itemId" TEXT NOT NULL, "tenantId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL, "makerId" TEXT NOT NULL, "scope" JSONB NOT NULL, "decision" TEXT NOT NULL, "revision" INTEGER NOT NULL,
  "contentHash" TEXT NOT NULL, "selfReview" BOOLEAN NOT NULL DEFAULT false, "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FirmKnowledgeReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FirmKnowledgeReview_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "FirmKnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "FirmKnowledgeReview_tenantId_itemId_idx" ON "FirmKnowledgeReview"("tenantId", "itemId");
