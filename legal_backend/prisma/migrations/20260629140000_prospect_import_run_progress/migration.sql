-- AlterTable
ALTER TABLE "ProspectImportRun" ADD COLUMN IF NOT EXISTS "progressJson" JSONB;
