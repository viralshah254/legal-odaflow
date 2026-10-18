-- Add optimistic locking to existing research workspaces without rewriting rows.
ALTER TABLE "ResearchWorkspace"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

-- Durable, ordered links from a workspace to immutable AI outputs.
CREATE TABLE "ResearchWorkspaceRevision" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "aiOutputId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "matterId" TEXT,
  "revision" INTEGER NOT NULL,
  "affectedIssueIds" JSONB,
  "provenance" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ResearchWorkspaceRevision_pkey" PRIMARY KEY ("id")
);

-- Structured context remains addressable by a stable ID and ordered per workspace.
CREATE TABLE "ResearchWorkspaceContextItem" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "matterId" TEXT,
  "ordinal" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "label" TEXT,
  "content" JSONB NOT NULL,
  "provenance" JSONB NOT NULL,
  "affectedIssueIds" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ResearchWorkspaceContextItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResearchWorkspace_tenantId_userId_updatedAt_idx"
  ON "ResearchWorkspace"("tenantId", "userId", "updatedAt");
CREATE UNIQUE INDEX "ResearchWorkspaceRevision_workspaceId_revision_key"
  ON "ResearchWorkspaceRevision"("workspaceId", "revision");
CREATE INDEX "ResearchWorkspaceRevision_tenantId_userId_workspaceId_revision_idx"
  ON "ResearchWorkspaceRevision"("tenantId", "userId", "workspaceId", "revision");
CREATE INDEX "ResearchWorkspaceRevision_aiOutputId_idx"
  ON "ResearchWorkspaceRevision"("aiOutputId");
CREATE INDEX "ResearchWorkspaceRevision_tenantId_matterId_idx"
  ON "ResearchWorkspaceRevision"("tenantId", "matterId");
CREATE UNIQUE INDEX "ResearchWorkspaceContextItem_workspaceId_ordinal_key"
  ON "ResearchWorkspaceContextItem"("workspaceId", "ordinal");
CREATE INDEX "ResearchWorkspaceContextItem_tenantId_userId_workspaceId_ordinal_idx"
  ON "ResearchWorkspaceContextItem"("tenantId", "userId", "workspaceId", "ordinal");
CREATE INDEX "ResearchWorkspaceContextItem_tenantId_matterId_idx"
  ON "ResearchWorkspaceContextItem"("tenantId", "matterId");

ALTER TABLE "ResearchWorkspaceRevision"
  ADD CONSTRAINT "ResearchWorkspaceRevision_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "ResearchWorkspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchWorkspaceRevision"
  ADD CONSTRAINT "ResearchWorkspaceRevision_aiOutputId_fkey"
  FOREIGN KEY ("aiOutputId") REFERENCES "AIOutput"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResearchWorkspaceContextItem"
  ADD CONSTRAINT "ResearchWorkspaceContextItem_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "ResearchWorkspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
