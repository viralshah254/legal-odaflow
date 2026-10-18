-- Add deepAnalysisPremiumModelId to Tenant for persisted deep analysis model preference
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "deepAnalysisPremiumModelId" TEXT NOT NULL DEFAULT 'gpt-4.1';
