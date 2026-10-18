import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

const MAX_EVENTS_PER_BATCH = 20;
const MAX_STRING_LEN = 512;

function clamp(s: string | undefined | null): string | null {
  if (!s) return null;
  return s.slice(0, MAX_STRING_LEN);
}

function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export interface IngestEventDto {
  visitorId: string;
  eventName: string;
  path?: string;
  properties?: Record<string, unknown>;
  // Session bootstrap fields (sent on first page_view of a session)
  landingPath?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  deviceType?: string;
  countryCode?: string;
}

export interface IngestBatchDto {
  events: IngestEventDto[];
  /** Seconds of active time to add to the current session (heartbeat) */
  heartbeatSeconds?: number;
  /** Required for heartbeat-only batches when events is empty */
  visitorId?: string;
}

export interface IdentifyDto {
  visitorId: string;
  userId: string;
}

@Injectable()
export class SiteAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(dto: IngestBatchDto): Promise<{ ok: true }> {
    const events = dto.events.slice(0, MAX_EVENTS_PER_BATCH);
    const heartbeatSeconds = dto.heartbeatSeconds ?? 0;

    if (events.length === 0) {
      if (heartbeatSeconds > 0 && dto.visitorId) {
        await this.applyHeartbeat(dto.visitorId.slice(0, 128), heartbeatSeconds);
      }
      return { ok: true };
    }

    // Group events by visitorId to minimize session lookups
    const byVisitor = new Map<string, IngestEventDto[]>();
    for (const e of events) {
      const vid = e.visitorId?.slice(0, 128);
      if (!vid) continue;
      if (!byVisitor.has(vid)) byVisitor.set(vid, []);
      byVisitor.get(vid)!.push(e);
    }

    await Promise.all(
      Array.from(byVisitor.entries()).map(([visitorId, evts]) =>
        this.upsertSessionAndEvents(visitorId, evts, heartbeatSeconds),
      ),
    );

