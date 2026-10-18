-- AlterTable
ALTER TABLE "DocumentTemplate" ADD COLUMN "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX "DocumentTemplate_tenantId_category_idx" ON "DocumentTemplate"("tenantId", "category");
CREATE INDEX "DocumentTemplate_createdByUserId_idx" ON "DocumentTemplate"("createdByUserId");

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
