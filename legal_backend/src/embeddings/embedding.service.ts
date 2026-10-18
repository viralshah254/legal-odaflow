import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { postWithRateLimitRetry } from '@/ai/llm-retry.util';
import {
  isOpenAiConfigured,
  resolveOpenAiAuthHeaders,
  resolveOpenAiRequestModel,
  resolveOpenAiUrl,
} from '@/ai/openai-transport';
import { PrismaService } from '@/prisma/prisma.service';

export interface EmbeddingChunkInput {
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  countryCode?: string;
  jurisdiction?: string;
  modelName: string;
  metadata?: Prisma.InputJsonValue;
}

export interface EmbeddingChunkSet {
  sourceType: string;
  sourceId: string;
  chunks: EmbeddingChunkInput[];
}

const MAX_EMBEDDING_INPUTS_PER_REQUEST = 2048;
const MAX_EMBEDDING_TOKENS_PER_REQUEST = 300_000;
const DEFAULT_SAFE_EMBEDDING_TOKENS_PER_REQUEST = 250_000;
const MAX_EMBEDDING_TOKENS_PER_INPUT = 8_191;

export interface VectorSearchResult {
  id: string;
  sourceType: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  countryCode: string | null;
  score: number;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  hashContent(content: string): string {
    return createHash('sha256').update(content.trim()).digest('hex');
  }

  getEmbeddingModel(): string {
    const googleModel = this.configService.get<string>('GEMINI_EMBEDDING_MODEL')?.trim();
    if (
      googleModel &&
      this.configService.get<string>('AI_EMBEDDING_PROVIDER', 'openai') === 'google'
    ) {
      return googleModel;
    }
    return this.configService.get<string>('AI_EMBEDDING_MODEL', 'text-embedding-3-small');
  }

  isRagEnabled(): boolean {
    return this.configService.get<string>('AI_ENABLE_RAG', 'true') === 'true';
  }

  private toVectorLiteral(embedding: number[]): string {
    const sanitized = embedding.map((value) => {
      if (!Number.isFinite(value)) {
        throw new Error('Invalid embedding value');
      }
      return value;
    });
    return `[${sanitized.join(',')}]`;
  }

  private estimateEmbeddingTokens(text: string): number {
    // Deliberately conservative for English and multi-byte Indian scripts.
    // The provider remains the final authority, but this prevents oversized
    // aggregate requests without introducing a tokenizer dependency.
    return Math.max(1, Math.ceil(Buffer.byteLength(text, 'utf8') / 2));
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (!isOpenAiConfigured(this.configService) || texts.length === 0) {
      return texts.map(() => []);
    }

    const modelName = this.getEmbeddingModel();
    const maxAttempts = Number(this.configService.get<string>('AI_LLM_MAX_RETRIES', '6')) || 6;

    let response: Response;
    try {
      response = await postWithRateLimitRetry(
        resolveOpenAiUrl(this.configService, 'embeddings', modelName),
        {
          method: 'POST',
          headers: {
            ...resolveOpenAiAuthHeaders(this.configService),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: resolveOpenAiRequestModel(this.configService, modelName),
            input: texts,
          }),
        },
        'OpenAI embeddings',
        { maxAttempts },
      );
    } catch {
      return texts.map(() => []);
    }

    if (!response.ok) {
      return texts.map(() => []);
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };

