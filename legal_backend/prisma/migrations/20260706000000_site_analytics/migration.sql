-- CreateTable: first-party site analytics
CREATE TABLE "SiteVisitSession" (
    "id"            TEXT NOT NULL,
    "visitorId"     TEXT NOT NULL,
    "userId"        TEXT,
    "firstSeenAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "pageViewCount" INTEGER NOT NULL DEFAULT 1,
    "landingPath"   TEXT,
    "referrer"      TEXT,
    "utmSource"     TEXT,
    "utmMedium"     TEXT,
    "utmCampaign"   TEXT,
    "utmContent"    TEXT,
    "utmTerm"       TEXT,
    "deviceType"    TEXT,
    "countryCode"   TEXT,

    CONSTRAINT "SiteVisitSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteAnalyticsEvent" (
    "id"         TEXT NOT NULL,
    "sessionId"  TEXT NOT NULL,
    "visitorId"  TEXT NOT NULL,
    "eventName"  TEXT NOT NULL,
    "path"       TEXT,
    "properties" JSONB,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteVisitSession_visitorId_idx"   ON "SiteVisitSession"("visitorId");
CREATE INDEX "SiteVisitSession_firstSeenAt_idx" ON "SiteVisitSession"("firstSeenAt");
CREATE INDEX "SiteVisitSession_utmCampaign_idx" ON "SiteVisitSession"("utmCampaign");
CREATE INDEX "SiteVisitSession_userId_idx"      ON "SiteVisitSession"("userId");

CREATE INDEX "SiteAnalyticsEvent_sessionId_idx"  ON "SiteAnalyticsEvent"("sessionId");
CREATE INDEX "SiteAnalyticsEvent_visitorId_idx"  ON "SiteAnalyticsEvent"("visitorId");
CREATE INDEX "SiteAnalyticsEvent_eventName_idx"  ON "SiteAnalyticsEvent"("eventName");
CREATE INDEX "SiteAnalyticsEvent_createdAt_idx"  ON "SiteAnalyticsEvent"("createdAt");

ALTER TABLE "SiteAnalyticsEvent"
    ADD CONSTRAINT "SiteAnalyticsEvent_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "SiteVisitSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
