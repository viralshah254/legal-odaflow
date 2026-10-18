-- CreateTable
CREATE TABLE "StatuteSectionProfile" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "actId" TEXT NOT NULL,
    "sectionNumber" TEXT NOT NULL,
    "legacyActId" TEXT NOT NULL,
    "legacyActShort" TEXT NOT NULL,
    "legacyActFull" TEXT NOT NULL,
    "legacyTitle" TEXT NOT NULL,
    "newActId" TEXT NOT NULL DEFAULT 'unchanged',
    "newActShort" TEXT NOT NULL DEFAULT '',
    "newActFull" TEXT NOT NULL DEFAULT '',
    "newSection" TEXT NOT NULL DEFAULT '',
    "newTitle" TEXT NOT NULL DEFAULT '',
    "changeType" TEXT NOT NULL DEFAULT 'unchanged',
    "changeSummary" TEXT NOT NULL,
    "punishment" TEXT NOT NULL,
    "isBailable" BOOLEAN NOT NULL DEFAULT false,
    "isCognizable" BOOLEAN NOT NULL DEFAULT false,
    "isCompoundable" BOOLEAN NOT NULL DEFAULT false,
    "trialCourt" TEXT NOT NULL DEFAULT 'magistrate_first_class',
    "trialCourtLabel" TEXT NOT NULL,
    "bailPosture" TEXT NOT NULL,
    "practiceNote" TEXT,
    "sourceRef" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'crosswalk',
    "isInForce" BOOLEAN NOT NULL DEFAULT true,
    "legalAuthorityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatuteSectionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalAuthorityTranslation" (
    "id" TEXT NOT NULL,
    "legalAuthorityId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "fullText" TEXT,
    "changeSummary" TEXT,
    "practiceNote" TEXT,
    "bailPosture" TEXT,
    "punishment" TEXT,
    "sourceTextHash" TEXT NOT NULL,
    "translatedBy" TEXT NOT NULL DEFAULT 'ai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalAuthorityTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionFinderPopularQuery" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "displayLabel" TEXT NOT NULL,
    "actId" TEXT,
    "sectionNumber" TEXT,
    "legalAuthorityId" TEXT,
    "title" TEXT,
    "searchCount" INTEGER NOT NULL DEFAULT 1,
    "lastSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SectionFinderPopularQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StatuteSectionProfile_countryCode_actId_sectionNumber_key" ON "StatuteSectionProfile"("countryCode", "actId", "sectionNumber");

-- CreateIndex
CREATE INDEX "StatuteSectionProfile_countryCode_actId_idx" ON "StatuteSectionProfile"("countryCode", "actId");

-- CreateIndex
CREATE INDEX "StatuteSectionProfile_legalAuthorityId_idx" ON "StatuteSectionProfile"("legalAuthorityId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalAuthorityTranslation_legalAuthorityId_locale_key" ON "LegalAuthorityTranslation"("legalAuthorityId", "locale");

-- CreateIndex
CREATE INDEX "LegalAuthorityTranslation_locale_idx" ON "LegalAuthorityTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "SectionFinderPopularQuery_countryCode_normalizedQuery_key" ON "SectionFinderPopularQuery"("countryCode", "normalizedQuery");

-- CreateIndex
CREATE INDEX "SectionFinderPopularQuery_countryCode_searchCount_idx" ON "SectionFinderPopularQuery"("countryCode", "searchCount");

-- AddForeignKey
ALTER TABLE "StatuteSectionProfile" ADD CONSTRAINT "StatuteSectionProfile_legalAuthorityId_fkey" FOREIGN KEY ("legalAuthorityId") REFERENCES "LegalAuthority"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalAuthorityTranslation" ADD CONSTRAINT "LegalAuthorityTranslation_legalAuthorityId_fkey" FOREIGN KEY ("legalAuthorityId") REFERENCES "LegalAuthority"("id") ON DELETE CASCADE ON UPDATE CASCADE;
