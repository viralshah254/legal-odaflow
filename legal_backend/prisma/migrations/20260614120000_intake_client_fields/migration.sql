-- Add contactPeople to Client
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "contactPeople" JSONB;

-- Add client fields to LawyerLead
ALTER TABLE "LawyerLead" ADD COLUMN IF NOT EXISTS "clientName" TEXT;
ALTER TABLE "LawyerLead" ADD COLUMN IF NOT EXISTS "clientEmail" TEXT;
ALTER TABLE "LawyerLead" ADD COLUMN IF NOT EXISTS "clientPhone" TEXT;
ALTER TABLE "LawyerLead" ADD COLUMN IF NOT EXISTS "clientType" TEXT;
ALTER TABLE "LawyerLead" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