    return (payload.data ?? []).map((row) => row.embedding ?? []);
  }

  async embedText(text: string): Promise<number[]> {
    const [embedding] = await this.embedTexts([text]);
    return embedding ?? [];
  }

  async findByHash(hash: string) {
    const contentHash = await this.prisma.contentHash.findUnique({
      where: { hash },
    });

    if (!contentHash) {
      return null;
    }

    const chunks = await this.prisma.embeddingChunk.findMany({
      where: { contentHash: hash },
      orderBy: { chunkIndex: 'asc' },
    });

    return { contentHash, chunks };
  }

  async storeChunks(chunks: EmbeddingChunkInput[]) {
    if (chunks.length === 0) {
      return { stored: 0, skipped: 0, chunks: [] };
    }

    const embeddings = this.isRagEnabled()
      ? await this.embedTexts(chunks.map((chunk) => chunk.content))
      : chunks.map(() => []);

    const stored: Awaited<ReturnType<typeof this.prisma.embeddingChunk.upsert>>[] = [];
    let skipped = 0;

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const contentHash = this.hashContent(chunk.content);
      const existing = await this.findByHash(contentHash);

      if (existing?.chunks.some((row) => row.modelName === chunk.modelName)) {
        skipped += 1;
        continue;
      }

      await this.prisma.contentHash.upsert({
        where: { hash: contentHash },
        create: {
          hash: contentHash,
          sourceType: chunk.sourceType,
          sourceId: chunk.sourceId,
          modelName: chunk.modelName,
        },
        update: {
          sourceType: chunk.sourceType,
          sourceId: chunk.sourceId,
        },
      });

      const row = await this.prisma.embeddingChunk.upsert({
        where: {
          sourceType_sourceId_chunkIndex_modelName: {
            sourceType: chunk.sourceType,
            sourceId: chunk.sourceId,
            chunkIndex: chunk.chunkIndex,
            modelName: chunk.modelName,
          },
        },
        create: {
          sourceType: chunk.sourceType,
          sourceId: chunk.sourceId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          contentHash,
          countryCode: chunk.countryCode?.toUpperCase(),
          jurisdiction: chunk.jurisdiction,
          modelName: chunk.modelName,
          metadata: chunk.metadata,
        },
        update: {
          content: chunk.content,
          contentHash,
          countryCode: chunk.countryCode?.toUpperCase(),
          jurisdiction: chunk.jurisdiction,
          metadata: chunk.metadata,
        },
      });

      const embedding = embeddings[index];
      if (embedding.length > 0) {
        const vectorLiteral = this.toVectorLiteral(embedding);
        await this.prisma.$executeRaw`
          UPDATE "EmbeddingChunk"
          SET "embedding" = ${vectorLiteral}::vector
          WHERE "id" = ${row.id}
        `;
      }

      stored.push(row);
    }

    return { stored: stored.length, skipped, chunks: stored };
  }

  /**
   * Replace several sources' chunks after obtaining every replacement vector.
   * Provider requests are bounded, while the DB replacement is one transaction;
   * any request or write failure therefore leaves all previous chunks intact.
   */
  async replaceChunkSets(
    chunkSets: EmbeddingChunkSet[],
    options: {
      maxTextsPerRequest?: number;
      maxEstimatedTokensPerRequest?: number;
    } = {},
  ): Promise<{ stored: number }> {
    const chunks = chunkSets.flatMap((set) => set.chunks);
    if (chunks.length === 0) return { stored: 0 };
    if (!this.isRagEnabled()) {
      throw new Error('RAG embeddings are disabled');
    }

    const maxTexts = options.maxTextsPerRequest ?? chunks.length;
    const maxEstimatedTokens =
      options.maxEstimatedTokensPerRequest ??
      DEFAULT_SAFE_EMBEDDING_TOKENS_PER_REQUEST;
    if (
      !Number.isInteger(maxTexts) ||
      maxTexts < 1 ||
      maxTexts > MAX_EMBEDDING_INPUTS_PER_REQUEST
    ) {
      throw new Error(
        `maxTextsPerRequest must be between 1 and ${MAX_EMBEDDING_INPUTS_PER_REQUEST}`,
      );
    }
    if (
      !Number.isInteger(maxEstimatedTokens) ||
      maxEstimatedTokens < 1 ||
      maxEstimatedTokens > MAX_EMBEDDING_TOKENS_PER_REQUEST
    ) {
      throw new Error(
        `maxEstimatedTokensPerRequest must be between 1 and ${MAX_EMBEDDING_TOKENS_PER_REQUEST}`,
      );
    }

    const requests: EmbeddingChunkInput[][] = [];
    let request: EmbeddingChunkInput[] = [];
    let requestTokens = 0;
    for (const chunk of chunks) {
      const estimatedTokens = this.estimateEmbeddingTokens(chunk.content);
      if (estimatedTokens > MAX_EMBEDDING_TOKENS_PER_INPUT) {
        throw new Error(
          `${chunk.sourceId} chunk ${chunk.chunkIndex} exceeds the safe per-input token limit`,
        );
      }
      if (
        request.length > 0 &&
        (request.length >= maxTexts ||
          requestTokens + estimatedTokens > maxEstimatedTokens)
      ) {
        requests.push(request);
        request = [];
        requestTokens = 0;
      }
      request.push(chunk);
      requestTokens += estimatedTokens;
    }
    if (request.length > 0) requests.push(request);

    const embeddings: number[][] = [];
    for (let requestIndex = 0; requestIndex < requests.length; requestIndex += 1) {
      const requestChunks = requests[requestIndex];
      const response = await this.embedTexts(
        requestChunks.map((chunk) => chunk.content),
      );
      if (
        response.length !== requestChunks.length ||
        response.some((embedding) => embedding.length === 0)
      ) {
        throw new Error(
          `Embedding provider returned ${response.length}/${requestChunks.length} ` +
            `usable vectors for request ${requestIndex + 1}`,
        );
      }
      embeddings.push(...response);
    }

    const contentHashRows = chunks.map((chunk) => {
      const contentHash = this.hashContent(chunk.content);
      return Prisma.sql`(
        ${randomUUID()},
        ${contentHash},
        ${chunk.sourceType},
        ${chunk.sourceId},
        ${chunk.modelName}
      )`;
    });
    const embeddingRows = chunks.map((chunk, index) => {
      const metadata =
        chunk.metadata === undefined
          ? Prisma.sql`NULL`
          : Prisma.sql`${JSON.stringify(chunk.metadata)}::jsonb`;
      return Prisma.sql`(
        ${randomUUID()},
        ${chunk.sourceType},
        ${chunk.sourceId},
        ${chunk.chunkIndex},
        ${chunk.content},
        ${this.hashContent(chunk.content)},
        ${chunk.countryCode?.toUpperCase() ?? null},
        ${chunk.jurisdiction ?? null},
        ${chunk.modelName},
        ${metadata},
        ${this.toVectorLiteral(embeddings[index])}::vector
      )`;
    });
    const stalePredicates = chunkSets.map((set) => {
      const modelName = set.chunks[0]?.modelName;
      return Prisma.sql`(
        "sourceType" = ${set.sourceType}
        AND "sourceId" = ${set.sourceId}
        AND "modelName" = ${modelName}
        AND "chunkIndex" >= ${set.chunks.length}
      )`;
    });

    const insertContentHashes = Prisma.sql`
      INSERT INTO "ContentHash"
        ("id", "hash", "sourceType", "sourceId", "modelName")
      VALUES ${Prisma.join(contentHashRows)}
      ON CONFLICT ("hash") DO NOTHING
    `;
    const upsertEmbeddingChunks = Prisma.sql`
      INSERT INTO "EmbeddingChunk"
        ("id", "sourceType", "sourceId", "chunkIndex", "content", "contentHash",
         "countryCode", "jurisdiction", "modelName", "metadata", "embedding")
      VALUES ${Prisma.join(embeddingRows)}
      ON CONFLICT ("sourceType", "sourceId", "chunkIndex", "modelName")
      DO UPDATE SET
        "content" = EXCLUDED."content",
        "contentHash" = EXCLUDED."contentHash",
        "countryCode" = EXCLUDED."countryCode",
        "jurisdiction" = EXCLUDED."jurisdiction",
        "metadata" = EXCLUDED."metadata",
        "embedding" = EXCLUDED."embedding"
    `;
    const deleteStaleChunks = Prisma.sql`
      DELETE FROM "EmbeddingChunk"
      WHERE ${Prisma.join(stalePredicates, ' OR ')}
    `;

    await this.prisma.$transaction([
      this.prisma.$executeRaw(insertContentHashes),
      this.prisma.$executeRaw(upsertEmbeddingChunks),
      this.prisma.$executeRaw(deleteStaleChunks),
    ]);

    return { stored: chunks.length };
  }

  async searchByKeyword(query: string, filters?: { countryCode?: string; limit?: number }) {
    const normalized = query.trim();
    if (!normalized) {
      return [];
    }

    return this.prisma.embeddingChunk.findMany({
      where: {
        countryCode: filters?.countryCode?.toUpperCase(),
        content: { contains: normalized, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit ?? 20,
    });
  }

  async searchByVector(
    query: string,
    filters?: { countryCode?: string; sourceType?: string; limit?: number; practiceArea?: string },
  ): Promise<VectorSearchResult[]> {
    if (!this.isRagEnabled()) {
      return [];
    }

    try {
      const embedding = await this.embedText(query);
      if (embedding.length === 0) {
        return [];
      }

      const vectorLiteral = this.toVectorLiteral(embedding);
      const limit = filters?.limit ?? 10;
      const countryCode = filters?.countryCode?.toUpperCase();
      const sourceType = filters?.sourceType ?? null;
      const practiceArea = filters?.practiceArea ?? null;

      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          sourceType: string;
          sourceId: string;
          chunkIndex: number;
          content: string;
          countryCode: string | null;
          score: number;
        }>
      >`
      SELECT
        ec."id",
        ec."sourceType",
        ec."sourceId",
        ec."chunkIndex",
        ec."content",
        ec."countryCode",
        1 - (ec."embedding" <=> ${vectorLiteral}::vector) AS score
      FROM "EmbeddingChunk" ec
      WHERE ec."embedding" IS NOT NULL
        AND (${countryCode ?? null}::text IS NULL OR ec."countryCode" = ${countryCode ?? null})
        AND (${sourceType}::text IS NULL OR ec."sourceType" = ${sourceType})
        AND (${practiceArea}::text IS NULL OR ec."metadata"->>'practiceArea' = ${practiceArea})
      ORDER BY ec."embedding" <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `;

      return rows.map((row) => ({
        id: row.id,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        chunkIndex: row.chunkIndex,
        content: row.content,
        countryCode: row.countryCode,
        score: Number(row.score),
      }));
    } catch (err) {
      this.logger.warn(
        `Vector search failed (non-critical): ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }
}
