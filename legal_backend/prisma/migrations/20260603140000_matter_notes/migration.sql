-- Matter notes for quick matter-level annotations

CREATE TABLE "MatterNote" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "matterId"  TEXT NOT NULL,
    "body"      TEXT NOT NULL,
    "authorId"  TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatterNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MatterNote_tenantId_idx" ON "MatterNote"("tenantId");
CREATE INDEX "MatterNote_matterId_idx" ON "MatterNote"("matterId");
CREATE INDEX "MatterNote_authorId_idx" ON "MatterNote"("authorId");

ALTER TABLE "MatterNote"
    ADD CONSTRAINT "MatterNote_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatterNote"
    ADD CONSTRAINT "MatterNote_matterId_fkey"
    FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatterNote"
    ADD CONSTRAINT "MatterNote_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
