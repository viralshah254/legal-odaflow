-- Add preferredLocale to UserPreferences for UI language persistence
ALTER TABLE "UserPreferences" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT NOT NULL DEFAULT 'en';
