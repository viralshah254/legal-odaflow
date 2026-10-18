-- AlterTable
ALTER TABLE "LawyerLead" ADD COLUMN "slaEscalatedAt" TIMESTAMP(3);

-- Backfill slaEscalatedAt for leads that already had the legacy flag in summary
UPDATE "LawyerLead"
SET "slaEscalatedAt" = "updatedAt"
WHERE "summary" LIKE '%slaEscalated:true%';

-- Clean legacy SLA flags embedded in summary text
UPDATE "LawyerLead"
SET "summary" = TRIM(BOTH E'\n' FROM REGEXP_REPLACE(COALESCE("summary", ''), E'\\nslaEscalated:true', '', 'g'))
WHERE "summary" LIKE '%slaEscalated:true%';
