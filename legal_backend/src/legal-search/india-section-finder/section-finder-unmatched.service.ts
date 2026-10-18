import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SectionFinderPopularService } from './section-finder-popular.service';

export const UNMATCHED_QUERY_STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'ignored',
] as const;

export type UnmatchedQueryStatus = (typeof UNMATCHED_QUERY_STATUSES)[number];

export interface UnmatchedParsedContext {
  actId?: string | null;
  section?: string | null;
  actToken?: string | null;
  jurisdiction?: string | null;
}

export interface FallbackTrail {
  steps: string[];
}

export type SectionFinderUnmatchedRow = Awaited<
  ReturnType<PrismaService['sectionFinderUnmatchedQuery']['findMany']>
>[number];

@Injectable()
export class SectionFinderUnmatchedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly popularService: SectionFinderPopularService,
  ) {}

  normalizeQuery(raw: string, countryCode = 'IN'): string {
    return this.popularService.normalizeQuery(raw, countryCode);
  }

  async recordUnmatched(
    countryCode: string,
    rawQuery: string,
    parsed: UnmatchedParsedContext = {},
    fallbackTrail?: FallbackTrail | string[],
  ): Promise<void> {
    const code = countryCode.toUpperCase();
    const trimmed = rawQuery.trim();
    if (!trimmed) return;

    const normalizedQuery = this.normalizeQuery(trimmed, code);
    if (!normalizedQuery) return;

    const trail: Prisma.InputJsonValue | undefined = Array.isArray(fallbackTrail)
      ? { steps: fallbackTrail }
      : fallbackTrail
        ? { steps: fallbackTrail.steps }
        : undefined;

    await this.prisma.sectionFinderUnmatchedQuery.upsert({
      where: {
        countryCode_normalizedQuery: {
          countryCode: code,
          normalizedQuery,
        },
      },
      create: {
        countryCode: code,
        rawQuery: trimmed,
        normalizedQuery,
        parsedActId: parsed.actId ?? null,
        parsedSection: parsed.section?.toUpperCase() ?? null,
        parsedActToken: parsed.actToken ?? null,
        jurisdiction: parsed.jurisdiction ?? null,
        fallbackTrail: trail,
        searchCount: 1,
        lastSearchedAt: new Date(),
        firstSearchedAt: new Date(),
      },
      update: {
        rawQuery: trimmed,
        parsedActId: parsed.actId ?? undefined,
        parsedSection: parsed.section?.toUpperCase() ?? undefined,
        parsedActToken: parsed.actToken ?? undefined,
        jurisdiction: parsed.jurisdiction ?? undefined,
        fallbackTrail: trail,
        searchCount: { increment: 1 },
        lastSearchedAt: new Date(),
      },
    });
  }

  async list(query: {
    status?: string;
    countryCode?: string;
    sort?: 'searchCount' | 'lastSearchedAt';
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(query.limit ?? 50, 200);
    const offset = query.offset ?? 0;
    const sort = query.sort ?? 'searchCount';

    const where: Prisma.SectionFinderUnmatchedQueryWhereInput = {
      countryCode: query.countryCode?.toUpperCase() || undefined,
      status: query.status || undefined,
    };

    const orderBy: Prisma.SectionFinderUnmatchedQueryOrderByWithRelationInput[] =
      sort === 'lastSearchedAt'
        ? [{ lastSearchedAt: 'desc' }, { searchCount: 'desc' }]
        : [{ searchCount: 'desc' }, { lastSearchedAt: 'desc' }];

    const [items, total] = await Promise.all([
      this.prisma.sectionFinderUnmatchedQuery.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      }),
      this.prisma.sectionFinderUnmatchedQuery.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async getStats() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [open, inProgress, resolved7d, ignored, topBySearchCount] = await Promise.all([
      this.prisma.sectionFinderUnmatchedQuery.count({ where: { status: 'open' } }),
      this.prisma.sectionFinderUnmatchedQuery.count({ where: { status: 'in_progress' } }),
      this.prisma.sectionFinderUnmatchedQuery.count({
        where: {
          status: 'resolved',
          resolvedAt: { gte: sevenDaysAgo },
        },
      }),
      this.prisma.sectionFinderUnmatchedQuery.count({ where: { status: 'ignored' } }),
      this.prisma.sectionFinderUnmatchedQuery.findMany({
        orderBy: [{ searchCount: 'desc' }, { lastSearchedAt: 'desc' }],
        take: 10,
      }),
    ]);

    return {
      open,
      inProgress,
      resolved7d,
      ignored,
      topBySearchCount,
    };
  }

  async getById(id: string): Promise<SectionFinderUnmatchedRow> {
    const row = await this.prisma.sectionFinderUnmatchedQuery.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Unmatched section query ${id} not found`);
    }
    return row;
  }

  async updateStatus(
    id: string,
    data: {
      status?: UnmatchedQueryStatus;
      resolvedNote?: string;
      resolvedByUserId?: string;
      resolvedAuthorityId?: string;
    },
  ) {
    const existing = await this.getById(id);

    if (data.status && !UNMATCHED_QUERY_STATUSES.includes(data.status)) {
      throw new BadRequestException(`Invalid status: ${data.status}`);
    }

    const resolved =
      data.status === 'resolved'
        ? {
            resolvedAt: new Date(),
            resolvedByUserId: data.resolvedByUserId ?? existing.resolvedByUserId,
            resolvedAuthorityId: data.resolvedAuthorityId ?? existing.resolvedAuthorityId,
            resolvedNote: data.resolvedNote ?? existing.resolvedNote,
          }
        : {};

    return this.prisma.sectionFinderUnmatchedQuery.update({
      where: { id },
      data: {
        status: data.status,
        resolvedNote: data.resolvedNote,
        resolvedByUserId: data.resolvedByUserId,
        resolvedAuthorityId: data.resolvedAuthorityId,
        ...resolved,
      },
    });
  }
}
