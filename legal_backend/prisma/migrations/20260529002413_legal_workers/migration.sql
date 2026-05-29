-- AlterTable
ALTER TABLE "ConsumerProfile" ADD COLUMN     "governanceSettings" JSONB;

-- AlterTable
ALTER TABLE "TrustLedgerEntry" ADD COLUMN     "matterId" TEXT,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- CreateTable
CREATE TABLE "MatterPlaybook" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "matterType" TEXT,
    "countryCode" TEXT,
    "jurisdiction" TEXT,
    "practiceArea" TEXT,
    "taskTemplates" JSONB NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatterPlaybook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "tenantId" TEXT,
    "invoiceId" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LawyerLead" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "tenantId" TEXT,
    "consumerCaseId" TEXT,
    "lawyerProfileId" TEXT,
    "issueType" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'MEDIUM',
    "summary" TEXT,
    "budget" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "reviewFeePaid" BOOLEAN NOT NULL DEFAULT false,
    "convertedMatterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LawyerLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterIssue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatterIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterArgument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "side" TEXT NOT NULL DEFAULT 'CLIENT',
    "title" TEXT NOT NULL,
    "content" TEXT,
    "strength" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatterArgument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterStrategyMemo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatterStrategyMemo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAgent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userType" TEXT NOT NULL DEFAULT 'BOTH',
    "riskLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowedTools" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIAgent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatterPlaybook_tenantId_isEnabled_idx" ON "MatterPlaybook"("tenantId", "isEnabled");

-- CreateIndex
CREATE INDEX "MatterPlaybook_tenantId_matterType_countryCode_idx" ON "MatterPlaybook"("tenantId", "matterType", "countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");

-- CreateIndex
CREATE INDEX "Receipt_tenantId_idx" ON "Receipt"("tenantId");

-- CreateIndex
CREATE INDEX "Receipt_invoiceId_idx" ON "Receipt"("invoiceId");

-- CreateIndex
CREATE INDEX "Receipt_issuedAt_idx" ON "Receipt"("issuedAt");

-- CreateIndex
CREATE INDEX "LawyerLead_userId_idx" ON "LawyerLead"("userId");

-- CreateIndex
CREATE INDEX "LawyerLead_tenantId_idx" ON "LawyerLead"("tenantId");

-- CreateIndex
CREATE INDEX "LawyerLead_status_idx" ON "LawyerLead"("status");

-- CreateIndex
CREATE INDEX "LawyerLead_countryCode_idx" ON "LawyerLead"("countryCode");

-- CreateIndex
CREATE INDEX "MatterIssue_matterId_idx" ON "MatterIssue"("matterId");

-- CreateIndex
CREATE INDEX "MatterIssue_tenantId_idx" ON "MatterIssue"("tenantId");

-- CreateIndex
CREATE INDEX "MatterArgument_matterId_idx" ON "MatterArgument"("matterId");

-- CreateIndex
CREATE INDEX "MatterStrategyMemo_matterId_idx" ON "MatterStrategyMemo"("matterId");

-- CreateIndex
CREATE UNIQUE INDEX "AIAgent_key_key" ON "AIAgent"("key");

-- CreateIndex
CREATE INDEX "TrustLedgerEntry_matterId_idx" ON "TrustLedgerEntry"("matterId");

-- AddForeignKey
ALTER TABLE "MatterPlaybook" ADD CONSTRAINT "MatterPlaybook_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawyerLead" ADD CONSTRAINT "LawyerLead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LawyerLead" ADD CONSTRAINT "LawyerLead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterIssue" ADD CONSTRAINT "MatterIssue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterIssue" ADD CONSTRAINT "MatterIssue_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterArgument" ADD CONSTRAINT "MatterArgument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterArgument" ADD CONSTRAINT "MatterArgument_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterStrategyMemo" ADD CONSTRAINT "MatterStrategyMemo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterStrategyMemo" ADD CONSTRAINT "MatterStrategyMemo_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
