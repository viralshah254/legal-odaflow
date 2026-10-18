-- Add alternatePhone and city/phone indexes for India outreach filtering
ALTER TABLE "LawyerProspect"
  ADD COLUMN IF NOT EXISTS "alternatePhone" TEXT;

-- Composite index for country+city+phone filter combo
CREATE INDEX IF NOT EXISTS "LawyerProspect_country_city_idx" ON "LawyerProspect"("country", "city");
