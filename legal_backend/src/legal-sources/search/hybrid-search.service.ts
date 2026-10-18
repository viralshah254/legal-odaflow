import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { EmbeddingService } from '@/embeddings/embedding.service';
import { OpenSearchAdapterService } from './opensearch-adapter.service';

export interface HybridSearchFilters {
  countryCode: string;
  jurisdiction?: string;
  practiceArea?: string;
  practiceAreas?: string[];
  subPracticeArea?: string;
  nature?: string;
  limit?: number;
  /** Registry-derived topic tokens for acronym-aware keyword matching */
  searchTopics?: string[];
  /** Restrict LegalAuthority rows to selected corpus categories. */
  authorityTypes?: string[];
}

export interface HybridSearchResult {
  id: string;
  title: string;
  citation: string | null;
  neutralCitation?: string | null;
  sourceName: string;
  summary: string | null;
  fullText?: string | null;
  sourceUrl: string | null;
  holding: string | null;
  countryCode: string;
  jurisdiction: string | null;
  authorityType: string;
  court?: string | null;
  decisionDate?: Date | string | null;
  topics?: unknown;
  practiceAreas?: unknown;
  treatmentStatus?: string;
  score: number;
  isRepealed?: boolean;
  repealNotes?: string | null;
}

@Injectable()
export class HybridSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly embeddingService: EmbeddingService,
    @Optional() private readonly openSearch?: OpenSearchAdapterService,
  ) {}

  async search(query: string, filters: HybridSearchFilters): Promise<HybridSearchResult[]> {
    const normalizedQuery = query.trim();
    const limit = filters.limit ?? 10;
    const countryCode = filters.countryCode.toUpperCase();

    const [osSettled, keywordSettled, vectorSettled] = await Promise.allSettled([
      this.openSearch?.isEnabled
        ? this.openSearch.search({
            query: normalizedQuery,
            countryCode,
            practiceArea: filters.practiceArea,
            practiceAreas:
              filters.practiceAreas ?? (filters.practiceArea ? [filters.practiceArea] : undefined),
            jurisdiction: filters.jurisdiction,
            limit,
          })
        : Promise.resolve([] as HybridSearchResult[]),
      this.searchKeyword(normalizedQuery, filters, limit),
      this.embeddingService.isRagEnabled()
        ? this.searchVector(normalizedQuery, countryCode, limit, filters)
        : Promise.resolve([] as HybridSearchResult[]),
    ]);

    const resultLists: HybridSearchResult[][] = [];
    if (osSettled.status === 'fulfilled' && osSettled.value.length > 0) {
      resultLists.push(osSettled.value);
    }
    if (keywordSettled.status === 'fulfilled' && keywordSettled.value.length > 0) {
      resultLists.push(keywordSettled.value);
    }
    if (vectorSettled.status === 'fulfilled' && vectorSettled.value.length > 0) {
      resultLists.push(vectorSettled.value);
    }

    // Reciprocal Rank Fusion (RRF) — standard k=60
    // RRF score for doc d = Σ_lists 1 / (k + rank(d, list))
    const RRF_K = 60;
    const rrfScores = new Map<string, number>();
    const docMap = new Map<string, HybridSearchResult>();

    for (const list of resultLists) {
      list.forEach((doc, idx) => {
        const rank = idx + 1; // 1-indexed
        const rrf = 1 / (RRF_K + rank);
        rrfScores.set(doc.id, (rrfScores.get(doc.id) ?? 0) + rrf);
        if (!docMap.has(doc.id)) {
          docMap.set(doc.id, doc);
        } else {
          // Merge metadata from later retrievals
          const existing = docMap.get(doc.id)!;
          if (!existing.summary && doc.summary) existing.summary = doc.summary;
          if (!existing.sourceUrl && doc.sourceUrl) existing.sourceUrl = doc.sourceUrl;
          if (!existing.holding && doc.holding) existing.holding = doc.holding;
        }
      });
    }

    // Sort by RRF score descending; fall back to empty list if no results
    return [...rrfScores.entries()]
      .sort(([, a], [, b]) => b - a)
      .filter(([id]) => {
        const row = docMap.get(id);
        return (
          !filters.authorityTypes?.length ||
          (!!row && filters.authorityTypes.includes(row.authorityType))
        );
      })
      .slice(0, limit)
      .map(([id, score]) => ({ ...docMap.get(id)!, score }));
  }

  private async searchKeyword(
    normalizedQuery: string,
    filters: HybridSearchFilters,
    limit: number,
  ): Promise<HybridSearchResult[]> {
    const countryCode = filters.countryCode.toUpperCase();
    const topicClauses =
      filters.searchTopics?.slice(0, 6).flatMap((topic) => [
        { title: { contains: topic, mode: 'insensitive' as const } },
        { citation: { contains: topic, mode: 'insensitive' as const } },
        { summary: { contains: topic, mode: 'insensitive' as const } },
        { fullText: { contains: topic, mode: 'insensitive' as const } },
      ]) ?? [];

    const where = {
      countryCode,
      jurisdiction: filters.jurisdiction || undefined,
      authorityType: filters.authorityTypes?.length
        ? { in: filters.authorityTypes }
        : undefined,
      OR: normalizedQuery
        ? [
            { title: { contains: normalizedQuery, mode: 'insensitive' as const } },
            { citation: { contains: normalizedQuery, mode: 'insensitive' as const } },
            { summary: { contains: normalizedQuery, mode: 'insensitive' as const } },
            { fullText: { contains: normalizedQuery, mode: 'insensitive' as const } },
            { holding: { contains: normalizedQuery, mode: 'insensitive' as const } },
            ...topicClauses,
          ]
        : topicClauses.length > 0
          ? topicClauses
          : undefined,
    };

    const authorities = await this.prisma.legalAuthority.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    return authorities.map((authority, index) => ({
      id: authority.id,
      title: authority.title,
      citation: authority.citation,
      neutralCitation: authority.neutralCitation,
      sourceName: authority.sourceName,
      summary: authority.summary,
      fullText: authority.fullText,
      sourceUrl: authority.sourceUrl,
      holding: authority.holding,
      countryCode: authority.countryCode,
      jurisdiction: authority.jurisdiction,
      authorityType: authority.authorityType,
      court: authority.court,
      decisionDate: authority.decisionDate,
      topics: authority.topics,
      practiceAreas: authority.practiceAreas,
      treatmentStatus: authority.treatmentStatus,
      score: Math.max(0.5, 1 - index * 0.05),
      isRepealed: authority.isRepealed,
      repealNotes: authority.repealNotes,
    }));
  }

  private async searchVector(
    normalizedQuery: string,
    countryCode: string,
    limit: number,
    filters?: HybridSearchFilters,
  ): Promise<HybridSearchResult[]> {
    if (!normalizedQuery) {
      return [];
    }

    const chunks = await this.embeddingService.searchByVector(normalizedQuery, {
      countryCode,
      limit,
      practiceArea: filters?.practiceArea ?? filters?.practiceAreas?.[0],
    });

    if (chunks.length === 0) {
      return [];
    }

    const authorityIds = [...new Set(chunks.map((chunk) => chunk.sourceId))];
    const authorities = await this.prisma.legalAuthority.findMany({
      where: {
        id: { in: authorityIds },
        authorityType: filters?.authorityTypes?.length
          ? { in: filters.authorityTypes }
          : undefined,
      },
    });
    const authorityMap = new Map(authorities.map((row) => [row.id, row]));

    const mapped: HybridSearchResult[] = [];
    for (const chunk of chunks) {
      const authority = authorityMap.get(chunk.sourceId);
      if (!authority) {
        continue;
      }
      mapped.push({
        id: authority.id,
        title: authority.title,
        citation: authority.citation,
        neutralCitation: authority.neutralCitation,
        sourceName: authority.sourceName,
        summary: authority.summary ?? chunk.content.slice(0, 280),
        fullText: authority.fullText,
        sourceUrl: authority.sourceUrl,
        holding: authority.holding,
        countryCode: authority.countryCode,
        jurisdiction: authority.jurisdiction,
        authorityType: authority.authorityType,
        court: authority.court,
        decisionDate: authority.decisionDate,
        topics: authority.topics,
        practiceAreas: authority.practiceAreas,
        treatmentStatus: authority.treatmentStatus,
        score: chunk.score,
        isRepealed: authority.isRepealed,
        repealNotes: authority.repealNotes,
      });
    }
    return mapped;
  }

  isEnabled(): boolean {
    return this.configService.get<string>('ENABLE_LEGAL_CONNECTORS', 'true') === 'true';
  }

  /**
   * Full-text search over ingested statute sections using the pg GIN searchVector column.
   * Falls back to ILIKE when tsquery returns no hits (e.g. section tokens like "80C").
   */
  async searchStatuteSectionsPg(
    query: string,
    filters: { countryCode: string; limit?: number },
  ): Promise<HybridSearchResult[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];

    const limit = filters.limit ?? 10;
    const countryCode = filters.countryCode.toUpperCase();

    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          title: string;
          citation: string | null;
          sourceName: string;
          summary: string | null;
          fullText: string | null;
          sourceUrl: string | null;
          holding: string | null;
          countryCode: string;
          jurisdiction: string | null;
          authorityType: string;
          isRepealed: boolean;
          repealNotes: string | null;
          rank: number;
        }>
      >`
        SELECT
          id,
          title,
          citation,
          "sourceName",
          summary,
          "fullText",
          "sourceUrl",
          holding,
          "countryCode",
          jurisdiction,
          "authorityType",
          "isRepealed",
          "repealNotes",
          ts_rank("searchVector", plainto_tsquery('english', ${normalizedQuery})) AS rank
        FROM "LegalAuthority"
        WHERE "countryCode" = ${countryCode}
          AND "authorityType" IN ('STATUTE', 'STATUTE_SECTION')
          AND "searchVector" @@ plainto_tsquery('english', ${normalizedQuery})
        ORDER BY rank DESC
        LIMIT ${limit}
      `;

      if (rows.length > 0) {
        return rows.map((row, index) => ({
          id: row.id,
          title: row.title,
          citation: row.citation,
          sourceName: row.sourceName,
          summary: row.summary,
          fullText: row.fullText,
          sourceUrl: row.sourceUrl,
          holding: row.holding,
          countryCode: row.countryCode,
          jurisdiction: row.jurisdiction,
          authorityType: row.authorityType,
          score: Number(row.rank) || Math.max(0.5, 1 - index * 0.05),
          isRepealed: row.isRepealed,
          repealNotes: row.repealNotes,
        }));
      }
    } catch {
      // searchVector column may be absent before migration — fall through to ILIKE.
    }

    return this.searchStatuteSectionsIlike(normalizedQuery, countryCode, limit);
  }

  private async searchStatuteSectionsIlike(
    normalizedQuery: string,
    countryCode: string,
    limit: number,
  ): Promise<HybridSearchResult[]> {
    const authorities = await this.prisma.legalAuthority.findMany({
      where: {
        countryCode,
        authorityType: { in: ['STATUTE', 'STATUTE_SECTION'] },
        OR: [
          { title: { contains: normalizedQuery, mode: 'insensitive' } },
          { citation: { contains: normalizedQuery, mode: 'insensitive' } },
          { summary: { contains: normalizedQuery, mode: 'insensitive' } },
          { fullText: { contains: normalizedQuery, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
    });

    return authorities.map((authority, index) => ({
      id: authority.id,
      title: authority.title,
      citation: authority.citation,
      sourceName: authority.sourceName,
      summary: authority.summary,
      fullText: authority.fullText,
      sourceUrl: authority.sourceUrl,
      holding: authority.holding,
      countryCode: authority.countryCode,
      jurisdiction: authority.jurisdiction,
      authorityType: authority.authorityType,
      score: Math.max(0.4, 0.9 - index * 0.05),
      isRepealed: authority.isRepealed,
      repealNotes: authority.repealNotes,
    }));
  }
}
