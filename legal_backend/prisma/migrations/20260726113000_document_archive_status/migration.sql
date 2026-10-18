ALTER TABLE "Document"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "Document_tenantId_status_idx"
  ON "Document"("tenantId", "status");
