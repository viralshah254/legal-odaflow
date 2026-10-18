-- Add verifiedAt and verificationSource to LegalAuthorityRecord
-- These fields support the case-law verification pipeline:
--   verifiedAt         — timestamp when this authority was confirmed against an external source
--   verificationSource — which source was used: 'india_kanoon' | 'human' | 'curated_manual'
ALTER TABLE "LegalAuthorityRecord" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "LegalAuthorityRecord" ADD COLUMN IF NOT EXISTS "verificationSource" TEXT;
CREATE INDEX IF NOT EXISTS "LegalAuthorityRecord_verifiedAt_idx" ON "LegalAuthorityRecord"("verifiedAt");
