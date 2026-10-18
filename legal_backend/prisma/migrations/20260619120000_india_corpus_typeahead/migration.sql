-- StatuteActCache: persistent act-level PDF cache metadata
CREATE TABLE "StatuteActCache" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'IN',
    "pdfSha256" TEXT NOT NULL,
    "pdfSourceUrl" TEXT NOT NULL,
    "sectionCount" INTEGER NOT NULL,
    "parsedAt" TIMESTAMP(3) NOT NULL,
    "lastVerified" TIMESTAMP(3) NOT NULL,
    "manifestActId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatuteActCache_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StatuteActCache_countryCode_idx" ON "StatuteActCache"("countryCode");

-- SectionFinderUnmatchedQuery: admin triage queue for failed lookups
CREATE TABLE "SectionFinderUnmatchedQuery" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "rawQuery" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "parsedActId" TEXT,
    "parsedSection" TEXT,
    "parsedActToken" TEXT,
    "jurisdiction" TEXT,
    "searchCount" INTEGER NOT NULL DEFAULT 1,
    "lastSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'open',
    "fallbackTrail" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolvedNote" TEXT,
    "resolvedAuthorityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionFinderUnmatchedQuery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SectionFinderUnmatchedQuery_countryCode_normalizedQuery_key" ON "SectionFinderUnmatchedQuery"("countryCode", "normalizedQuery");
CREATE INDEX "SectionFinderUnmatchedQuery_status_lastSearchedAt_idx" ON "SectionFinderUnmatchedQuery"("status", "lastSearchedAt");
CREATE INDEX "SectionFinderUnmatchedQuery_countryCode_searchCount_idx" ON "SectionFinderUnmatchedQuery"("countryCode", "searchCount");

-- Full-text search vector on LegalAuthority (pg GIN)
ALTER TABLE "LegalAuthority"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("summary", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("fullText", '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS "LegalAuthority_searchVector_gin" ON "LegalAuthority" USING GIN ("searchVector");
