-- LawyerProspect test flag
ALTER TABLE "LawyerProspect" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "LawyerProspect_isTest_idx" ON "LawyerProspect"("isTest");

-- App user WhatsApp marketing opt-in
ALTER TABLE "User" ADD COLUMN "whatsappMarketingOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "whatsappOptOutAt" TIMESTAMP(3);

-- Campaign audience type (PROSPECT | USER)
ALTER TABLE "WhatsappCampaign" ADD COLUMN "audienceType" TEXT NOT NULL DEFAULT 'PROSPECT';

-- Messages can target prospects or app users
ALTER TABLE "WhatsappMessage" ALTER COLUMN "prospectId" DROP NOT NULL;
ALTER TABLE "WhatsappMessage" ADD COLUMN "userId" TEXT;
CREATE INDEX "WhatsappMessage_userId_idx" ON "WhatsappMessage"("userId");
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed admin test prospect (+254738266973 · Ahmedabad)
INSERT INTO "LawyerProspect" (
  "id",
  "fullName",
  "firstName",
  "city",
  "state",
  "country",
  "whatsapp",
  "whatsappConfidence",
  "source",
  "dedupeKey",
  "outreachStatus",
  "isTest",
  "lawyerVerified",
  "createdAt",
  "updatedAt"
) VALUES (
  'cm7test25473826697300001',
  'Test User (Admin)',
  'Test',
  'Ahmedabad',
  'Gujarat',
  'India',
  '+254738266973',
  'verified',
  'test_user',
  '13a2940ff39e69a4e2e864d93973f110',
  'NEW',
  true,
  false,
  NOW(),
  NOW()
)
ON CONFLICT ("dedupeKey") DO UPDATE SET
  "whatsapp" = EXCLUDED."whatsapp",
  "whatsappConfidence" = EXCLUDED."whatsappConfidence",
  "city" = EXCLUDED."city",
  "state" = EXCLUDED."state",
  "country" = EXCLUDED."country",
  "isTest" = true,
  "source" = EXCLUDED."source",
  "updatedAt" = NOW();
