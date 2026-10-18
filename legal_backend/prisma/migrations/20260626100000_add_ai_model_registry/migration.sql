-- CreateTable: AiModel
-- AI Model Registry (UMB-014) — database-backed model configuration so that
-- prices, aliases, and routing can be changed without code deployment.

CREATE TABLE "AiModel" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerModelId" TEXT NOT NULL,
    "internalAlias" TEXT,
    "displayName" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "supportsStreaming" BOOLEAN NOT NULL DEFAULT false,
    "supportsJsonSchema" BOOLEAN NOT NULL DEFAULT false,
    "supportsToolCalling" BOOLEAN NOT NULL DEFAULT false,
    "supportsVision" BOOLEAN NOT NULL DEFAULT false,
    "supportsReasoning" BOOLEAN NOT NULL DEFAULT false,
    "supportsPromptCaching" BOOLEAN NOT NULL DEFAULT false,
    "contextWindowTokens" BIGINT,
    "maxOutputTokens" BIGINT,
    "inputPricePerMillionUsd" DECIMAL(12,6),
    "cachedInputPricePerMillionUsd" DECIMAL(12,6),
    "outputPricePerMillionUsd" DECIMAL(12,6),
    "dataRegion" TEXT,
    "retentionPolicy" TEXT,
    "trainingOptOutSupported" BOOLEAN,
    "enterpriseApproved" BOOLEAN NOT NULL DEFAULT false,
    "qualityScore" DECIMAL(6,3),
    "legalQualityScore" DECIMAL(6,3),
    "citationScore" DECIMAL(6,3),
    "latencyScore" DECIMAL(6,3),
    "costScore" DECIMAL(6,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AiModelAlias
CREATE TABLE "AiModelAlias" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "aiModelId" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "taskType" TEXT,
    "subscriptionTier" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModelAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiModel_provider_providerModelId_key" ON "AiModel"("provider", "providerModelId");
CREATE INDEX "AiModel_tier_enabled_idx" ON "AiModel"("tier", "enabled");
CREATE INDEX "AiModel_provider_enabled_idx" ON "AiModel"("provider", "enabled");

CREATE UNIQUE INDEX "AiModelAlias_alias_key" ON "AiModelAlias"("alias");
CREATE INDEX "AiModelAlias_alias_enabled_idx" ON "AiModelAlias"("alias", "enabled");
CREATE INDEX "AiModelAlias_taskType_subscriptionTier_idx" ON "AiModelAlias"("taskType", "subscriptionTier");

-- AddForeignKey
ALTER TABLE "AiModelAlias" ADD CONSTRAINT "AiModelAlias_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "AiModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: insert default model registry from model-costs.config.ts
-- This seeds the initial model set. Prices can then be updated via admin panel.

INSERT INTO "AiModel" (
    "id", "provider", "providerModelId", "internalAlias", "displayName", "tier",
    "enabled", "supportsToolCalling", "supportsStreaming", "supportsPromptCaching", "supportsReasoning",
    "inputPricePerMillionUsd", "outputPricePerMillionUsd",
    "createdAt", "updatedAt"
) VALUES
-- DeepSeek — economy
(gen_random_uuid(), 'deepseek', 'deepseek-chat',      'umbrella-economy-default',      'DeepSeek Chat V3',        'cheap',     true, true, true, false, false, 0.27,   1.10,   NOW(), NOW()),
(gen_random_uuid(), 'deepseek', 'deepseek-reasoner',  NULL,                            'DeepSeek R1 Reasoner',    'cheap',     true, true, true, false, true,  0.55,   2.19,   NOW(), NOW()),
-- OpenAI — cheap
(gen_random_uuid(), 'openai',   'gpt-5.4-mini',       NULL,                            'GPT-5.4 mini',            'cheap',     true, true, true, false, false, 0.40,   1.60,   NOW(), NOW()),
-- OpenAI — reasoning/premium
(gen_random_uuid(), 'openai',   'gpt-5.5',            'umbrella-standard-default',     'GPT-5.5',                 'reasoning', true, true, true, false, true,  5.00,   30.00,  NOW(), NOW()),
(gen_random_uuid(), 'openai',   'gpt-5.5-pro',        NULL,                            'GPT-5.5 Pro',             'premium',   true, true, true, false, true,  30.00,  180.00, NOW(), NOW()),
-- Anthropic — cheap
(gen_random_uuid(), 'anthropic','claude-haiku-4-5',   NULL,                            'Claude Haiku 4.5',        'cheap',     true, true, true, true,  false, 0.80,   4.00,   NOW(), NOW()),
-- Anthropic — standard
(gen_random_uuid(), 'anthropic','claude-sonnet-4-6',  'umbrella-professional-default', 'Claude Sonnet 4.6',       'premium',   true, true, true, true,  false, 3.00,   15.00,  NOW(), NOW()),
-- Anthropic — premium / expert
(gen_random_uuid(), 'anthropic','claude-opus-4-8',    'umbrella-expert-default',       'Claude Opus 4.8',         'premium',   true, true, true, true,  true,  5.00,   25.00,  NOW(), NOW()),
(gen_random_uuid(), 'anthropic','claude-fable-5',     NULL,                            'Claude Fable 5',          'premium',   true, true, true, true,  true,  10.00,  50.00,  NOW(), NOW())
ON CONFLICT ("provider", "providerModelId") DO NOTHING;

-- Seed aliases: these map Umbrella tier names to concrete models.
-- Admins can point these to different models without code changes.

INSERT INTO "AiModelAlias" ("id", "alias", "aiModelId", "enabled", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    'umbrella-economy-default',
    id,
    true,
    NOW(),
    NOW()
FROM "AiModel"
WHERE "providerModelId" = 'deepseek-chat'
ON CONFLICT ("alias") DO NOTHING;

INSERT INTO "AiModelAlias" ("id", "alias", "aiModelId", "enabled", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    'umbrella-standard-default',
    id,
    true,
    NOW(),
    NOW()
FROM "AiModel"
WHERE "providerModelId" = 'gpt-5.5'
ON CONFLICT ("alias") DO NOTHING;

INSERT INTO "AiModelAlias" ("id", "alias", "aiModelId", "enabled", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    'umbrella-professional-default',
    id,
    true,
    NOW(),
    NOW()
FROM "AiModel"
WHERE "providerModelId" = 'claude-sonnet-4-6'
ON CONFLICT ("alias") DO NOTHING;

INSERT INTO "AiModelAlias" ("id", "alias", "aiModelId", "enabled", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    'umbrella-expert-default',
    id,
    true,
    NOW(),
    NOW()
FROM "AiModel"
WHERE "providerModelId" = 'claude-opus-4-8'
ON CONFLICT ("alias") DO NOTHING;
