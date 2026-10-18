-- AlterTable
ALTER TABLE "LawyerProspect" ADD COLUMN "barEnrollmentNumber" TEXT;
ALTER TABLE "LawyerProspect" ADD COLUMN "barCouncilState" TEXT;
ALTER TABLE "LawyerProspect" ADD COLUMN "lawyerVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LawyerProspect" ADD COLUMN "verifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "LawyerProspect_lawyerVerified_idx" ON "LawyerProspect"("lawyerVerified");
CREATE INDEX "LawyerProspect_barCouncilState_idx" ON "LawyerProspect"("barCouncilState");
