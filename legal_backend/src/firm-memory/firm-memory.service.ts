import { Injectable } from '@nestjs/common';
import { MatterAccessService } from '@/access/matter-access.service';
import { EmbeddingService } from '@/embeddings/embedding.service';
import { PrismaService } from '@/prisma/prisma.service';

const MATTER_ARTIFACT_SOURCE_TYPES = [
  'matter_fact',
  'matter_document',
  'matter_strategy_memo',
  'matter_argument',
] as const;

export interface FirmMemorySearchHit {
  id: string;
  sourceType: string;
  sourceId: string;
  matterId: string | null;
  content: string;
  score: number;
  title?: string;
}

@Injectable()
export class FirmMemoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matterAccess: MatterAccessService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async search(
    tenantId: string,
    userId: string,
    role: string | undefined,
    query: string,
    limit = 20,
  ): Promise<{ query: string; hits: FirmMemorySearchHit[] }> {
    const normalized = query.trim();
    if (!normalized) {
      return { query: normalized, hits: [] };
    }

    const accessibleMatterIds = await this.matterAccess.getAccessibleMatterIds(
      tenantId,
      userId,
      role,
    );

    const vectorHits = await this.embeddingService.searchByVector(normalized, {
      limit: limit * 3,
    });

    const keywordHits = await this.embeddingService.searchByKeyword(normalized, {
      limit: limit * 3,
    });

    const merged = [...vectorHits, ...keywordHits];
    const seen = new Set<string>();
    const enriched: FirmMemorySearchHit[] = [];

    for (const hit of merged) {
      const dedupeKey = `${hit.sourceType}:${hit.sourceId}:${hit.chunkIndex}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);

      const resolved = await this.resolveArtifact(tenantId, hit.sourceType, hit.sourceId);
      if (!resolved || resolved.tenantId !== tenantId) {
        continue;
      }

      if (
        accessibleMatterIds !== null &&
        resolved.matterId &&
        !accessibleMatterIds.includes(resolved.matterId)
      ) {
        continue;
      }

      if (
        accessibleMatterIds !== null &&
        !resolved.matterId &&
        !MATTER_ARTIFACT_SOURCE_TYPES.includes(
          hit.sourceType as (typeof MATTER_ARTIFACT_SOURCE_TYPES)[number],
        )
      ) {
        continue;
      }

      enriched.push({
        id: hit.id,
        sourceType: hit.sourceType,
        sourceId: hit.sourceId,
        matterId: resolved.matterId,
        content: hit.content,
        score: 'score' in hit ? Number(hit.score) : 0.5,
        title: resolved.title,
      });

      if (enriched.length >= limit) {
        break;
      }
    }

    return {
      query: normalized,
      hits: enriched.sort((a, b) => b.score - a.score),
    };
  }

  private async resolveArtifact(
    tenantId: string,
    sourceType: string,
    sourceId: string,
  ): Promise<{ tenantId: string; matterId: string | null; title?: string } | null> {
    switch (sourceType) {
      case 'matter_fact': {
        const fact = await this.prisma.matterFact.findFirst({
          where: { id: sourceId, tenantId },
          select: { tenantId: true, matterId: true, factText: true },
        });
        return fact
          ? { tenantId: fact.tenantId, matterId: fact.matterId, title: fact.factText.slice(0, 80) }
          : null;
      }
      case 'matter_document': {
        const doc = await this.prisma.document.findFirst({
          where: { id: sourceId, tenantId },
          select: { tenantId: true, matterId: true, fileName: true },
        });
        return doc
          ? { tenantId: doc.tenantId, matterId: doc.matterId, title: doc.fileName }
          : null;
      }
      case 'matter_strategy_memo': {
        const memo = await this.prisma.matterStrategyMemo.findFirst({
          where: { id: sourceId, tenantId },
          select: { tenantId: true, matterId: true, title: true },
        });
        return memo
          ? { tenantId: memo.tenantId, matterId: memo.matterId, title: memo.title }
          : null;
      }
      case 'matter_argument': {
        const argument = await this.prisma.matterArgument.findFirst({
          where: { id: sourceId, tenantId },
          select: { tenantId: true, matterId: true, title: true },
        });
        return argument
          ? { tenantId: argument.tenantId, matterId: argument.matterId, title: argument.title }
          : null;
      }
      default:
        return null;
    }
  }
}
