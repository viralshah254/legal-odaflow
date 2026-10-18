-- Task Pattern Library: firm/user patterns + usage analytics (Phase 2 gate)

CREATE TABLE "LegalTaskPattern" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetFeature" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "practiceAreas" TEXT[],
    "tags" TEXT[],
    "statuteRefs" JSONB,
    "prefill" JSONB NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'system',
    "tenantId" TEXT,
    "userId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalTaskPattern_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskPatternUsage" (
    "id" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "targetFeature" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskPatternUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalTaskPattern_slug_key" ON "LegalTaskPattern"("slug");
CREATE INDEX "LegalTaskPattern_jurisdiction_targetFeature_idx" ON "LegalTaskPattern"("jurisdiction", "targetFeature");
CREATE INDEX "LegalTaskPattern_scope_tenantId_idx" ON "LegalTaskPattern"("scope", "tenantId");
CREATE INDEX "LegalTaskPattern_userId_idx" ON "LegalTaskPattern"("userId");
CREATE INDEX "TaskPatternUsage_patternId_createdAt_idx" ON "TaskPatternUsage"("patternId", "createdAt");
CREATE INDEX "TaskPatternUsage_tenantId_createdAt_idx" ON "TaskPatternUsage"("tenantId", "createdAt");

ALTER TABLE "LegalTaskPattern" ADD CONSTRAINT "LegalTaskPattern_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalTaskPattern" ADD CONSTRAINT "LegalTaskPattern_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskPatternUsage" ADD CONSTRAINT "TaskPatternUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskPatternUsage" ADD CONSTRAINT "TaskPatternUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
