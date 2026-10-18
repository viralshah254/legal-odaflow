-- Add description, notes, and updatedAt to Task table
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();
