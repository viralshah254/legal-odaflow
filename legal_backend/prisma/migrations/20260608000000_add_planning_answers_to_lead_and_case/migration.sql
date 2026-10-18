-- Add planningAnswers JSON field to ConsumerCase
ALTER TABLE "ConsumerCase" ADD COLUMN "planningAnswers" JSONB;

-- Add planningAnswers JSON field to LawyerLead
ALTER TABLE "LawyerLead" ADD COLUMN "planningAnswers" JSONB;
