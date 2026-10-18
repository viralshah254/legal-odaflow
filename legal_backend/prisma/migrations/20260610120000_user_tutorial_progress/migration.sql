-- Add per-user tutorial progress for post-login page tours
ALTER TABLE "UserPreferences" ADD COLUMN "tutorialProgress" JSONB;
