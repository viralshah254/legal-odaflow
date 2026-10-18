-- DraftJob tables for the Unified Drafting Engine
-- All statements use IF NOT EXISTS for idempotency

CREATE TABLE IF NOT EXISTS "DraftJob" (
  "id"                    TEXT NOT NULL,
  "tenantId"              TEXT NOT NULL,
  "userId"                TEXT NOT NULL,
  "matterId"              TEXT,
  "profile"               TEXT NOT NULL,
  "documentKind"          TEXT NOT NULL,
  "qualityTier"           TEXT NOT NULL,
  "status"                TEXT NOT NULL DEFAULT 'queued',
  "currentStage"          TEXT NOT NULL DEFAULT 'queued',
  "idempotencyKey"        TEXT NOT NULL,
  "reservedCredits"       INTEGER NOT NULL DEFAULT 0,
  "consumedCredits"       INTEGER NOT NULL DEFAULT 0,
  "estimatedCostUsd"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "actualCostUsd"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "blockedReason"         TEXT,
  "failureReason"         TEXT,
  "normalizedMatterJson"  JSONB,
  "proceduralResultJson"  JSONB,
  "sourceRegistryJson"    JSONB,
  "executionPlanJson"     JSONB,
  "verificationReportJson" JSONB,
  "assembledDraftJson"    JSONB,
  "courtDraftRecordId"    TEXT,
  "workspaceV3Id"         TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"           TIMESTAMP(3),
  CONSTRAINT "DraftJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DraftJob_idempotencyKey_key" ON "DraftJob"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "DraftJob_tenantId_status_idx" ON "DraftJob"("tenantId","status");
CREATE INDEX IF NOT EXISTS "DraftJob_tenantId_userId_idx" ON "DraftJob"("tenantId","userId");
CREATE INDEX IF NOT EXISTS "DraftJob_idempotencyKey_idx" ON "DraftJob"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "DraftJob_courtDraftRecordId_idx" ON "DraftJob"("courtDraftRecordId");
CREATE INDEX IF NOT EXISTS "DraftJob_createdAt_idx" ON "DraftJob"("createdAt");

CREATE TABLE IF NOT EXISTS "DraftJobSection" (
  "id"           TEXT NOT NULL,
  "jobId"        TEXT NOT NULL,
  "sectionKey"   TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "sectionType"  TEXT NOT NULL,
  "content"      TEXT NOT NULL DEFAULT '',
  "status"       TEXT NOT NULL DEFAULT 'planned',
  "model"        TEXT,
  "version"      INTEGER NOT NULL DEFAULT 0,
  "repairCount"  INTEGER NOT NULL DEFAULT 0,
  "inputTokens"  INTEGER,
  "outputTokens" INTEGER,
  "durationMs"   INTEGER,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DraftJobSection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DraftJobSection_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DraftJob"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "DraftJobSection_jobId_idx" ON "DraftJobSection"("jobId");
CREATE INDEX IF NOT EXISTS "DraftJobSection_jobId_sectionKey_idx" ON "DraftJobSection"("jobId","sectionKey");
CREATE UNIQUE INDEX IF NOT EXISTS "DraftJobSection_jobId_sectionKey_key" ON "DraftJobSection"("jobId","sectionKey");

CREATE TABLE IF NOT EXISTS "DraftJobStageResult" (
  "id"         TEXT NOT NULL,
  "jobId"      TEXT NOT NULL,
  "stage"      TEXT NOT NULL,
  "outputJson" JSONB,
  "durationMs" INTEGER,
  "costUsd"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "success"    BOOLEAN NOT NULL DEFAULT true,
  "error"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DraftJobStageResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DraftJobStageResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DraftJob"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "DraftJobStageResult_jobId_stage_idx" ON "DraftJobStageResult"("jobId","stage");

CREATE TABLE IF NOT EXISTS "DraftJobIssue" (
  "id"                    TEXT NOT NULL,
  "jobId"                 TEXT NOT NULL,
  "sectionId"             TEXT,
  "paragraphId"           TEXT,
  "category"              TEXT NOT NULL,
  "severity"              TEXT NOT NULL,
  "message"               TEXT NOT NULL,
  "suggestedCorrection"   TEXT,
  "sourceId"              TEXT,
  "repairableAutomatically" BOOLEAN NOT NULL DEFAULT false,
  "validator"             TEXT NOT NULL,
  "fingerprint"           TEXT NOT NULL,
  "resolved"              BOOLEAN NOT NULL DEFAULT false,
  "resolvedByRepairId"    TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DraftJobIssue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DraftJobIssue_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DraftJob"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "DraftJobIssue_jobId_idx" ON "DraftJobIssue"("jobId");
CREATE INDEX IF NOT EXISTS "DraftJobIssue_jobId_severity_idx" ON "DraftJobIssue"("jobId","severity");
CREATE INDEX IF NOT EXISTS "DraftJobIssue_fingerprint_idx" ON "DraftJobIssue"("fingerprint");

CREATE TABLE IF NOT EXISTS "DraftJobRepair" (
  "id"               TEXT NOT NULL,
  "jobId"            TEXT NOT NULL,
  "sectionId"        TEXT NOT NULL,
  "attemptNumber"    INTEGER NOT NULL DEFAULT 1,
  "outputConstraint" TEXT NOT NULL,
  "beforeText"       TEXT NOT NULL,
  "afterText"        TEXT,
  "model"            TEXT NOT NULL,
  "issueIds"         TEXT[],
  "inputTokens"      INTEGER,
  "outputTokens"     INTEGER,
  "costUsd"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "success"          BOOLEAN NOT NULL DEFAULT false,
  "failureReason"    TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DraftJobRepair_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DraftJobRepair_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DraftJob"("id") ON DELETE CASCADE,
  CONSTRAINT "DraftJobRepair_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "DraftJobSection"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "DraftJobRepair_jobId_idx" ON "DraftJobRepair"("jobId");
CREATE INDEX IF NOT EXISTS "DraftJobRepair_sectionId_idx" ON "DraftJobRepair"("sectionId");

CREATE TABLE IF NOT EXISTS "DraftJobAuditEvent" (
  "id"        TEXT NOT NULL,
  "jobId"     TEXT NOT NULL,
  "event"     TEXT NOT NULL,
  "metadata"  JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DraftJobAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DraftJobAuditEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DraftJob"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "DraftJobAuditEvent_jobId_idx" ON "DraftJobAuditEvent"("jobId");
CREATE INDEX IF NOT EXISTS "DraftJobAuditEvent_jobId_event_idx" ON "DraftJobAuditEvent"("jobId","event");

CREATE TABLE IF NOT EXISTS "DraftJobModelUsage" (
  "id"           TEXT NOT NULL,
  "jobId"        TEXT NOT NULL,
  "stage"        TEXT NOT NULL,
  "sectionId"    TEXT,
  "model"        TEXT NOT NULL,
  "inputTokens"  INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "costUsd"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "durationMs"   INTEGER,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DraftJobModelUsage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DraftJobModelUsage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "DraftJob"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "DraftJobModelUsage_jobId_idx" ON "DraftJobModelUsage"("jobId");
CREATE INDEX IF NOT EXISTS "DraftJobModelUsage_jobId_model_idx" ON "DraftJobModelUsage"("jobId","model");
