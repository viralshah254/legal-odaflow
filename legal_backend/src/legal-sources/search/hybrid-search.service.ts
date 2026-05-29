import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { EmbeddingService } from '@/embeddings/embedding.service';

export interface HybridSearchFilters {
  countryCode: string;
  jurisdiction?: string;
  practiceArea?: string;
  limit?: number;
}

export interface HybridSearchResult {
  id: string;
  title: string;
  citation: string | null;
  sourceName: string;
  summary: string | null;
  countryCode: string;
  jurisdiction: string | null;
  authorityType: string;
  score: number;
}

@Injectable()
export class HybridSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async search(query: string, filters: HybridSearchFilters): Promise<HybridSearchResult[]> {
    const normalizedQuery = query.trim();
    const limit = filters.limit ?? 10;
    const countryCode = filters.countryCode.toUpperCase();

    const keywordResults = await this.searchKeyword(normalizedQuery, filters, limit);
    const vectorResults = this.embeddingService.isRagEnabled()
      ? await this.searchVector(normalizedQuery, countryCode, limit)
      : [];

    const merged = new Map<string, HybridSearchResult>();

    for (const row of keywordResults) {
      merged.set(row.id, row);
    }

    for (const row of vectorResults) {
      const existing = merged.get(row.id);
      if (existing) {
        existing.score = Math.max(existing.score, row.score);
        if (!existing.summary && row.summary) {
          existing.summary = row.summary;
        }
      } else {
        merged.set(row.id, row);
      }
    }

    return [...merged.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private async searchKeyword(
    normalizedQuery: string,
    filters: HybridSearchFilters,
    limit: number,
  ): Promise<HybridSearchResult[]> {
    const countryCode = filters.countryCode.toUpperCase();
    const where = {
      countryCode,
      jurisdiction: filters.jurisdiction || undefined,
      OR: normalizedQuery
        ? [
            { title: { contains: normalizedQuery, mode: 'insensitive' as const } },
            { citation: { contains: normalizedQuery, mode: 'insensitive' as const } },
            { summary: { contains: normalizedQuery, mode: 'insensitive' as const } },
            { fullText: { contains: normalizedQuery, mode: 'insensitive' as const } },
            { holding: { contains: normalizedQuery, mode: 'insensitive' as const } },
          ]
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
      sourceName: authority.sourceName,
      summary: authority.summary,
      countryCode: authority.countryCode,
      jurisdiction: authority.jurisdiction,
      authorityType: authority.authorityType,
      score: Math.max(0.5, 1 - index * 0.05),
    }));
  }

  private async searchVector(
    normalizedQuery: string,
    countryCode: string,
    limit: number,
  ): Promise<HybridSearchResult[]> {
    if (!normalizedQuery) {
      return [];
    }

    const chunks = await this.embeddingService.searchByVector(normalizedQuery, {
      countryCode,
      limit,
    });

    if (chunks.length === 0) {
      return [];
    }

    const authorityIds = [...new Set(chunks.map((chunk) => chunk.sourceId))];
    const authorities = await this.prisma.legalAuthority.findMany({
      where: { id: { in: authorityIds } },
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
        sourceName: authority.sourceName,
        summary: authority.summary ?? chunk.content.slice(0, 280),
        countryCode: authority.countryCode,
        jurisdiction: authority.jurisdiction,
        authorityType: authority.authorityType,
        score: chunk.score,
      });
    }
    return mapped;
  }

  isEnabled(): boolean {
    return this.configService.get<string>('ENABLE_LEGAL_CONNECTORS', 'true') === 'true';
  }
}
