CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "LegalCorpusAuthorityLevel" AS ENUM (
  'OFFICIAL_PRIMARY',
  'OFFICIAL_PROSPECTIVE',
  'OFFICIAL_ADMINISTRATIVE',
  'SECONDARY'
);

CREATE TYPE "LegalCorpusDocumentType" AS ENUM (
  'CONSTITUTION',
  'ACT',
  'REGULATION',
  'RULE',
  'ORDER',
  'LEGAL_NOTICE',
  'GAZETTE_NOTICE',
  'COUNTY_ACT',
  'BILL',
  'JUDGMENT',
  'PRACTICE_DIRECTION',
  'TREATY',
  'EAC_INSTRUMENT',
  'REGULATOR_MATERIAL',
  'FORM',
  'OTHER'
);

CREATE TYPE "LegalCorpusStatus" AS ENUM (
  'IN_FORCE',
  'PARTIALLY_IN_FORCE',
  'REPEALED',
  'SPENT',
  'PROSPECTIVE',
  'SUPERSEDED',
  'UNKNOWN'
);

CREATE TYPE "LegalCorpusVerificationStatus" AS ENUM (
  'PENDING',
  'VERIFIED',
  'QUARANTINED',
  'REJECTED'
);

CREATE TYPE "LegalCorpusExtractionMethod" AS ENUM (
  'XML',
  'HTML',
  'PDF_TEXT',
  'OCR',
  'API',
  'MANUAL'
);

CREATE TYPE "LegalCorpusRelationType" AS ENUM (
  'AMENDS',
  'AMENDED_BY',
  'REPEALS',
  'REPEALED_BY',
  'COMMENCES',
  'MADE_UNDER',
  'HAS_SUBSIDIARY',
  'SUPERSEDES',
  'CITES',
  'APPEALS_FROM',
  'TREATED_BY',
  'ENACTS_BILL'
);

