-- Remap deprecated AI model preference IDs to current registry entries.
UPDATE "Tenant"
SET "premiumModelId" = CASE "premiumModelId"
  WHEN 'gpt-4.1-mini' THEN 'gpt-5.4-mini'
  WHEN 'gpt-4o-mini' THEN 'gpt-5.4-mini'
  WHEN 'gpt-4.1' THEN 'gpt-5.5'
  WHEN 'gpt-4o' THEN 'gpt-5.5'
  WHEN 'o3-mini' THEN 'gpt-5.5'
  WHEN 'o4-mini' THEN 'gpt-5.5'
  WHEN 'claude-opus-4-6' THEN 'claude-opus-4-8'
  ELSE "premiumModelId"
END
WHERE "premiumModelId" IN (
  'gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4o', 'o3-mini', 'o4-mini', 'claude-opus-4-6'
);

UPDATE "Tenant"
SET "deepAnalysisPremiumModelId" = CASE "deepAnalysisPremiumModelId"
  WHEN 'gpt-4.1-mini' THEN 'gpt-5.4-mini'
  WHEN 'gpt-4o-mini' THEN 'gpt-5.4-mini'
  WHEN 'gpt-4.1' THEN 'gpt-5.5'
  WHEN 'gpt-4o' THEN 'gpt-5.5'
  WHEN 'o3-mini' THEN 'gpt-5.5'
  WHEN 'o4-mini' THEN 'gpt-5.5'
  WHEN 'claude-opus-4-6' THEN 'claude-opus-4-8'
  ELSE "deepAnalysisPremiumModelId"
END
WHERE "deepAnalysisPremiumModelId" IN (
  'gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4o', 'o3-mini', 'o4-mini', 'claude-opus-4-6'
);

UPDATE "ConsumerProfile"
SET "premiumModelId" = CASE "premiumModelId"
  WHEN 'gpt-4.1-mini' THEN 'gpt-5.4-mini'
  WHEN 'gpt-4o-mini' THEN 'gpt-5.4-mini'
  WHEN 'gpt-4.1' THEN 'gpt-5.5'
  WHEN 'gpt-4o' THEN 'gpt-5.5'
  WHEN 'o3-mini' THEN 'gpt-5.5'
  WHEN 'o4-mini' THEN 'gpt-5.5'
  WHEN 'claude-opus-4-6' THEN 'claude-opus-4-8'
  ELSE "premiumModelId"
END
WHERE "premiumModelId" IN (
  'gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4o', 'o3-mini', 'o4-mini', 'claude-opus-4-6'
);

UPDATE "UserPreferences"
SET "premiumModelId" = CASE "premiumModelId"
  WHEN 'gpt-4.1-mini' THEN 'gpt-5.4-mini'
  WHEN 'gpt-4o-mini' THEN 'gpt-5.4-mini'
  WHEN 'gpt-4.1' THEN 'gpt-5.5'
  WHEN 'gpt-4o' THEN 'gpt-5.5'
  WHEN 'o3-mini' THEN 'gpt-5.5'
  WHEN 'o4-mini' THEN 'gpt-5.5'
  WHEN 'claude-opus-4-6' THEN 'claude-opus-4-8'
  ELSE "premiumModelId"
END
WHERE "premiumModelId" IN (
  'gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4o', 'o3-mini', 'o4-mini', 'claude-opus-4-6'
);
