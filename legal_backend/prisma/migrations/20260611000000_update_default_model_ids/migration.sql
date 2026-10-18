-- Update column defaults to reflect current model registry (gpt-5.5 / claude-opus-4-8).
-- Existing rows with old values were already remapped in 20260610180000_migrate_ai_model_prefs.
-- These ALTER COLUMN statements only affect newly-inserted rows that omit the field.

ALTER TABLE "Tenant"
  ALTER COLUMN "premiumModelId" SET DEFAULT 'gpt-5.5',
  ALTER COLUMN "deepAnalysisPremiumModelId" SET DEFAULT 'claude-opus-4-8';

ALTER TABLE "ConsumerProfile"
  ALTER COLUMN "premiumModelId" SET DEFAULT 'gpt-5.5';

ALTER TABLE "UserPreferences"
  ALTER COLUMN "premiumModelId" SET DEFAULT 'gpt-5.5';
