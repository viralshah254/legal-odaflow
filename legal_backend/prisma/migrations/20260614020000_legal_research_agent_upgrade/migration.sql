-- Migration: legal_research_agent_upgrade
-- Adds jurisdiction, legalDomain, sourceQuality to AIOutput for research metadata.
-- Extends LegalAuthorityRecord with subJurisdiction, neutralCitation, bench, judgeNames,
-- currentLawStatus, reviewedByHuman, reviewedAt and supporting indexes.

ALTER TABLE "AIOutput"
  ADD COLUMN IF NOT EXISTS "jurisdiction" TEXT,
  ADD COLUMN IF NOT EXISTS "legalDomain" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceQuality" TEXT;

ALTER TABLE "LegalAuthorityRecord"
  ADD COLUMN IF NOT EXISTS "subJurisdiction" TEXT,
  ADD COLUMN IF NOT EXISTS "neutralCitation" TEXT,
  ADD COLUMN IF NOT EXISTS "bench" TEXT,
  ADD COLUMN IF NOT EXISTS "judgeNames" JSONB,
  ADD COLUMN IF NOT EXISTS "currentLawStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedByHuman" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "LegalAuthorityRecord_subJurisdiction_idx" ON "LegalAuthorityRecord"("subJurisdiction");
CREATE INDEX IF NOT EXISTS "LegalAuthorityRecord_neutralCitation_idx" ON "LegalAuthorityRecord"("neutralCitation");
CREATE INDEX IF NOT EXISTS "LegalAuthorityRecord_currentLawStatus_idx" ON "LegalAuthorityRecord"("currentLawStatus");

-- Mark the seeded SC authorities as good law and attorney-reviewed.
UPDATE "LegalAuthorityRecord"
SET "currentLawStatus" = 'GOOD_LAW', "reviewedByHuman" = true, "reviewedAt" = CURRENT_TIMESTAMP
WHERE "jurisdiction" = 'IN' AND "official" = true AND "currentLawStatus" IS NULL;
