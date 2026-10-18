-- AlterTable
ALTER TABLE "CopilotSession" ADD COLUMN IF NOT EXISTS "deliverableType" TEXT;
ALTER TABLE "CopilotSession" ADD COLUMN IF NOT EXISTS "deliverableJson" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PromptLibraryEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "promptText" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "deliverableType" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptLibraryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PromptLibraryEntry_tenantId_category_idx" ON "PromptLibraryEntry"("tenantId", "category");
