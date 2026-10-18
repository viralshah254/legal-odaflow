-- Migration: add-is-repealed-to-legal-authority
-- Adds isRepealed and repealNotes fields to LegalAuthority to track
-- sections that have been repealed or omitted in the bare act text.

ALTER TABLE "LegalAuthority" ADD COLUMN IF NOT EXISTS "isRepealed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LegalAuthority" ADD COLUMN IF NOT EXISTS "repealNotes" TEXT;
