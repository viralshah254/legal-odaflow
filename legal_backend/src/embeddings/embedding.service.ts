import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  hashContent(content: string): string {
    return createHash('sha256').update(content.trim()).digest('hex');
  }

  getEmbeddingModel(): string {
    return this.configService.get<string>('AI_EMBEDDING_MODEL', 'text-embedding-3-small');
  }

  isRagEnabled(): boolean {
    return this.configService.get<string>('AI_ENABLE_RAG', 'true') === 'true';
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const openAiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    if (!openAiKey || texts.length === 0) {
      return texts.map(() => []);
    }

    const modelName = this.getEmbeddingModel();
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        input: texts,
      }),
    });

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
        const vectorLiteral = `[${embedding.join(',')}]`;
        await this.prisma.$executeRawUnsafe(
          `UPDATE "EmbeddingChunk" SET "embedding" = $1::vector WHERE "id" = $2`,
          vectorLiteral,
          row.id,
        );
      }

      stored.push(row);
    }

    return { stored: stored.length, skipped, chunks: stored };
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
    filters?: { countryCode?: string; limit?: number },
  ): Promise<VectorSearchResult[]> {
    if (!this.isRagEnabled()) {
      return [];
    }

    const embedding = await this.embedText(query);
    if (embedding.length === 0) {
      return [];
    }

    const vectorLiteral = `[${embedding.join(',')}]`;
    const limit = filters?.limit ?? 10;
    const countryCode = filters?.countryCode?.toUpperCase();

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        sourceType: string;
        sourceId: string;
        chunkIndex: number;
        content: string;
        countryCode: string | null;
        score: number;
      }>
    >(
      `SELECT
        ec."id",
        ec."sourceType",
        ec."sourceId",
        ec."chunkIndex",
        ec."content",
        ec."countryCode",
        1 - (ec."embedding" <=> $1::vector) AS score
      FROM "EmbeddingChunk" ec
      WHERE ec."embedding" IS NOT NULL
        AND ($2::text IS NULL OR ec."countryCode" = $2)
      ORDER BY ec."embedding" <=> $1::vector
      LIMIT $3`,
      vectorLiteral,
      countryCode ?? null,
      limit,
    );

    return rows.map((row) => ({
      id: row.id,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      chunkIndex: row.chunkIndex,
      content: row.content,
      countryCode: row.countryCode,
      score: Number(row.score),
    }));
  }
}