CREATE TABLE "LegalCorpusDocument" (
  "id" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "workUri" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "shortTitle" TEXT,
  "capNumber" TEXT,
  "actNumber" TEXT,
  "year" INTEGER,
  "documentType" "LegalCorpusDocumentType" NOT NULL,
  "authorityLevel" "LegalCorpusAuthorityLevel" NOT NULL,
  "status" "LegalCorpusStatus" NOT NULL DEFAULT 'UNKNOWN',
  "officialSource" BOOLEAN NOT NULL DEFAULT false,
  "parentWorkUri" TEXT,
  "assentDate" TIMESTAMP(3),
  "publicationDate" TIMESTAMP(3),
  "commencementDate" TIMESTAMP(3),
  "lastVerifiedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalCorpusDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalCorpusSourcePolicy" (
  "id" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "baseUrl" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "accessMethod" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "productionApproved" BOOLEAN NOT NULL DEFAULT false,
  "permissionReference" TEXT,
  "attributionText" TEXT,
  "robotsSnapshot" JSONB,
  "termsSnapshot" JSONB,
  "maxConcurrency" INTEGER NOT NULL DEFAULT 1,
  "requestsPerMinute" INTEGER NOT NULL DEFAULT 10,
  "retryBudget" INTEGER NOT NULL DEFAULT 3,
  "emergencyDisabledAt" TIMESTAMP(3),
  "lastReviewedAt" TIMESTAMP(3),
  "nextReviewAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalCorpusSourcePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalCorpusExpression" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "expressionUri" TEXT NOT NULL,
  "expressionDate" TIMESTAMP(3),
  "language" TEXT NOT NULL DEFAULT 'eng',
  "sourceUrl" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "sourceLicense" TEXT,
  "sourcePolicyId" TEXT,
  "contentSha256" TEXT NOT NULL,
  "parserVersion" TEXT NOT NULL,
  "extractionMethod" "LegalCorpusExtractionMethod" NOT NULL,
  "ocrStatus" TEXT,
  "ocrConfidence" DOUBLE PRECISION,
  "verificationStatus" "LegalCorpusVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "normalizedText" TEXT,
  "searchText" TEXT,
  "citationSafeText" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalCorpusExpression_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalCorpusProvision" (
  "id" TEXT NOT NULL,
  "expressionId" TEXT NOT NULL,
  "parentId" TEXT,
  "provisionKey" TEXT NOT NULL,
  "provisionType" TEXT NOT NULL,
  "label" TEXT,
  "heading" TEXT,
  "ordinal" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "citationSafeText" TEXT,
  "sourceAnchor" TEXT,
  "contentSha256" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalCorpusProvision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalCorpusArtifact" (
  "id" TEXT NOT NULL,
  "expressionId" TEXT NOT NULL,
  "representation" TEXT NOT NULL,
  "storageUri" TEXT,
  "mediaType" TEXT NOT NULL,
  "contentSha256" TEXT NOT NULL,
  "byteLength" INTEGER,
  "inlineContent" BYTEA,
  "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalCorpusArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalCorpusRelation" (
  "id" TEXT NOT NULL,
  "fromDocumentId" TEXT NOT NULL,
  "toDocumentId" TEXT NOT NULL,
  "relationType" "LegalCorpusRelationType" NOT NULL,
  "effectiveDate" TIMESTAMP(3),
  "sourceUrl" TEXT,
  "confidence" DOUBLE PRECISION,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalCorpusRelation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalCorpusFetchAudit" (
  "id" TEXT NOT NULL,
  "sourcePolicyId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'GET',
  "responseStatus" INTEGER,
  "responseHash" TEXT,
  "bytesReceived" INTEGER,
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "outcome" TEXT NOT NULL,
  "errorCode" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalCorpusFetchAudit_pkey" PRIMARY KEY ("id")
);

-- Some deployments created the research-v3 registry with db push before it was
-- represented in migrations. Make this migration safe for both histories.
CREATE TABLE IF NOT EXISTS "LegalSearchDocument" (
  "id" TEXT NOT NULL,
  "canonicalId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "region" TEXT,
  "court" TEXT,
  "authority" TEXT,
  "citation" TEXT,
  "publicationDate" TIMESTAMP(3),
  "effectiveDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "sourceUrl" TEXT,
  "sourceType" TEXT NOT NULL,
  "authorityWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "checksum" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "treatmentStatus" TEXT NOT NULL DEFAULT 'good_law',
  "language" TEXT NOT NULL DEFAULT 'en',
  "rawText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalSearchDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LegalSearchDocument_canonicalId_key"
  ON "LegalSearchDocument"("canonicalId");

ALTER TABLE "LegalSearchDocument"
  ADD COLUMN IF NOT EXISTS "corpusExpressionId" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "LegalAuthority"
  ADD COLUMN IF NOT EXISTS "corpusProvisionId" TEXT;

CREATE UNIQUE INDEX "LegalCorpusDocument_workUri_key" ON "LegalCorpusDocument"("workUri");
CREATE INDEX "LegalCorpusDocument_jurisdiction_documentType_status_idx" ON "LegalCorpusDocument"("jurisdiction", "documentType", "status");
CREATE INDEX "LegalCorpusDocument_jurisdiction_authorityLevel_idx" ON "LegalCorpusDocument"("jurisdiction", "authorityLevel");
CREATE INDEX "LegalCorpusDocument_capNumber_idx" ON "LegalCorpusDocument"("capNumber");
CREATE INDEX "LegalCorpusDocument_parentWorkUri_idx" ON "LegalCorpusDocument"("parentWorkUri");
CREATE UNIQUE INDEX "LegalCorpusSourcePolicy_sourceKey_key" ON "LegalCorpusSourcePolicy"("sourceKey");
CREATE INDEX "LegalCorpusSourcePolicy_jurisdiction_enabled_idx" ON "LegalCorpusSourcePolicy"("jurisdiction", "enabled");
CREATE INDEX "LegalCorpusSourcePolicy_productionApproved_emergencyDisabledAt_idx" ON "LegalCorpusSourcePolicy"("productionApproved", "emergencyDisabledAt");
CREATE UNIQUE INDEX "LegalCorpusExpression_expressionUri_key" ON "LegalCorpusExpression"("expressionUri");
CREATE UNIQUE INDEX "LegalCorpusExpression_documentId_expressionDate_language_key" ON "LegalCorpusExpression"("documentId", "expressionDate", "language");
CREATE INDEX "LegalCorpusExpression_documentId_expressionDate_idx" ON "LegalCorpusExpression"("documentId", "expressionDate");
CREATE INDEX "LegalCorpusExpression_verificationStatus_retrievedAt_idx" ON "LegalCorpusExpression"("verificationStatus", "retrievedAt");
CREATE INDEX "LegalCorpusExpression_contentSha256_idx" ON "LegalCorpusExpression"("contentSha256");
CREATE UNIQUE INDEX "LegalCorpusProvision_expressionId_provisionKey_key" ON "LegalCorpusProvision"("expressionId", "provisionKey");
CREATE INDEX "LegalCorpusProvision_expressionId_provisionType_ordinal_idx" ON "LegalCorpusProvision"("expressionId", "provisionType", "ordinal");
CREATE INDEX "LegalCorpusProvision_parentId_idx" ON "LegalCorpusProvision"("parentId");
CREATE UNIQUE INDEX "LegalCorpusArtifact_expressionId_representation_contentSha256_key" ON "LegalCorpusArtifact"("expressionId", "representation", "contentSha256");
CREATE INDEX "LegalCorpusArtifact_contentSha256_idx" ON "LegalCorpusArtifact"("contentSha256");
CREATE UNIQUE INDEX "LegalCorpusRelation_fromDocumentId_toDocumentId_relationType_effectiveDate_key" ON "LegalCorpusRelation"("fromDocumentId", "toDocumentId", "relationType", "effectiveDate");
CREATE INDEX "LegalCorpusRelation_toDocumentId_relationType_idx" ON "LegalCorpusRelation"("toDocumentId", "relationType");
CREATE INDEX "LegalCorpusFetchAudit_sourcePolicyId_startedAt_idx" ON "LegalCorpusFetchAudit"("sourcePolicyId", "startedAt");
CREATE INDEX "LegalCorpusFetchAudit_outcome_startedAt_idx" ON "LegalCorpusFetchAudit"("outcome", "startedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "LegalSearchDocument_corpusExpressionId_key" ON "LegalSearchDocument"("corpusExpressionId");
CREATE UNIQUE INDEX IF NOT EXISTS "LegalAuthority_corpusProvisionId_key" ON "LegalAuthority"("corpusProvisionId");

ALTER TABLE "LegalCorpusExpression" ADD CONSTRAINT "LegalCorpusExpression_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "LegalCorpusDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalCorpusExpression" ADD CONSTRAINT "LegalCorpusExpression_sourcePolicyId_fkey"
  FOREIGN KEY ("sourcePolicyId") REFERENCES "LegalCorpusSourcePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalCorpusProvision" ADD CONSTRAINT "LegalCorpusProvision_expressionId_fkey"
  FOREIGN KEY ("expressionId") REFERENCES "LegalCorpusExpression"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalCorpusProvision" ADD CONSTRAINT "LegalCorpusProvision_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "LegalCorpusProvision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalAuthority" ADD CONSTRAINT "LegalAuthority_corpusProvisionId_fkey"
  FOREIGN KEY ("corpusProvisionId") REFERENCES "LegalCorpusProvision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalCorpusArtifact" ADD CONSTRAINT "LegalCorpusArtifact_expressionId_fkey"
  FOREIGN KEY ("expressionId") REFERENCES "LegalCorpusExpression"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalCorpusRelation" ADD CONSTRAINT "LegalCorpusRelation_fromDocumentId_fkey"
  FOREIGN KEY ("fromDocumentId") REFERENCES "LegalCorpusDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalCorpusRelation" ADD CONSTRAINT "LegalCorpusRelation_toDocumentId_fkey"
  FOREIGN KEY ("toDocumentId") REFERENCES "LegalCorpusDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalCorpusFetchAudit" ADD CONSTRAINT "LegalCorpusFetchAudit_sourcePolicyId_fkey"
  FOREIGN KEY ("sourcePolicyId") REFERENCES "LegalCorpusSourcePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'LegalSearchDocument_corpusExpressionId_fkey'
  ) THEN
    ALTER TABLE "LegalSearchDocument"
      ADD CONSTRAINT "LegalSearchDocument_corpusExpressionId_fkey"
      FOREIGN KEY ("corpusExpressionId") REFERENCES "LegalCorpusExpression"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX "LegalCorpusExpression_undated_document_language_key"
  ON "LegalCorpusExpression"("documentId", "language")
  WHERE "expressionDate" IS NULL;

INSERT INTO "LegalCorpusSourcePolicy" (
  "id", "sourceKey", "displayName", "baseUrl", "jurisdiction",
  "accessMethod", "enabled", "productionApproved", "attributionText",
  "maxConcurrency", "requestsPerMinute", "retryBudget", "metadata",
  "createdAt", "updatedAt"
) VALUES
  (
    'ke_policy_kenya_law', 'KENYA_LAW', 'Kenya Law',
    'https://new.kenyalaw.org', 'KE', 'crawl', false, false,
    'Source: Kenya Law, National Council for Law Reporting.',
    2, 20, 3, '{"authorityLevel":"OFFICIAL_PRIMARY"}'::jsonb,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'ke_policy_kenya_gazette', 'KENYA_GAZETTE', 'Kenya Gazette',
    'https://new.kenyalaw.org/gazettes/', 'KE', 'crawl', false, false,
    'Source: Kenya Gazette via Kenya Law.',
    1, 10, 3, '{"authorityLevel":"OFFICIAL_PRIMARY"}'::jsonb,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'ke_policy_parliament', 'KENYA_PARLIAMENT', 'Parliament of Kenya',
    'https://www.parliament.go.ke', 'KE', 'crawl', false, false,
    'Source: Parliament of Kenya.',
    1, 10, 3, '{"authorityLevel":"OFFICIAL_PROSPECTIVE"}'::jsonb,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'ke_policy_laws_africa', 'LAWS_AFRICA_KE', 'Laws.Africa Kenya API',
    'https://api.laws.africa/v3/akn/ke/', 'KE', 'api', false, false,
    'Source: Laws.Africa; verify against Kenya Law.',
    2, 30, 3, '{"authorityLevel":"SECONDARY"}'::jsonb,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("sourceKey") DO NOTHING;

-- Conservative backfill: preserve every existing KE authority without guessing
-- amendment history. Future AKN ingestion reconciles these legacy URIs to FRBR works.
INSERT INTO "LegalCorpusDocument" (
  "id", "jurisdiction", "workUri", "title", "documentType",
  "authorityLevel", "status", "officialSource", "lastVerifiedAt",
  "metadata", "createdAt", "updatedAt"
)
SELECT
  'kework_' || md5(la."id"),
  'KE',
  'legacy://ke/legal-authority/' || la."id",
  la."title",
  CASE
    WHEN la."authorityType" = 'CASE_LAW' THEN 'JUDGMENT'::"LegalCorpusDocumentType"
    WHEN lower(la."title") LIKE '%constitution%' THEN 'CONSTITUTION'::"LegalCorpusDocumentType"
    ELSE 'ACT'::"LegalCorpusDocumentType"
  END,
  CASE
    WHEN lower(la."sourceName") LIKE '%kenya law%'
      THEN 'OFFICIAL_PRIMARY'::"LegalCorpusAuthorityLevel"
    ELSE 'SECONDARY'::"LegalCorpusAuthorityLevel"
  END,
  CASE WHEN la."isRepealed" THEN 'REPEALED'::"LegalCorpusStatus" ELSE 'UNKNOWN'::"LegalCorpusStatus" END,
  lower(la."sourceName") LIKE '%kenya law%',
  CASE WHEN la."reviewedByHuman" THEN la."updatedAt" ELSE NULL END,
  jsonb_build_object('legacyLegalAuthorityId', la."id", 'requiresFrbrReconciliation', true),
  la."createdAt",
  la."updatedAt"
FROM "LegalAuthority" la
WHERE la."countryCode" = 'KE'
ON CONFLICT ("workUri") DO NOTHING;

INSERT INTO "LegalCorpusExpression" (
  "id", "documentId", "expressionUri", "sourceUrl", "sourceName",
  "sourceLicense", "contentSha256", "parserVersion", "extractionMethod",
  "verificationStatus", "retrievedAt", "normalizedText", "searchText",
  "citationSafeText", "metadata", "createdAt", "updatedAt"
)
SELECT
  'keexpr_' || md5(la."id"),
  'kework_' || md5(la."id"),
  'legacy://ke/legal-authority/' || la."id" || '/expression',
  COALESCE(la."sourceUrl", 'legacy://ke/legal-authority/' || la."id"),
  la."sourceName",
  la."sourceLicense",
  encode(
    digest(convert_to(COALESCE(la."fullText", la."summary", la."title"), 'UTF8'), 'sha256'),
    'hex'
  ),
  'legacy-backfill-v1',
  'MANUAL'::"LegalCorpusExtractionMethod",
  CASE WHEN la."reviewedByHuman" THEN 'VERIFIED'::"LegalCorpusVerificationStatus" ELSE 'PENDING'::"LegalCorpusVerificationStatus" END,
  la."updatedAt",
  la."fullText",
  la."fullText",
  la."fullText",
  jsonb_build_object(
    'legacyLegalAuthorityId', la."id",
    'hashAlgorithm', 'sha256'
  ),
  la."createdAt",
  la."updatedAt"
FROM "LegalAuthority" la
WHERE la."countryCode" = 'KE'
ON CONFLICT ("expressionUri") DO NOTHING;

INSERT INTO "LegalCorpusProvision" (
  "id", "expressionId", "provisionKey", "provisionType", "label",
  "ordinal", "text", "citationSafeText", "contentSha256", "metadata",
  "createdAt", "updatedAt"
)
SELECT
  'keprov_' || md5(la."id"),
  'keexpr_' || md5(la."id"),
  'legacy:' || la."id",
  CASE WHEN la."authorityType" = 'CASE_LAW' THEN 'JUDGMENT' ELSE 'SECTION' END,
  la."citation",
  0,
  COALESCE(la."fullText", la."summary", la."title"),
  COALESCE(la."fullText", la."summary", la."title"),
  encode(
    digest(convert_to(COALESCE(la."fullText", la."summary", la."title"), 'UTF8'), 'sha256'),
    'hex'
  ),
  jsonb_build_object(
    'legacyLegalAuthorityId', la."id",
    'hashAlgorithm', 'sha256'
  ),
  la."createdAt",
  la."updatedAt"
FROM "LegalAuthority" la
WHERE la."countryCode" = 'KE'
ON CONFLICT ("expressionId", "provisionKey") DO NOTHING;

UPDATE "LegalAuthority"
SET "corpusProvisionId" = 'keprov_' || md5("id")
WHERE "countryCode" = 'KE'
  AND "corpusProvisionId" IS NULL;

CREATE TYPE "GazetteLegalEventType" AS ENUM (
  'COMMENCEMENT', 'AMENDMENT', 'REGULATION', 'REVOCATION',
  'APPOINTMENT', 'PRACTICE_DIRECTION', 'CORRIGENDUM', 'OTHER'
);
CREATE TYPE "LegalCorpusReviewStatus" AS ENUM (
  'PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED'
);

CREATE TABLE "KenyaGazetteIssue" (
  "id" TEXT NOT NULL,
  "gazetteNumber" TEXT NOT NULL,
  "gazetteDate" TIMESTAMP(3) NOT NULL,
  "title" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "sourcePolicyId" TEXT,
  "publicationSha256" TEXT NOT NULL,
  "pageCount" INTEGER,
  "parserVersion" TEXT NOT NULL,
  "verificationStatus" "LegalCorpusVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KenyaGazetteIssue_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "KenyaGazettePage" (
  "id" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "pageNumber" INTEGER NOT NULL,
  "text" TEXT,
  "imageStorageUri" TEXT,
  "textSha256" TEXT,
  "extractionMethod" "LegalCorpusExtractionMethod" NOT NULL,
  "extractionConfidence" DOUBLE PRECISION,
  "requiresHumanReview" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KenyaGazettePage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "KenyaGazetteNotice" (
  "id" TEXT NOT NULL,
  "issueId" TEXT NOT NULL,
  "pageId" TEXT,
  "noticeNumber" TEXT NOT NULL DEFAULT '',
  "title" TEXT,
  "extractedText" TEXT NOT NULL,
  "textSha256" TEXT NOT NULL,
  "extractionConfidence" DOUBLE PRECISION NOT NULL,
  "requiresHumanReview" BOOLEAN NOT NULL DEFAULT false,
  "verificationStatus" "LegalCorpusVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KenyaGazetteNotice_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "KenyaGazetteLegalEvent" (
  "id" TEXT NOT NULL,
  "noticeId" TEXT NOT NULL,
  "eventType" "GazetteLegalEventType" NOT NULL,
  "affectedWorkUris" TEXT[],
  "effectiveDate" TIMESTAMP(3),
  "extractedText" TEXT NOT NULL,
  "extractionConfidence" DOUBLE PRECISION NOT NULL,
  "requiresHumanReview" BOOLEAN NOT NULL DEFAULT false,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedBy" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KenyaGazetteLegalEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "KenyaLawStateSnapshot" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "asOfDate" TIMESTAMP(3) NOT NULL,
  "status" "LegalCorpusStatus" NOT NULL,
  "expressionId" TEXT,
  "supportingEventIds" TEXT[],
  "evidence" JSONB NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "algorithmVersion" TEXT NOT NULL,
  CONSTRAINT "KenyaLawStateSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LegalCorpusReviewTask" (
  "id" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "reviewType" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "sourceKey" TEXT,
  "confidence" DOUBLE PRECISION,
  "reason" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "LegalCorpusReviewStatus" NOT NULL DEFAULT 'PENDING',
  "assignedTo" TEXT,
  "decisionNote" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalCorpusReviewTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KenyaGazetteIssue_sourceUrl_key" ON "KenyaGazetteIssue"("sourceUrl");
CREATE UNIQUE INDEX "KenyaGazetteIssue_gazetteNumber_gazetteDate_key" ON "KenyaGazetteIssue"("gazetteNumber", "gazetteDate");
CREATE INDEX "KenyaGazetteIssue_gazetteDate_verificationStatus_idx" ON "KenyaGazetteIssue"("gazetteDate", "verificationStatus");
CREATE UNIQUE INDEX "KenyaGazettePage_issueId_pageNumber_key" ON "KenyaGazettePage"("issueId", "pageNumber");
CREATE INDEX "KenyaGazettePage_requiresHumanReview_extractionConfidence_idx" ON "KenyaGazettePage"("requiresHumanReview", "extractionConfidence");
CREATE UNIQUE INDEX "KenyaGazetteNotice_issueId_noticeNumber_textSha256_key" ON "KenyaGazetteNotice"("issueId", "noticeNumber", "textSha256");
CREATE INDEX "KenyaGazetteNotice_noticeNumber_idx" ON "KenyaGazetteNotice"("noticeNumber");
CREATE INDEX "KenyaGazetteNotice_requiresHumanReview_verificationStatus_idx" ON "KenyaGazetteNotice"("requiresHumanReview", "verificationStatus");
CREATE INDEX "KenyaGazetteLegalEvent_eventType_effectiveDate_idx" ON "KenyaGazetteLegalEvent"("eventType", "effectiveDate");
CREATE INDEX "KenyaGazetteLegalEvent_verified_requiresHumanReview_idx" ON "KenyaGazetteLegalEvent"("verified", "requiresHumanReview");
CREATE UNIQUE INDEX "KenyaLawStateSnapshot_documentId_asOfDate_algorithmVersion_key" ON "KenyaLawStateSnapshot"("documentId", "asOfDate", "algorithmVersion");
CREATE INDEX "KenyaLawStateSnapshot_asOfDate_status_idx" ON "KenyaLawStateSnapshot"("asOfDate", "status");
CREATE UNIQUE INDEX "LegalCorpusReviewTask_reviewType_subjectType_subjectId_key" ON "LegalCorpusReviewTask"("reviewType", "subjectType", "subjectId");
CREATE INDEX "LegalCorpusReviewTask_jurisdiction_status_reviewType_idx" ON "LegalCorpusReviewTask"("jurisdiction", "status", "reviewType");
CREATE INDEX "LegalCorpusReviewTask_assignedTo_status_idx" ON "LegalCorpusReviewTask"("assignedTo", "status");

ALTER TABLE "KenyaGazetteIssue" ADD CONSTRAINT "KenyaGazetteIssue_sourcePolicyId_fkey"
  FOREIGN KEY ("sourcePolicyId") REFERENCES "LegalCorpusSourcePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KenyaGazettePage" ADD CONSTRAINT "KenyaGazettePage_issueId_fkey"
  FOREIGN KEY ("issueId") REFERENCES "KenyaGazetteIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KenyaGazetteNotice" ADD CONSTRAINT "KenyaGazetteNotice_issueId_fkey"
  FOREIGN KEY ("issueId") REFERENCES "KenyaGazetteIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KenyaGazetteNotice" ADD CONSTRAINT "KenyaGazetteNotice_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "KenyaGazettePage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KenyaGazetteLegalEvent" ADD CONSTRAINT "KenyaGazetteLegalEvent_noticeId_fkey"
  FOREIGN KEY ("noticeId") REFERENCES "KenyaGazetteNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KenyaLawStateSnapshot" ADD CONSTRAINT "KenyaLawStateSnapshot_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "LegalCorpusDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KenyaLawStateSnapshot" ADD CONSTRAINT "KenyaLawStateSnapshot_expressionId_fkey"
  FOREIGN KEY ("expressionId") REFERENCES "LegalCorpusExpression"("id") ON DELETE SET NULL ON UPDATE CASCADE;
