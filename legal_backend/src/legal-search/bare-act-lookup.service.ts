import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  expandQuery,
  findStatuteById,
  formatSectionCitation,
  parseStatuteQuery,
} from '@/legal-search/statute-registry';
import type { HybridSearchResult } from '@/legal-sources/search/hybrid-search.service';
import { truncateAtSentence } from '@/legal-search/text-truncate';

export interface ExactSectionResult {
  found: boolean;
  actId: string;
  section: string;
  authority?: HybridSearchResult;
}

@Injectable()
export class BareActLookupService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build the deterministic authority ID used by StatuteIngestService,
   * e.g. "statute-in-bnss-s101".
   */
  buildSectionId(countryCode: string, actId: string, section: string): string {
    return `statute-${countryCode.toLowerCase()}-${actId}-s${section.replace(/\s+/g, '')}`;
  }

  /**
   * Look up a specific statute section by its deterministic DB primary key.
   * Primary: exact ID match (statute-in-bnss-s101).
   * Fallback: exact citation match (e.g. "BNSS s.101").
   * Returns { found: false } without touching fuzzy search.
   */
  async lookupExactSection(
    actId: string,
    section: string,
    countryCode: string,
  ): Promise<ExactSectionResult> {
    const code = countryCode.toUpperCase();
    const statute = findStatuteById(actId);
    const id = this.buildSectionId(code, actId, section);

    // Primary: deterministic ID lookup
    const byId = await this.prisma.legalAuthority.findUnique({ where: { id } });
    if (byId) {
      return {
        found: true,
        actId,
        section,
        authority: this.toHybridResult(byId, 1.0),
      };
    }

    // Fallback: exact citation string match
    if (statute) {
      const citation = formatSectionCitation(statute, section);
      const byCitation = await this.prisma.legalAuthority.findFirst({
        where: {
          countryCode: code,
          citation: { equals: citation, mode: 'insensitive' },
        },
      });
      if (byCitation) {
        return {
          found: true,
          actId,
          section,
          authority: this.toHybridResult(byCitation, 0.95),
        };
      }
    }

    return { found: false, actId, section };
  }

  private toHybridResult(
    row: {
      id: string;
      title: string;
      citation: string | null;
      sourceName: string | null;
      summary: string | null;
      fullText: string | null;
      sourceUrl: string | null;
      holding: string | null;
      countryCode: string;
      jurisdiction: string | null;
      authorityType: string;
      isRepealed?: boolean;
      repealNotes?: string | null;
    },
    score: number,
  ): HybridSearchResult {
    return {
      id: row.id,
      title: row.title,
      citation: row.citation,
      sourceName: row.sourceName ?? '',
      summary: row.summary ?? (row.fullText ? truncateAtSentence(row.fullText, 400) : null),
      fullText: row.fullText,
      sourceUrl: row.sourceUrl,
      holding: row.holding,
      countryCode: row.countryCode,
      jurisdiction: row.jurisdiction,
      authorityType: row.authorityType,
      score,
      isRepealed: row.isRepealed,
      repealNotes: row.repealNotes,
    };
  }

  async lookupSection(
    query: string,
    countryCode: string,
  ): Promise<HybridSearchResult[]> {
    const code = countryCode.toUpperCase();
    const parsed = parseStatuteQuery(query, code);
    const expansion = expandQuery(query, code);

    const actId = expansion.remappedSection?.actId ?? parsed.actId;
    const section = expansion.remappedSection?.section ?? parsed.section;
    if (!actId || !section) {
      return [];
    }

    const statute = findStatuteById(actId);
    if (!statute) {
      return [];
    }

    // Exact lookup first — avoids fuzzy matches that return wrong sections.
    const exact = await this.lookupExactSection(actId, section, code);
    if (exact.found && exact.authority) {
      return [exact.authority];
    }

    // Fuzzy fallback: useful for legacy/remap queries where the section
    // ID may differ (e.g. crpc 98 → bnss 101 after remap).
    const citationVariants = [
      formatSectionCitation(statute, section),
      `${statute.shortName} s.${section}`,
      `Section ${section}`,
      `section ${section}`,
      `${statute.shortName} section ${section}`,
    ];

    const topicTokens = [
      statute.id,
      ...statute.acronyms,
      `section-${section}`,
      section,
    ];

    const authorities = await this.prisma.legalAuthority.findMany({
      where: {
        countryCode: code,
        authorityType: { in: ['STATUTE', 'STATUTE_SECTION'] },
        OR: [
          ...citationVariants.map((c) => ({
            citation: { contains: c, mode: 'insensitive' as const },
          })),
          ...citationVariants.map((c) => ({
            title: { contains: c, mode: 'insensitive' as const },
          })),
          {
            AND: [
              { title: { contains: section, mode: 'insensitive' as const } },
              {
                OR: [
                  { title: { contains: statute.shortName, mode: 'insensitive' as const } },
                  { citation: { contains: statute.shortName, mode: 'insensitive' as const } },
                  ...statute.acronyms.map((a) => ({
                    title: { contains: a, mode: 'insensitive' as const },
                  })),
                ],
              },
            ],
          },
          ...topicTokens.flatMap((t) => [
            { title: { contains: t, mode: 'insensitive' as const } },
            { citation: { contains: t, mode: 'insensitive' as const } },
            { fullText: { contains: t, mode: 'insensitive' as const } },
          ]),
        ],
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });

    return authorities.map((authority, index) => ({
      id: authority.id,
      title: authority.title,
      citation: authority.citation,
      sourceName: authority.sourceName,
      summary: authority.summary ?? (authority.fullText ? truncateAtSentence(authority.fullText, 400) : null),
      fullText: authority.fullText,
      sourceUrl: authority.sourceUrl,
      holding: authority.holding,
      countryCode: authority.countryCode,
      jurisdiction: authority.jurisdiction,
      authorityType: authority.authorityType,
      score: 1 - index * 0.05,
    }));
  }
}
