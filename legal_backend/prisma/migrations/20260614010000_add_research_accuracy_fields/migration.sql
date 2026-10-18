-- Migration: add_research_accuracy_fields
-- Adds inputQuery, citationAudit, verified to AIOutput
-- Adds LegalAuthorityRecord model for verified authority registry
-- Adds taskType index to AIOutput for efficient history queries

ALTER TABLE "AIOutput"
  ADD COLUMN IF NOT EXISTS "inputQuery" TEXT,
  ADD COLUMN IF NOT EXISTS "citationAudit" JSONB,
  ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "AIOutput_taskType_idx" ON "AIOutput"("taskType");

CREATE TABLE IF NOT EXISTS "LegalAuthorityRecord" (
    "id" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "authorityType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "citation" TEXT,
    "court" TEXT,
    "date" TIMESTAMP(3),
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "official" BOOLEAN NOT NULL DEFAULT false,
    "reliabilityRank" INTEGER NOT NULL DEFAULT 3,
    "textHash" TEXT,
    "summary" TEXT,
    "holdingsJson" JSONB,
    "provisionsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalAuthorityRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LegalAuthorityRecord_jurisdiction_idx" ON "LegalAuthorityRecord"("jurisdiction");
CREATE INDEX IF NOT EXISTS "LegalAuthorityRecord_authorityType_idx" ON "LegalAuthorityRecord"("authorityType");
CREATE INDEX IF NOT EXISTS "LegalAuthorityRecord_citation_idx" ON "LegalAuthorityRecord"("citation");
CREATE INDEX IF NOT EXISTS "LegalAuthorityRecord_title_idx" ON "LegalAuthorityRecord"("title");

-- Seed well-known verified Indian SC case authorities for the citation audit pass.
INSERT INTO "LegalAuthorityRecord" ("id", "jurisdiction", "authorityType", "title", "citation", "court", "date", "sourceName", "official", "reliabilityRank", "summary")
VALUES
  (gen_random_uuid()::text, 'IN', 'CASE', 'Rangappa v Sri Mohan', '(2010) 11 SCC 441', 'Supreme Court of India', '2010-01-01', 'SCC Online', true, 5, 'Leading authority on s.139 NI Act rebuttable presumption — accused must prove on preponderance of probabilities that cheque was not for legally enforceable debt.'),
  (gen_random_uuid()::text, 'IN', 'CASE', 'Kumar Exports v Sharma Carpets', '(2009) 2 SCC 513', 'Supreme Court of India', '2009-01-01', 'SCC Online', true, 5, 'Authority on s.139 NI Act — once dishonour and notice proved, presumption of debt arises; rebuttal requires cogent evidence.'),
  (gen_random_uuid()::text, 'IN', 'CASE', 'Basalingappa v Mudibasappa', '(2019) 5 SCC 418', 'Supreme Court of India', '2019-01-01', 'SCC Online', true, 5, 'Three-judge bench on s.139 NI Act — rebuttal standard is preponderance of probabilities; accused need not prove beyond reasonable doubt.'),
  (gen_random_uuid()::text, 'IN', 'CASE', 'Damodar S. Prabhu v Sayed Babalal H.', '(2010) 5 SCC 663', 'Supreme Court of India', '2010-01-01', 'SCC Online', true, 5, 'Compounding under s.147 NI Act — encouraged at any stage; graded cost structure to incentivise early settlement.'),
  (gen_random_uuid()::text, 'IN', 'CASE', 'Meters and Instruments Pvt. Ltd. v Kanchan Mehta', '(2018) 1 SCC 560', 'Supreme Court of India', '2018-01-01', 'SCC Online', true, 5, 'Payment of cheque amount can support closure under s.138 NI Act; use cautiously — later decisions emphasise complainant consent.'),
  (gen_random_uuid()::text, 'IN', 'CASE', 'Expeditious Trial of Cases under Section 138', '(2021) 16 SCC 116', 'Supreme Court of India', '2021-01-01', 'SCC Online', true, 5, 'Suo motu — directions for expeditious disposal of s.138 cases; interim compensation under s.143A.'),
  (gen_random_uuid()::text, 'IN', 'CASE', 'Rajneesh Aggarwal v Amit J. Bhalla', '(2001) 1 SCC 631', 'Supreme Court of India', '2001-01-01', 'SCC Online', true, 4, 'Not the primary authority for s.139 rebuttal standard; more relevant to prosecution continuing after later payment.')
ON CONFLICT DO NOTHING;
