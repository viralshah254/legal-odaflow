-- Add index on (tenantId, email) for the Client table to speed up
-- duplicate-email lookups performed by the service-level deduplication guard.
-- A full UNIQUE constraint is not used here because existing data may already
-- contain duplicate emails; the uniqueness is enforced in application code via
-- ClientsService.create().

CREATE INDEX IF NOT EXISTS "Client_tenantId_email_idx"
  ON "Client" ("tenantId", "email");
