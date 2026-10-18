import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { parseStatuteQuery } from '@/legal-search/statute-registry';
import type { SectionFinderEntry } from './section-finder.types';

export interface PopularSectionQuery {
  displayLabel: string;
  normalizedQuery: string;
  actId?: string;
  sectionNumber?: string;
  legalAuthorityId?: string;
  title?: string;
  searchCount: number;
}

@Injectable()
export class SectionFinderPopularService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeQuery(raw: string, countryCode = 'IN'): string {
    return parseStatuteQuery(raw.trim(), countryCode).isBareActQuery
      ? raw.trim().toLowerCase().replace(/\s+/g, ' ')
      : raw.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  buildDisplayLabel(actId: string | null, section: string | null, raw: string): string {
    if (actId && section) {
      const statuteShort = actId.toUpperCase().replace(/-/g, ' ');
      return `${section} ${statuteShort}`;
    }
    return raw.trim();
  }

  async recordSearch(
    countryCode: string,
    rawQuery: string,
    match?: SectionFinderEntry,
    legalAuthorityId?: string,
  ): Promise<void> {
    const code = countryCode.toUpperCase();
    const normalizedQuery = this.normalizeQuery(rawQuery, code);
    if (!normalizedQuery) return;

    const actId = match
      ? this.inferActId(match)
      : parseStatuteQuery(rawQuery, code).actId ?? null;
    const sectionNumber = match?.legacySection ?? parseStatuteQuery(rawQuery, code).section ?? null;
    const displayLabel = match
      ? `${match.legacyActShort} §${match.legacySection}`
      : this.buildDisplayLabel(actId, sectionNumber, rawQuery);
    const title = match?.legacyTitle ?? null;

    await this.prisma.sectionFinderPopularQuery.upsert({
      where: {
        countryCode_normalizedQuery: {
          countryCode: code,
          normalizedQuery,
        },
      },
      create: {
        countryCode: code,
        normalizedQuery,
        displayLabel,
        actId,
        sectionNumber,
        legalAuthorityId: legalAuthorityId ?? null,
        title,
        searchCount: 1,
        lastSearchedAt: new Date(),
      },
      update: {
        displayLabel,
        actId,
        sectionNumber,
        legalAuthorityId: legalAuthorityId ?? undefined,
        title,
        searchCount: { increment: 1 },
        lastSearchedAt: new Date(),
      },
    });
  }

  async getPopular(countryCode: string, limit = 10): Promise<PopularSectionQuery[]> {
    const rows = await this.prisma.sectionFinderPopularQuery.findMany({
      where: { countryCode: countryCode.toUpperCase() },
      orderBy: [{ searchCount: 'desc' }, { lastSearchedAt: 'desc' }],
      take: limit,
    });

    type PopularQueryRow = Awaited<
      ReturnType<PrismaService['sectionFinderPopularQuery']['findMany']>
    >[number];

    return rows.map((row: PopularQueryRow) => ({
      displayLabel: row.displayLabel,
      normalizedQuery: row.normalizedQuery,
      actId: row.actId ?? undefined,
      sectionNumber: row.sectionNumber ?? undefined,
      legalAuthorityId: row.legalAuthorityId ?? undefined,
      title: row.title ?? undefined,
      searchCount: row.searchCount,
    }));
  }

  private inferActId(entry: SectionFinderEntry): string {
    if (entry.legacyActId && entry.legacyActId !== 'other') {
      return entry.legacyActId;
    }
    return entry.legacyActShort.toLowerCase().replace(/\s+/g, '-');
  }
}
