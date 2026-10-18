-- CreateTable
CREATE TABLE "IssueCheckerSearchLog" (
    "id" TEXT NOT NULL,
    "facts" TEXT NOT NULL,
    "issueType" TEXT,
    "countryCode" TEXT,
    "jurisdiction" TEXT,
    "mode" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueCheckerSearchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IssueCheckerSearchLog_createdAt_idx" ON "IssueCheckerSearchLog"("createdAt");

-- CreateIndex
CREATE INDEX "IssueCheckerSearchLog_countryCode_idx" ON "IssueCheckerSearchLog"("countryCode");
