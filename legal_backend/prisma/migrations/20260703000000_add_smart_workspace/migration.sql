-- Smart Research Workspace — LiquidText+ feature

CREATE TABLE "SmartWorkspace" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "matterId"    TEXT,
  "clientId"    TEXT,
  "title"       TEXT NOT NULL,
  "layoutJson"  JSONB NOT NULL DEFAULT '{}',
  "createdBy"   TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SmartWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceDocument" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "documentId"  TEXT NOT NULL,
  "orderIndex"  INTEGER NOT NULL DEFAULT 0,
  "paneState"   JSONB,

  CONSTRAINT "WorkspaceDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentAnnotation" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "documentId"  TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "anchor"      JSONB NOT NULL,
  "content"     JSONB,
  "color"       TEXT NOT NULL DEFAULT '#FDE68A',
  "createdBy"   TEXT NOT NULL,
  "aiMetadata"  JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DocumentAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceLink" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "sourceType"  TEXT NOT NULL,
  "sourceId"    TEXT NOT NULL,
  "targetType"  TEXT NOT NULL,
  "targetId"    TEXT NOT NULL,
  "style"       JSONB,

  CONSTRAINT "WorkspaceLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CanvasNode" (
  "id"                   TEXT NOT NULL,
  "workspaceId"          TEXT NOT NULL,
  "type"                 TEXT NOT NULL,
  "positionX"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  "positionY"            DOUBLE PRECISION NOT NULL DEFAULT 0,
  "width"                DOUBLE PRECISION NOT NULL DEFAULT 280,
  "height"               DOUBLE PRECISION,
  "content"              JSONB NOT NULL,
  "linkedAnnotationIds"  TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdBy"            TEXT NOT NULL,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CanvasNode_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "SmartWorkspace" ADD CONSTRAINT "SmartWorkspace_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartWorkspace" ADD CONSTRAINT "SmartWorkspace_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SmartWorkspace" ADD CONSTRAINT "SmartWorkspace_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkspaceDocument" ADD CONSTRAINT "WorkspaceDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "SmartWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceDocument" ADD CONSTRAINT "WorkspaceDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentAnnotation" ADD CONSTRAINT "DocumentAnnotation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "SmartWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceLink" ADD CONSTRAINT "WorkspaceLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "SmartWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CanvasNode" ADD CONSTRAINT "CanvasNode_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "SmartWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "SmartWorkspace_tenantId_idx" ON "SmartWorkspace"("tenantId");
CREATE INDEX "SmartWorkspace_matterId_idx" ON "SmartWorkspace"("matterId");
CREATE INDEX "SmartWorkspace_clientId_idx" ON "SmartWorkspace"("clientId");

CREATE UNIQUE INDEX "WorkspaceDocument_workspaceId_documentId_key" ON "WorkspaceDocument"("workspaceId", "documentId");
CREATE INDEX "WorkspaceDocument_workspaceId_idx" ON "WorkspaceDocument"("workspaceId");

CREATE INDEX "DocumentAnnotation_workspaceId_idx" ON "DocumentAnnotation"("workspaceId");
CREATE INDEX "DocumentAnnotation_workspaceId_documentId_idx" ON "DocumentAnnotation"("workspaceId", "documentId");

CREATE INDEX "WorkspaceLink_workspaceId_idx" ON "WorkspaceLink"("workspaceId");
CREATE INDEX "WorkspaceLink_workspaceId_sourceId_idx" ON "WorkspaceLink"("workspaceId", "sourceId");
CREATE INDEX "WorkspaceLink_workspaceId_targetId_idx" ON "WorkspaceLink"("workspaceId", "targetId");

CREATE INDEX "CanvasNode_workspaceId_idx" ON "CanvasNode"("workspaceId");
