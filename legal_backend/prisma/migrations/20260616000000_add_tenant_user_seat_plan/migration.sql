-- AddColumn TenantUser.seatPlan
ALTER TABLE "TenantUser" ADD COLUMN IF NOT EXISTS "seatPlan" TEXT DEFAULT 'STARTER';

-- AddColumn TenantUser.seatPlanUpdatedAt
ALTER TABLE "TenantUser" ADD COLUMN IF NOT EXISTS "seatPlanUpdatedAt" TIMESTAMP(3);
