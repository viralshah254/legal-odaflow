-- Jurisdiction-aware drafting preferences.
ALTER TABLE "FirmDraftPreference" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "FirmDraftPreference_tenantId_documentKind_sectionType_key";

CREATE UNIQUE INDEX "FirmDraftPreference_tenant_kind_section_country_key"
  ON "FirmDraftPreference"("tenantId", "documentKind", "sectionType", "countryCode");

-- Research counterpart of FirmDraftPreference.
CREATE TABLE "ResearchPromptPreference" (
  "id" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "legalDomain" TEXT NOT NULL DEFAULT '',
  "guidance" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "avoidPatterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "retrievalHints" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "sampleCount" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ResearchPromptPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResearchPromptPreference_countryCode_legalDomain_key"
  ON "ResearchPromptPreference"("countryCode", "legalDomain");

CREATE INDEX "ResearchPromptPreference_countryCode_idx"
  ON "ResearchPromptPreference"("countryCode");

-- Raw research verification signals feeding the distillation above.
CREATE TABLE "ResearchVerificationOutcome" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "countryCode" TEXT NOT NULL,
  "legalDomain" TEXT NOT NULL DEFAULT '',
  "taskKind" TEXT NOT NULL DEFAULT '',
  "verificationStatus" TEXT NOT NULL,
  "unsupportedClaims" JSONB,
  "strippedCitations" JSONB,
  "unmetRequirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "hopPurposes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "authoritiesUsed" INTEGER NOT NULL DEFAULT 0,
  "usedAsTraining" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ResearchVerificationOutcome_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResearchVerificationOutcome_country_domain_training_idx"
  ON "ResearchVerificationOutcome"("countryCode", "legalDomain", "usedAsTraining");

CREATE INDEX "ResearchVerificationOutcome_createdAt_idx"
  ON "ResearchVerificationOutcome"("createdAt");
