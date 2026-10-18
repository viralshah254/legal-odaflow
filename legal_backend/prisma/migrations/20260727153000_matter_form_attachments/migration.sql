CREATE TABLE "MatterFormAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "attachedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatterFormAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatterFormAttachment_matterId_formId_key"
ON "MatterFormAttachment"("matterId", "formId");

CREATE INDEX "MatterFormAttachment_tenantId_matterId_idx"
ON "MatterFormAttachment"("tenantId", "matterId");

CREATE INDEX "MatterFormAttachment_formId_idx"
ON "MatterFormAttachment"("formId");

ALTER TABLE "MatterFormAttachment"
ADD CONSTRAINT "MatterFormAttachment_matterId_fkey"
FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatterFormAttachment"
ADD CONSTRAINT "MatterFormAttachment_formId_fkey"
FOREIGN KEY ("formId") REFERENCES "JurisdictionForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
