-- Add clientCode column (nullable for backfill)
ALTER TABLE "Client" ADD COLUMN "clientCode" TEXT;

-- Backfill existing clients with unique codes per tenant
WITH numbered AS (
  SELECT
    id,
    "tenantId",
    name,
    ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt", id) AS rn
  FROM "Client"
)
UPDATE "Client" c
SET "clientCode" = (
  UPPER(
    COALESCE(
      NULLIF(
        REGEXP_REPLACE(
          LEFT(
            REGEXP_REPLACE(TRIM(c.name), '[^a-zA-Z0-9 ]', '', 'g'),
            3
          ),
          '\s.*',
          ''
        ),
        ''
      ),
      'CL'
    )
  )
  || '-' || EXTRACT(YEAR FROM NOW())::TEXT
  || '-' || LPAD(n.rn::TEXT, 3, '0')
)
FROM numbered n
WHERE c.id = n.id;

-- Ensure no nulls remain
UPDATE "Client" SET "clientCode" = 'CL-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || SUBSTRING(id, 1, 6)
WHERE "clientCode" IS NULL;

ALTER TABLE "Client" ALTER COLUMN "clientCode" SET NOT NULL;

CREATE UNIQUE INDEX "Client_tenantId_clientCode_key" ON "Client"("tenantId", "clientCode");
