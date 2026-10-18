import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService, EmbeddingChunkSet } from '@/embeddings/embedding.service';
import { PrismaService } from '@/prisma/prisma.service';
import { isHeadingOnlySection } from './parsers/india-act-text.parser';
import { LegalAwareChunkerService } from './legal-aware-chunker.service';
import { hasCaseTitleContamination } from './statute-ingest.service';

export interface StatuteActQuality {
  actId: string;
  total: number;
  headingOnly: number;
  headingOnlyRatio: number;
  pendingEmbeddings: number;
}

export interface StatuteQualitySummary {
  acts: StatuteActQuality[];
  overall: Omit<StatuteActQuality, 'actId' | 'pendingEmbeddings'> & {
    pendingEmbeddings: number;
  };
}

export interface BackfillEmbeddingResult {
  authorities: number;
  chunks: number;
  batches: number;
  errors: string[];
}

export interface PurgeContaminatedResult {
  authorities: number;
  chunks: number;
  contentHashes: number;
  authorityIds: string[];
}

export function partitionRegisteredManifestActs(
  manifestActIds: string[],
  resolveRegistryId: (manifestActId: string) => string | undefined,
): {
  manifestByRegistryId: Map<string, string>;
  unregistered: string[];
} {
  const manifestByRegistryId = new Map<string, string>();
  const unregistered: string[] = [];
  for (const manifestActId of manifestActIds) {
    const registryId = resolveRegistryId(manifestActId);
    if (!registryId) {
      unregistered.push(manifestActId);
    } else if (!manifestByRegistryId.has(registryId)) {
      manifestByRegistryId.set(registryId, manifestActId);
    }
  }
  return { manifestByRegistryId, unregistered };
}

export function selectParseActIds(
  quality: StatuteActQuality[],
  threshold: number,
  excluded = new Set<string>(),
): string[] {
  return quality
    .filter(
      (act) =>
        !excluded.has(act.actId) &&
        (act.total === 0 || act.headingOnlyRatio > threshold),
    )
    .map((act) => act.actId);
}

export function selectEmbedActIds(
  quality: StatuteActQuality[],
  excluded = new Set<string>(),
): string[] {
  return quality
    .filter(
      (act) => !excluded.has(act.actId) && act.pendingEmbeddings > 0,
    )
    .map((act) => act.actId);
}

export function packEmbeddingChunkSets(
  sets: EmbeddingChunkSet[],
  maxTexts: number,
): EmbeddingChunkSet[][] {
  if (!Number.isInteger(maxTexts) || maxTexts < 1) {
    throw new Error('Embedding batch size must be a positive integer');
  }
  const batches: EmbeddingChunkSet[][] = [];
  let batch: EmbeddingChunkSet[] = [];
  let size = 0;
  for (const set of sets) {
    if (set.chunks.length > maxTexts) {
      if (batch.length > 0) {
        batches.push(batch);
        batch = [];
        size = 0;
      }
      // Keep an oversized authority as one atomic replacement job. The
      // embedding service splits its provider requests while retaining all
      // vectors in memory until the complete authority can be committed.
      batches.push([set]);
      continue;
    }
    if (size + set.chunks.length > maxTexts && batch.length > 0) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(set);
    size += set.chunks.length;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

export async function runBounded<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const width = Math.max(1, Math.floor(concurrency));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(width, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index], index);
      }
    }),
  );
}

@Injectable()
export class IndiaStatuteBackfillService {
  private readonly logger = new Logger(IndiaStatuteBackfillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingService,
    private readonly chunker: LegalAwareChunkerService,
  ) {}

