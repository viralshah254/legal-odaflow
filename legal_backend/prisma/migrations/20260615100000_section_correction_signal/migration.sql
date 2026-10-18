-- CreateTable: SectionCorrectionSignal
-- AI-detected section correction signals for Super Admin review.
CREATE TABLE "SectionCorrectionSignal" (
    "id"                       TEXT NOT NULL,
    "countryCode"              TEXT NOT NULL,
    "queryFingerprint"         TEXT NOT NULL,
    "wrongSection"             TEXT NOT NULL,
    "correctSection"           TEXT NOT NULL,
    "primarySourceAuthorityId" TEXT,
    "supportingCaseIds"        JSONB NOT NULL DEFAULT '[]',
    "aiOutputId"               TEXT,
    "confidence"               DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status"                   TEXT NOT NULL DEFAULT 'pending',
    "reviewNotes"              TEXT,
    "reviewedByUserId"         TEXT,
    "reviewedAt"               TIMESTAMP(3),
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionCorrectionSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SectionCorrectionSignal_countryCode_status_idx" ON "SectionCorrectionSignal"("countryCode", "status");
CREATE INDEX "SectionCorrectionSignal_status_idx" ON "SectionCorrectionSignal"("status");
CREATE INDEX "SectionCorrectionSignal_aiOutputId_idx" ON "SectionCorrectionSignal"("aiOutputId");
