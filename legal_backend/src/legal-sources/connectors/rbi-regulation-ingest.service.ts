import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingService } from '@/embeddings/embedding.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  buildRbiAuthorityId,
  RbiRegulationConnector,
  type RbiRegulationDocument,
  type RbiRetrievalGap,
  rbiDocumentFingerprint,
} from './rbi-regulation.connector';

export interface RbiIngestResult {
  processed: number;
  ingested: number;
  skipped: number;
  chunksStored: number;
  gaps: Array<{ id: string; sourceUrl: string; reason: string }>;
}

@Injectable()
export class RbiRegulationIngestService {
  private readonly logger = new Logger(RbiRegulationIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly connector: RbiRegulationConnector,
  ) {}

  /** Idempotently fetch, persist, and embed the verified RBI manifest. */
  async ingest(options: { forceReindex?: boolean } = {}): Promise<RbiIngestResult> {
    const corpus = await this.connector.fetchCorpus();
    let ingested = 0;
    let skipped = 0;
    let chunksStored = 0;

    for (const document of corpus.documents) {
      try {
        const result = await this.ingestDocument(document, options);
        chunksStored += result.chunksStored;
        if (result.skipped) skipped += 1;
        else ingested += 1;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        corpus.gaps.push({ entry: document, reason });
        this.logger.warn(`RBI ingest gap id=${document.id} reason="${reason}"`);
      }
    }

    return {
      processed: corpus.documents.length,
      ingested,
      skipped,
      chunksStored,
      gaps: corpus.gaps.map(toPublicGap),
    };
  }

  async ingestDocument(
    document: RbiRegulationDocument,
    options: { forceReindex?: boolean } = {},
  ): Promise<{ authorityId: string; chunksStored: number; skipped: boolean }> {
    const authorityId = buildRbiAuthorityId(document);
    const fingerprint = rbiDocumentFingerprint(document);
    const existing = await this.prisma.legalAuthority.findUnique({
      where: { id: authorityId },
      select: { embeddingStatus: true, topics: true },
    });
    const existingTopics = Array.isArray(existing?.topics) ? existing.topics : [];
    const alreadyCurrent =
      existing?.embeddingStatus === 'COMPLETED' &&
      existingTopics.includes(`sha256:${fingerprint}`);
    if (alreadyCurrent && !options.forceReindex) {
      return { authorityId, chunksStored: 0, skipped: true };
    }

    const paragraphTopics = document.paragraphReferences
      .slice(0, 100)
      .map((reference) => `paragraph:${reference.paragraph}`);
    await this.prisma.legalAuthority.upsert({
      where: { id: authorityId },
      create: {
        id: authorityId,
        countryCode: 'IN',
        jurisdiction: 'IN',
        authorityType: 'REGULATION',
        title: document.title,
        citation: document.instrumentNumber,
        decisionDate: new Date(document.issueDate),
        sourceUrl: document.sourceUrl,
        sourceName: 'Reserve Bank of India',
        sourceLicense: 'Official RBI publication',
        fullText: document.fullText,
        summary: document.fullText.slice(0, 600),
        topics: [
          ...document.topics,
          `regulator:${document.regulator}`,
          `instrumentType:${document.instrumentType}`,
          `instrumentNumber:${document.instrumentNumber}`,
          `sha256:${fingerprint}`,
          ...paragraphTopics,
        ],
        practiceAreas: ['Banking and Finance'],
        embeddingStatus: 'PENDING',
      },
      update: {
        title: document.title,
        citation: document.instrumentNumber,
        decisionDate: new Date(document.issueDate),
        sourceUrl: document.sourceUrl,
        sourceName: 'Reserve Bank of India',
        fullText: document.fullText,
        summary: document.fullText.slice(0, 600),
        topics: [
          ...document.topics,
          `regulator:${document.regulator}`,
          `instrumentType:${document.instrumentType}`,
          `instrumentNumber:${document.instrumentNumber}`,
          `sha256:${fingerprint}`,
          ...paragraphTopics,
        ],
        embeddingStatus: 'PENDING',
      },
    });

    const chunks = chunkRegulation(document);
    const stored = await this.embeddingService.storeChunks(
      chunks.map((content, chunkIndex) => ({
        sourceType: 'LEGAL_AUTHORITY' as const,
        sourceId: authorityId,
        chunkIndex,
        content,
        countryCode: 'IN',
        jurisdiction: 'IN',
        modelName: this.embeddingService.getEmbeddingModel(),
      })),
    );
    await this.prisma.legalAuthority.update({
      where: { id: authorityId },
      data: { embeddingStatus: stored.stored > 0 ? 'COMPLETED' : 'PENDING' },
    });
    return { authorityId, chunksStored: stored.stored, skipped: false };
  }
}

function chunkRegulation(document: RbiRegulationDocument): string[] {
  const prefix = [
    document.title,
    document.instrumentNumber,
    document.regulator,
    document.issueDate,
  ].join('\n');
  const chunks: string[] = [];
  for (let offset = 0; offset < document.fullText.length; offset += 1200) {
    chunks.push(`${prefix}\n\n${document.fullText.slice(offset, offset + 1200)}`);
  }
  return chunks;
}

function toPublicGap(gap: RbiRetrievalGap): {
  id: string;
  sourceUrl: string;
  reason: string;
} {
  return { id: gap.entry.id, sourceUrl: gap.entry.sourceUrl, reason: gap.reason };
}