  async purgeContaminated(actIds: string[]): Promise<PurgeContaminatedResult> {
    if (actIds.length === 0) {
      return { authorities: 0, chunks: 0, contentHashes: 0, authorityIds: [] };
    }

    const rows = await this.prisma.legalAuthority.findMany({
      where: {
        countryCode: 'IN',
        authorityType: 'STATUTE_SECTION',
        OR: actIds.map((actId) => ({
          id: { startsWith: `statute-in-${actId}-s` },
        })),
      },
      select: {
        id: true,
        title: true,
        fullText: true,
        isRepealed: true,
      },
    });
    const ids = rows
      .filter((row) => {
        const section = row.id.slice(row.id.lastIndexOf('-s') + 2);
        return (
          section === '0' ||
          isHeadingOnlySection({
            section,
            title: row.title,
            fullText: row.fullText ?? '',
            isRepealed: row.isRepealed,
          }) ||
          hasCaseTitleContamination({
            title: row.title,
            fullText: row.fullText ?? '',
          })
        );
      })
      .map((row) => row.id);

    if (ids.length === 0) {
      return { authorities: 0, chunks: 0, contentHashes: 0, authorityIds: [] };
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.aICitation.updateMany({
        where: { authorityId: { in: ids } },
        data: { authorityId: null },
      });
      const chunks = await tx.embeddingChunk.deleteMany({
        where: { sourceType: 'LEGAL_AUTHORITY', sourceId: { in: ids } },
      });
      const contentHashes = await tx.contentHash.deleteMany({
        where: { sourceType: 'LEGAL_AUTHORITY', sourceId: { in: ids } },
      });
      const authorities = await tx.legalAuthority.deleteMany({
        where: { id: { in: ids } },
      });
      return {
        authorities: authorities.count,
        chunks: chunks.count,
        contentHashes: contentHashes.count,
        authorityIds: ids,
      };
    });
  }

  async qualitySummary(actIds: string[]): Promise<StatuteQualitySummary> {
    const rows = actIds.length
      ? await this.prisma.legalAuthority.findMany({
          where: {
            countryCode: 'IN',
            authorityType: 'STATUTE_SECTION',
            OR: actIds.map((actId) => ({
              id: { startsWith: `statute-in-${actId}-s` },
            })),
          },
          select: {
            id: true,
            title: true,
            fullText: true,
            isRepealed: true,
            embeddingStatus: true,
          },
        })
      : [];

    const acts = actIds.map((actId) => {
      const prefix = `statute-in-${actId}-s`;
      const actRows = rows.filter((row) => row.id.startsWith(prefix));
      const headingOnly = actRows.filter((row) =>
        isHeadingOnlySection({
          section: row.id.slice(prefix.length),
          title: row.title,
          fullText: row.fullText ?? '',
          isRepealed: row.isRepealed,
        }),
      ).length;
      const pendingEmbeddings = actRows.filter(
        (row) => row.embeddingStatus !== 'COMPLETED',
      ).length;
      return {
        actId,
        total: actRows.length,
        headingOnly,
        headingOnlyRatio: actRows.length === 0 ? 1 : headingOnly / actRows.length,
        pendingEmbeddings,
      };
    });

    const total = acts.reduce((sum, act) => sum + act.total, 0);
    const headingOnly = acts.reduce((sum, act) => sum + act.headingOnly, 0);
    return {
      acts,
      overall: {
        total,
        headingOnly,
        headingOnlyRatio: total === 0 ? 1 : headingOnly / total,
        pendingEmbeddings: acts.reduce(
          (sum, act) => sum + act.pendingEmbeddings,
          0,
        ),
      },
    };
  }

  async embedPending(
    actIds: string[],
    options: { batchSize: number; concurrency: number },
  ): Promise<BackfillEmbeddingResult> {
    const authorities = actIds.length
      ? await this.prisma.legalAuthority.findMany({
          where: {
            countryCode: 'IN',
            authorityType: 'STATUTE_SECTION',
            embeddingStatus: { in: ['PENDING', 'FAILED', 'PROCESSING'] },
            OR: actIds.map((actId) => ({
              id: { startsWith: `statute-in-${actId}-s` },
            })),
          },
          select: {
            id: true,
            title: true,
            citation: true,
            summary: true,
            fullText: true,
            countryCode: true,
          },
          orderBy: { id: 'asc' },
        })
      : [];
    const modelName = this.embeddings.getEmbeddingModel();
    const sets: EmbeddingChunkSet[] = authorities.map((authority) => {
      const content = [
        authority.title,
        authority.citation,
        authority.summary,
        authority.fullText,
      ]
        .filter(Boolean)
        .join('\n\n');
      const texts = this.chunker.chunkToStrings(content);
      const chunks = (texts.length > 0 ? texts : [content]).map(
        (chunkContent, chunkIndex) => ({
          sourceType: 'LEGAL_AUTHORITY',
          sourceId: authority.id,
          chunkIndex,
          content: chunkContent,
          countryCode: authority.countryCode,
          modelName,
        }),
      );
      return { sourceType: 'LEGAL_AUTHORITY', sourceId: authority.id, chunks };
    });
    const batches = packEmbeddingChunkSets(sets, options.batchSize);
    const errors: string[] = [];
    let chunks = 0;

    await runBounded(batches, options.concurrency, async (batch, index) => {
      const sourceIds = batch.map((set) => set.sourceId);
      await this.prisma.legalAuthority.updateMany({
        where: { id: { in: sourceIds } },
        data: { embeddingStatus: 'PROCESSING' },
      });
      try {
        const result = await this.embeddings.replaceChunkSets(batch, {
          maxTextsPerRequest: options.batchSize,
        });
        chunks += result.stored;
        await this.prisma.legalAuthority.updateMany({
          where: { id: { in: sourceIds } },
          data: { embeddingStatus: 'COMPLETED' },
        });
        this.logger.log(
          `Embedding batch ${index + 1}/${batches.length}: ${sourceIds.length} authorities, ${result.stored} chunks`,
        );
      } catch (error) {
        const message = `Embedding batch ${index + 1}: ${
          error instanceof Error ? error.message : String(error)
        }`;
        errors.push(message);
        await this.prisma.legalAuthority.updateMany({
          where: { id: { in: sourceIds } },
          data: { embeddingStatus: 'FAILED' },
        });
        this.logger.error(message);
      }
    });

    return {
      authorities: authorities.length,
      chunks,
      batches: batches.length,
      errors,
    };
  }
}