    return { ok: true };
  }

  private async applyHeartbeat(visitorId: string, heartbeatSeconds: number): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    const session = await this.prisma.siteVisitSession.findFirst({
      where: { visitorId, lastSeenAt: { gte: cutoff } },
      orderBy: { lastSeenAt: 'desc' },
    });
    if (!session) return;

    await this.prisma.siteVisitSession.update({
      where: { id: session.id },
      data: {
        lastSeenAt: new Date(),
        activeSeconds: { increment: heartbeatSeconds },
      },
    });
  }

  private async upsertSessionAndEvents(
    visitorId: string,
    events: IngestEventDto[],
    heartbeatSeconds: number,
  ) {
    const first = events[0];

    // Find most recent session within last 30 minutes, otherwise create new
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    let session = await this.prisma.siteVisitSession.findFirst({
      where: { visitorId, lastSeenAt: { gte: cutoff } },
      orderBy: { lastSeenAt: 'desc' },
    });

    if (!session) {
      session = await this.prisma.siteVisitSession.create({
        data: {
          visitorId,
          landingPath: clamp(first.landingPath ?? first.path),
          referrer: clamp(first.referrer),
          utmSource: clamp(first.utmSource),
          utmMedium: clamp(first.utmMedium),
          utmCampaign: clamp(first.utmCampaign),
          utmContent: clamp(first.utmContent),
          utmTerm: clamp(first.utmTerm),
          deviceType: clamp(first.deviceType),
          countryCode: clamp(first.countryCode),
        },
      });
    }

    const now = new Date();
    await this.prisma.siteVisitSession.update({
      where: { id: session.id },
      data: {
        lastSeenAt: now,
        activeSeconds: { increment: heartbeatSeconds },
        pageViewCount: {
          increment: events.filter((e) => e.eventName === 'page_view').length,
        },
      },
    });

    if (events.length > 0) {
      await this.prisma.siteAnalyticsEvent.createMany({
        data: events.map((e) => ({
          sessionId: session!.id,
          visitorId,
          eventName: e.eventName.slice(0, 64),
          path: clamp(e.path),
          properties: (e.properties as object | undefined) ?? undefined,
        })),
      });
    }
  }

  async identify(dto: IdentifyDto): Promise<{ ok: true }> {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    const session = await this.prisma.siteVisitSession.findFirst({
      where: { visitorId: dto.visitorId, lastSeenAt: { gte: cutoff } },
      orderBy: { lastSeenAt: 'desc' },
    });
    if (session && !session.userId) {
      await this.prisma.siteVisitSession.update({
        where: { id: session.id },
        data: { userId: dto.userId },
      });
    }
    return { ok: true };
  }

  // ─── Admin queries ────────────────────────────────────────────────────────

  async getSummary() {
    const todayStart = startOfDay();
    const weekStart = daysAgo(7);

    const [
      visitorsToday,
      pageViewsToday,
      signupsToday,
      signupsThisWeek,
      issueCheckerStartsToday,
      avgSessionRaw,
    ] = await Promise.all([
      // Unique visitors today
      this.prisma.siteVisitSession
        .findMany({
          where: { firstSeenAt: { gte: todayStart } },
          select: { visitorId: true },
          distinct: ['visitorId'],
        })
        .then((r) => r.length),

      // Page views today
      this.prisma.siteVisitSession.aggregate({
        where: { firstSeenAt: { gte: todayStart } },
        _sum: { pageViewCount: true },
      }),

      // Signups today (from User table — no new tracking needed)
      this.prisma.user.count({
        where: { createdAt: { gte: todayStart } },
      }),

      // Signups this week
      this.prisma.user.count({
        where: { createdAt: { gte: weekStart } },
      }),

      // Issue checker starts today
      this.prisma.siteAnalyticsEvent.count({
        where: {
          eventName: 'issue_checker_started',
          createdAt: { gte: todayStart },
        },
      }),

      // Avg session seconds today
      this.prisma.siteVisitSession.aggregate({
        where: { firstSeenAt: { gte: todayStart } },
        _avg: { activeSeconds: true },
      }),
    ]);

    return {
      visitorsToday,
      pageViewsToday: pageViewsToday._sum.pageViewCount ?? 0,
      signupsToday,
      signupsThisWeek,
      issueCheckerStartsToday,
      avgSessionSecondsToday: Math.round(avgSessionRaw._avg.activeSeconds ?? 0),
    };
  }

  async getTimeseries(days: number) {
    const since = daysAgo(days);

    const [sessionRows, signupRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ day: string; visitors: bigint; page_views: bigint }>>`
        SELECT
          DATE("firstSeenAt") AS day,
          COUNT(DISTINCT "visitorId") AS visitors,
          SUM("pageViewCount") AS page_views
        FROM "SiteVisitSession"
        WHERE "firstSeenAt" >= ${since}
        GROUP BY DATE("firstSeenAt")
        ORDER BY day ASC
      `,
      this.prisma.$queryRaw<Array<{ day: string; signups: bigint }>>`
        SELECT DATE("createdAt") AS day, COUNT(*) AS signups
        FROM "User"
        WHERE "createdAt" >= ${since}
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
      `,
    ]);

    const signupMap = new Map(
      signupRows.map((r) => [String(r.day).slice(0, 10), Number(r.signups)]),
    );

    return sessionRows.map((r) => {
      const day = String(r.day).slice(0, 10);
      return {
        day,
        visitors: Number(r.visitors),
        pageViews: Number(r.page_views),
        signups: signupMap.get(day) ?? 0,
      };
    });
  }

  async getUtmBreakdown(days: number) {
    const since = daysAgo(days);
    const rows = await this.prisma.$queryRaw<
      Array<{ utm_source: string | null; utm_campaign: string | null; visitors: bigint }>
    >`
      SELECT
        "utmSource"   AS utm_source,
        "utmCampaign" AS utm_campaign,
        COUNT(DISTINCT "visitorId") AS visitors
      FROM "SiteVisitSession"
      WHERE "firstSeenAt" >= ${since}
      GROUP BY "utmSource", "utmCampaign"
      ORDER BY visitors DESC
      LIMIT 20
    `;

    return rows.map((r) => ({
      utmSource: r.utm_source ?? 'direct',
      utmCampaign: r.utm_campaign ?? '(none)',
      visitors: Number(r.visitors),
    }));
  }

  async getFunnel(days: number) {
    const since = daysAgo(days);

    const [landingViews, ctaClicks, checkerStarts, signups] = await Promise.all([
      this.prisma.siteAnalyticsEvent.count({
        where: { eventName: 'landing_page_viewed', createdAt: { gte: since } },
      }),
      this.prisma.siteAnalyticsEvent.count({
        where: { eventName: 'landing_cta_clicked', createdAt: { gte: since } },
      }),
      this.prisma.siteAnalyticsEvent.count({
        where: { eventName: 'issue_checker_started', createdAt: { gte: since } },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
    ]);

    const pct = (n: number, d: number) =>
      d === 0 ? 0 : Math.round((n / d) * 1000) / 10;

    return [
      { step: 'Landing viewed', count: landingViews, conversionPct: 100 },
      { step: 'CTA clicked', count: ctaClicks, conversionPct: pct(ctaClicks, landingViews) },
      { step: 'Checker started', count: checkerStarts, conversionPct: pct(checkerStarts, landingViews) },
      { step: 'Signed up', count: signups, conversionPct: pct(signups, landingViews) },
    ];
  }

  async getReferrerBreakdown(days: number) {
    const since = daysAgo(days);
    const rows = await this.prisma.$queryRaw<
      Array<{ referrer_host: string; visitors: bigint }>
    >`
      SELECT
        COALESCE(
          (regexp_match("referrer", '^https?://([^/]+)'))[1],
          'direct'
        ) AS referrer_host,
        COUNT(DISTINCT "visitorId") AS visitors
      FROM "SiteVisitSession"
      WHERE "firstSeenAt" >= ${since}
      GROUP BY referrer_host
      ORDER BY visitors DESC
      LIMIT 10
    `;

    return rows.map((r) => ({
      referrerHost: r.referrer_host || 'direct',
      visitors: Number(r.visitors),
    }));
  }

  // ── Search query logging ────────────────────────────────────────────────────

  logSearchQuery(data: {
    facts: string;
    issueType?: string | null;
    countryCode?: string | null;
    jurisdiction?: string | null;
    mode?: string | null;
    userId?: string | null;
  }): void {
    this.prisma.issueCheckerSearchLog
      .create({
        data: {
          facts: data.facts,
          issueType: data.issueType ?? null,
          countryCode: data.countryCode ?? null,
          jurisdiction: data.jurisdiction ?? null,
          mode: data.mode ?? null,
          userId: data.userId ?? null,
        },
      })
      .catch(() => {
        // Non-critical — silently swallow errors
      });
  }

  async getSearchQueries(
    days: number,
    limit: number,
    offset: number,
    sortBy: 'createdAt' | 'countryCode' | 'issueType' | 'mode' = 'createdAt',
    sortDir: 'asc' | 'desc' = 'desc',
    countryCode?: string,
    mode?: string,
  ) {
    const since = daysAgo(days);
    const orderBy = { [sortBy]: sortDir === 'asc' ? 'asc' : 'desc' } as const;
    const where = {
      createdAt: { gte: since },
      countryCode: countryCode || undefined,
      mode: mode || undefined,
    };

    const [rows, total] = await Promise.all([
      this.prisma.issueCheckerSearchLog.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.issueCheckerSearchLog.count({ where }),
    ]);
    return { rows, total };
  }
}
