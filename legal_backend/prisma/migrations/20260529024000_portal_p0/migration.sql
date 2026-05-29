-- CreateTable
CREATE TABLE "PortalDocumentRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "matterId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedAt" TIMESTAMP(3),
    "uploadedFileName" TEXT,
    "uploadedFileUrl" TEXT,
    "uploadedMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalDocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "matterId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fromFirm" BOOLEAN NOT NULL DEFAULT true,
    "sentById" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortalDocumentRequest_tenantId_idx" ON "PortalDocumentRequest"("tenantId");

-- CreateIndex
CREATE INDEX "PortalDocumentRequest_clientId_idx" ON "PortalDocumentRequest"("clientId");

-- CreateIndex
CREATE INDEX "PortalDocumentRequest_matterId_idx" ON "PortalDocumentRequest"("matterId");

-- CreateIndex
CREATE INDEX "PortalDocumentRequest_status_idx" ON "PortalDocumentRequest"("status");

-- CreateIndex
CREATE INDEX "PortalDocumentRequest_dueDate_idx" ON "PortalDocumentRequest"("dueDate");

-- CreateIndex
CREATE INDEX "PortalMessage_tenantId_idx" ON "PortalMessage"("tenantId");

-- CreateIndex
CREATE INDEX "PortalMessage_clientId_idx" ON "PortalMessage"("clientId");

-- CreateIndex
CREATE INDEX "PortalMessage_matterId_idx" ON "PortalMessage"("matterId");

-- CreateIndex
CREATE INDEX "PortalMessage_createdAt_idx" ON "PortalMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "PortalDocumentRequest" ADD CONSTRAINT "PortalDocumentRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalDocumentRequest" ADD CONSTRAINT "PortalDocumentRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalDocumentRequest" ADD CONSTRAINT "PortalDocumentRequest_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalDocumentRequest" ADD CONSTRAINT "PortalDocumentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMessage" ADD CONSTRAINT "PortalMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMessage" ADD CONSTRAINT "PortalMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMessage" ADD CONSTRAINT "PortalMessage_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMessage" ADD CONSTRAINT "PortalMessage_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
