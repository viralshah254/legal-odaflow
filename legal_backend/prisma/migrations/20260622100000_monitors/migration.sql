-- CreateTable
CREATE TABLE "Monitor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "jurisdiction" TEXT NOT NULL,
    "topics" TEXT[],
    "sources" TEXT[],
    "frequency" TEXT NOT NULL DEFAULT 'DAILY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Monitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitorHit" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "aiSummary" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitorHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Monitor_tenantId_idx" ON "Monitor"("tenantId");

-- CreateIndex
CREATE INDEX "Monitor_tenantId_isActive_idx" ON "Monitor"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "MonitorHit_monitorId_idx" ON "MonitorHit"("monitorId");

-- CreateIndex
CREATE INDEX "MonitorHit_tenantId_idx" ON "MonitorHit"("tenantId");

-- CreateIndex
CREATE INDEX "MonitorHit_tenantId_status_idx" ON "MonitorHit"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorHit" ADD CONSTRAINT "MonitorHit_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "Monitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
