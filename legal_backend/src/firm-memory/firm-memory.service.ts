import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(FirmMemoryService.name);

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

    try {
      return await this.searchInternal(tenantId, userId, role, normalized, limit);
    } catch (err) {
      this.logger.warn(
        `Firm memory search failed (non-critical): ${err instanceof Error ? err.message : String(err)}`,
      );
      return { query: normalized, hits: [] };
    }
  }

  private async searchInternal(
    tenantId: string,
    userId: string,
    role: string | undefined,
    normalized: string,
    limit: number,
  ): Promise<{ query: string; hits: FirmMemorySearchHit[] }> {
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
        resolved.matterId &&
        (await this.isBlockedByEthicalWall(tenantId, userId, resolved.matterId))
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

  private async isBlockedByEthicalWall(
    tenantId: string,
    userId: string,
    matterId: string,
  ): Promise<boolean> {
    const walls = await this.prisma.ethicalWallGroup.findMany({
      where: { tenantId, isActive: true },
    });

    for (const wall of walls) {
      const matterIds = (wall.matterIds as string[]) ?? [];
      const userIds = (wall.userIds as string[]) ?? [];
      if (matterIds.includes(matterId) && userIds.includes(userId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Write-path: embed and store approved work product into the firm memory index.
   * Future searches will retrieve this content when relevant to new matters.
   */
  async ingest(
    tenantId: string,
    _userId: string,
    payload: {
      sourceType: string;
      sourceId: string;
      matterId?: string;
      title?: string;
      content: string;
      practiceArea?: string;
      jurisdiction?: string;
      tags?: string[];
    },
  ): Promise<{ ingested: boolean; chunkCount: number }> {
    try {
      const rawChunks = this.chunkContent(payload.content);
      const modelName = this.embeddingService.getEmbeddingModel();
      const chunks = rawChunks.map((content, i) => ({
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        chunkIndex: i,
        content,
        jurisdiction: payload.jurisdiction,
        modelName,
        metadata: {
          tenantId,
          matterId: payload.matterId ?? null,
          title: payload.title ?? null,
          practiceArea: payload.practiceArea ?? null,
          tags: payload.tags ?? [],
        },
      }));
      const result = await this.embeddingService.storeChunks(chunks);
      return { ingested: true, chunkCount: result.stored };
    } catch (err) {
      this.logger.warn(`Firm memory ingest failed for ${payload.sourceId}: ${String(err)}`);
      return { ingested: false, chunkCount: 0 };
    }
  }

  /**
   * Compare a draft clause against firm precedents from memory + synthesize market position.
   * Returns firm precedent hits + a brief market-position summary.
   */
  async compareClause(
    tenantId: string,
    userId: string,
    role: string | undefined,
    payload: {
      clauseText: string;
      clauseKind?: string;
      practiceArea?: string;
      jurisdiction?: string;
    },
  ): Promise<{
    firmPrecedents: FirmMemorySearchHit[];
    clauseKind: string | null;
    marketPosition: string;
    redFlags: string[];
  }> {
    const query = `${payload.clauseKind ?? ''} ${payload.clauseText.slice(0, 300)}`.trim();
    const { hits } = await this.search(tenantId, userId, role, query, 5);

    // Build a simple market position note from what we found
    const hasPrecedents = hits.length > 0;
    const marketPosition = hasPrecedents
      ? `Found ${hits.length} similar clause(s) in firm precedents. Review and compare positions below.`
      : 'No firm precedents found for this clause type. Consider checking market standards for this jurisdiction.';

    const redFlags: string[] = [];
    const lower = payload.clauseText.toLowerCase();
    if (lower.includes('unlimited liability')) redFlags.push('Unlimited liability exposure detected');
    if (lower.includes('perpetual')) redFlags.push('Perpetual obligation — consider sunset clause');
    if (lower.includes('sole discretion')) redFlags.push('Sole discretion language — often non-negotiable, flag for review');
    if (lower.includes('indemnif') && !lower.includes('mutual')) redFlags.push('One-sided indemnification — check for mutual indemnity');

    return {
      firmPrecedents: hits,
      clauseKind: payload.clauseKind ?? null,
      marketPosition,
      redFlags,
    };
  }

  /** Split content into ~512-token chunks for embedding. */
  private chunkContent(content: string, maxChunkLen = 1800): string[] {
    const chunks: string[] = [];
    const paragraphs = content.split(/\n{2,}/);
    let current = '';
    for (const para of paragraphs) {
      if ((current + '\n\n' + para).length > maxChunkLen && current) {
        chunks.push(current.trim());
        current = para;
      } else {
        current = current ? current + '\n\n' + para : para;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length ? chunks : [content.slice(0, maxChunkLen)];
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
