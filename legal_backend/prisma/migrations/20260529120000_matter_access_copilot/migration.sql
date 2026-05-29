-- CreateTable
CREATE TABLE "MatterAccess" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessLevel" TEXT NOT NULL DEFAULT 'READ_ONLY',
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatterAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRole" TEXT,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopilotSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "citations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopilotAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRole" TEXT,
    "sessionId" TEXT,
    "action" TEXT NOT NULL,
    "toolName" TEXT,
    "payload" JSONB,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopilotAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatterAccess_tenantId_userId_idx" ON "MatterAccess"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "MatterAccess_matterId_idx" ON "MatterAccess"("matterId");

-- CreateIndex
CREATE UNIQUE INDEX "MatterAccess_matterId_userId_key" ON "MatterAccess"("matterId", "userId");

-- CreateIndex
CREATE INDEX "CopilotSession_tenantId_userId_idx" ON "CopilotSession"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "CopilotMessage_sessionId_idx" ON "CopilotMessage"("sessionId");

-- CreateIndex
CREATE INDEX "CopilotAuditLog_tenantId_idx" ON "CopilotAuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "CopilotAuditLog_userId_idx" ON "CopilotAuditLog"("userId");

-- CreateIndex
CREATE INDEX "CopilotAuditLog_sessionId_idx" ON "CopilotAuditLog"("sessionId");

-- AddForeignKey
ALTER TABLE "MatterAccess" ADD CONSTRAINT "MatterAccess_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterAccess" ADD CONSTRAINT "MatterAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotSession" ADD CONSTRAINT "CopilotSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotMessage" ADD CONSTRAINT "CopilotMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CopilotSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopilotAuditLog" ADD CONSTRAINT "CopilotAuditLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CopilotSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
