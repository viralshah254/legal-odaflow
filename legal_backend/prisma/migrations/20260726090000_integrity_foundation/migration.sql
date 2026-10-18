-- Add nullable relations first so this migration is safe for existing rows.
ALTER TABLE "Client" ADD COLUMN "address" TEXT;
ALTER TABLE "Matter" ADD COLUMN "leadAttorneyId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "matterId" TEXT;
ALTER TABLE "BulkDocumentReviewJob"
  ADD COLUMN "corpusManifest" JSONB,
  ADD COLUMN "promptVersion" TEXT NOT NULL DEFAULT 'matter-file-review-v2',
  ADD COLUMN "modelVersion" TEXT,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "staleAt" TIMESTAMP(3);

-- Promote valid legacy metadata.matterId values into the relational column.
-- Invalid, cross-tenant, and non-string values intentionally remain NULL.
UPDATE "Invoice" AS invoice
SET "matterId" = matter.id
FROM "Matter" AS matter
WHERE jsonb_typeof(invoice.metadata -> 'matterId') = 'string'
  AND invoice.metadata ->> 'matterId' = matter.id
  AND invoice."tenantId" = matter."tenantId";

-- Backfill a missing matter client only when all linked document/invoice evidence
-- points to exactly one client in the same tenant. Ambiguous rows remain nullable
-- and can be resolved operationally before a future NOT NULL migration.
WITH candidate_clients AS (
  SELECT document."matterId", document."clientId"
  FROM "Document" AS document
  WHERE document."matterId" IS NOT NULL
    AND document."clientId" IS NOT NULL
  UNION ALL
  SELECT invoice."matterId", invoice."clientId"
  FROM "Invoice" AS invoice
  WHERE invoice."matterId" IS NOT NULL
    AND invoice."clientId" IS NOT NULL
),
unambiguous_clients AS (
  SELECT "matterId", MIN("clientId") AS "clientId"
  FROM candidate_clients
  GROUP BY "matterId"
  HAVING COUNT(DISTINCT "clientId") = 1
)
UPDATE "Matter" AS matter
SET "clientId" = candidate."clientId"
FROM unambiguous_clients AS candidate
JOIN "Client" AS client ON client.id = candidate."clientId"
WHERE matter.id = candidate."matterId"
  AND matter."clientId" IS NULL
  AND client."tenantId" = matter."tenantId";

-- Matter is authoritative for client ownership on linked records.
UPDATE "Document" AS document
SET "clientId" = matter."clientId"
FROM "Matter" AS matter
WHERE document."matterId" = matter.id
  AND document."tenantId" = matter."tenantId"
  AND matter."clientId" IS NOT NULL
  AND document."clientId" IS DISTINCT FROM matter."clientId";

UPDATE "Invoice" AS invoice
SET "clientId" = matter."clientId"
FROM "Matter" AS matter
WHERE invoice."matterId" = matter.id
  AND invoice."tenantId" = matter."tenantId"
  AND matter."clientId" IS NOT NULL
  AND invoice."clientId" IS DISTINCT FROM matter."clientId";

CREATE INDEX "Matter_tenantId_leadAttorneyId_idx"
  ON "Matter"("tenantId", "leadAttorneyId");
CREATE INDEX "Invoice_tenantId_matterId_idx"
  ON "Invoice"("tenantId", "matterId");

ALTER TABLE "Matter"
  ADD CONSTRAINT "Matter_leadAttorneyId_fkey"
  FOREIGN KEY ("leadAttorneyId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_matterId_fkey"
  FOREIGN KEY ("matterId") REFERENCES "Matter"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
