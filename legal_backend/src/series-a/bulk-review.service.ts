import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { MatterAccessService } from '@/access/matter-access.service';
import { AiGatewayService } from '@/ai/ai-gateway.service';
import { FeatureFlagsService } from '@/platform/feature-flags/feature-flags.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RealtimePublisherService } from '@/realtime/realtime-publisher.service';
import { REALTIME_EVENTS } from '@/realtime/realtime-events';
import { EncryptionService } from '@/security/encryption.service';

const BATCH_SIZE = 3;
const DOCUMENT_CHUNK_SIZE = 11_000;
const MAX_DOCUMENTS = 50;
const MAX_SYNTHESIS_SUMMARY_LENGTH = 750;
const MAX_SYNTHESIS_RISK_LENGTH = 300;

export interface BulkReviewCitation {
  documentId: string;
  fileName?: string;
  chunk?: number;
  characterRange?: { start: number; end: number };
  note?: string;
}

export interface BulkReviewDocumentResult {
  documentId: string;
  fileName: string;
  summary: string;
  risks: string[];
  citations: BulkReviewCitation[];
  confidence: number;
  status: 'COMPLETED' | 'PARTIAL' | 'NO_TEXT' | 'FAILED';
  coverage: {
    charactersAvailable: number;
    charactersAnalyzed: number;
    chunksTotal: number;
    chunksAnalyzed: number;
    complete: boolean;
    warnings: string[];
  };
}

export interface BulkReviewSynthesis {
  executiveSummary: string;
  chronology: Array<{
    date: string;
    event: string;
    citations: BulkReviewCitation[];
    confidence: number;
  }>;
  missingItems: Array<{
    item: string;
    reason: string;
    citations: BulkReviewCitation[];
    confidence: number;
  }>;
  contradictions: Array<{
    description: string;
    citations: BulkReviewCitation[];
    confidence: number;
  }>;
  recommendedActions: Array<{
    action: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    citations: BulkReviewCitation[];
  }>;
  citations: BulkReviewCitation[];
  confidence: number;
}

interface BulkReviewOutput {
  version: 2;
  documents: BulkReviewDocumentResult[];
  synthesis?: BulkReviewSynthesis;
  coverageWarnings: string[];
}

interface CorpusManifestEntry {
  documentId: string;
  version: number;
  updatedAt: string;
  contentHash: string;
}

@Injectable()
export class BulkReviewService {
  private readonly logger = new Logger(BulkReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
    private readonly realtime: RealtimePublisherService,
    private readonly encryption: EncryptionService,
    private readonly matterAccess: MatterAccessService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  private resolveDocumentText(doc: {
    id: string;
    extractedText: string | null;
    htmlContent: string | null;
  }): string {
    const decrypted =
      this.encryption.decryptStringFromStorage(doc.extractedText, doc.id) ?? '';
    if (decrypted.trim()) return decrypted.trim();
    if (doc.htmlContent?.trim()) {
      return doc.htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return '';
  }

  async list(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    await this.ensureMatterAccess(tenantId, matterId, userId, role);
    const jobs = await this.prisma.bulkDocumentReviewJob.findMany({
      where: { tenantId, matterId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return jobs.map((job) => {
      const output = this.readOutput(job.summaryMatrix);
      return {
        ...job,
        // Keep the original matrix shape consumed by the existing diligence page.
        summaryMatrix: output.documents,
        matterSynthesis: output.synthesis,
        coverageWarnings: output.coverageWarnings,
      };
    });
  }

  async create(
    tenantId: string,
    matterId: string,
    documentIds: string[],
    userId: string,
    role?: string,
  ) {
    await this.ensureMatterAccess(tenantId, matterId, userId, role);
    const normalizedIds = [...new Set(documentIds.map((id) => id.trim()).filter(Boolean))].sort();
    if (normalizedIds.length === 0) {
      throw new BadRequestException('Select at least one document');
    }
    if (normalizedIds.length > MAX_DOCUMENTS) {
      throw new BadRequestException(`A bulk review supports up to ${MAX_DOCUMENTS} documents`);
    }

    const accessibleDocuments = await this.prisma.document.findMany({
      where: { id: { in: normalizedIds }, tenantId, matterId },
      select: {
        id: true,
        version: true,
        updatedAt: true,
        extractedText: true,
        htmlContent: true,
      },
    });
    if (accessibleDocuments.length !== normalizedIds.length) {
      throw new BadRequestException(
        'One or more documents do not exist in this matter or are not accessible',
      );
    }

    // Repeated submissions return the active job instead of charging for duplicate work.
    const manifest = accessibleDocuments
      .map((document) => this.buildManifestEntry(document))
      .sort((left, right) => left.documentId.localeCompare(right.documentId));
    const priorJobs = await this.prisma.bulkDocumentReviewJob.findMany({
      where: { tenantId, matterId, status: { in: ['QUEUED', 'RUNNING', 'COMPLETED'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const duplicate = priorJobs.find(
      (candidate) =>
        ['QUEUED', 'RUNNING'].includes(candidate.status) &&
        JSON.stringify(this.normalizeDocumentIds(candidate.documentIds)) ===
        JSON.stringify(normalizedIds),
    );
    if (duplicate) return duplicate;

    const reusableResults = this.collectReusableResults(priorJobs, manifest);
    const initialOutput = this.buildOutput(
      normalizedIds,
      reusableResults,
      reusableResults.size > 0
        ? [`Reused ${reusableResults.size} unchanged document result(s) from an earlier review`]
        : [],
    );

    const job = await this.prisma.bulkDocumentReviewJob.create({
      data: {
        tenantId,
        matterId,
        documentIds: normalizedIds as unknown as Prisma.InputJsonValue,
        corpusManifest: manifest as unknown as Prisma.InputJsonValue,
        summaryMatrix:
          reusableResults.size > 0
            ? (initialOutput as unknown as Prisma.InputJsonValue)
            : undefined,
        promptVersion: 'matter-file-review-v2',
        status: 'QUEUED',
        createdBy: userId,
      },
    });

    this.runJob(tenantId, userId, job.id).catch(() => undefined);
    return job;
  }

  private publishProgress(
    tenantId: string,
    userId: string,
    jobId: string,
    matterId: string,
    payload: {
      processed: number;
      total: number;
      status: string;
      summaryMatrix?: BulkReviewDocumentResult[];
      matterSynthesis?: BulkReviewSynthesis;
      coverageWarnings?: string[];
    },
  ) {
    const event = {
      tenantId,
      entityId: jobId,
      action: payload.status,
      data: {
        jobId,
        matterId,
        processed: payload.processed,
        total: payload.total,
        summaryMatrix: payload.summaryMatrix,
        matterSynthesis: payload.matterSynthesis,
        coverageWarnings: payload.coverageWarnings,
      },
      timestamp: new Date().toISOString(),
      userId,
    };
    this.realtime.publishToTenant(tenantId, REALTIME_EVENTS.BULK_REVIEW_PROGRESS, event);
    this.realtime.publishToUser(userId, REALTIME_EVENTS.BULK_REVIEW_PROGRESS, event);
  }

  private async runJob(tenantId: string, userId: string, jobId: string) {
    const startedAt = Date.now();
    const job = await this.prisma.bulkDocumentReviewJob.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) return;
    if (job.status === 'COMPLETED') return;

    const docIds = this.normalizeDocumentIds(job.documentIds);
    const existing = this.readOutput(job.summaryMatrix);
    const results = new Map(existing.documents.map((result) => [result.documentId, result]));
    const coverageWarnings = [...existing.coverageWarnings];

    await this.prisma.bulkDocumentReviewJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    this.publishProgress(tenantId, userId, jobId, job.matterId, {
      processed: 0,
      total: docIds.length,
      status: 'RUNNING',
    });

    try {
      for (let index = 0; index < docIds.length; index += BATCH_SIZE) {
        const batch = docIds
          .slice(index, index + BATCH_SIZE)
          .filter((documentId) => !results.has(documentId));

        const batchResults = await Promise.all(
          batch.map((documentId) =>
            this.reviewDocument(tenantId, userId, job.matterId, documentId),
          ),
        );
        for (const result of batchResults) {
          results.set(result.documentId, result);
          coverageWarnings.push(...result.coverage.warnings);
        }

        const output = this.buildOutput(docIds, results, coverageWarnings);
        await this.persistOutput(jobId, output);
        this.publishProgress(tenantId, userId, jobId, job.matterId, {
          processed: output.documents.length,
          total: docIds.length,
          status: 'RUNNING',
          summaryMatrix: output.documents,
          coverageWarnings: output.coverageWarnings,
        });
      }

      const output = this.buildOutput(docIds, results, coverageWarnings);
      if (
        this.featureFlags.isEnabled('MATTER_FILE_REVIEW_V2', {
          tenantId,
          userId,
        })
      ) {
        output.synthesis = await this.synthesizeMatter(
          tenantId,
          userId,
          job.matterId,
          output.documents,
          output.coverageWarnings,
        );
      }
      await this.prisma.bulkDocumentReviewJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          summaryMatrix: output as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      this.publishProgress(tenantId, userId, jobId, job.matterId, {
        processed: output.documents.length,
        total: docIds.length,
        status: 'COMPLETED',
        summaryMatrix: output.documents,
        matterSynthesis: output.synthesis,
        coverageWarnings: output.coverageWarnings,
      });
      this.logger.log(
        JSON.stringify({
          event: 'matter_file_review_completed',
          tenantId,
          matterId: job.matterId,
          jobId,
          documentCount: output.documents.length,
          completeDocumentCount: output.documents.filter((document) => document.coverage.complete)
            .length,
          warningCount: output.coverageWarnings.length,
          durationMs: Date.now() - startedAt,
        }),
      );
    } catch (error) {
      const output = this.buildOutput(docIds, results, [
        ...coverageWarnings,
        `Job stopped before completion: ${this.errorMessage(error)}`,
      ]);
      await this.prisma.bulkDocumentReviewJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          summaryMatrix: output as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
      this.publishProgress(tenantId, userId, jobId, job.matterId, {
        processed: output.documents.length,
        total: docIds.length,
        status: 'FAILED',
        summaryMatrix: output.documents,
        coverageWarnings: output.coverageWarnings,
      });
      this.logger.warn(
        JSON.stringify({
          event: 'matter_file_review_failed',
          tenantId,
          matterId: job.matterId,
          jobId,
          processedDocumentCount: output.documents.length,
          durationMs: Date.now() - startedAt,
          error: this.errorMessage(error),
        }),
      );
    }
  }

  private async reviewDocument(
    tenantId: string,
    userId: string,
    matterId: string,
    documentId: string,
  ): Promise<BulkReviewDocumentResult> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId, matterId },
      select: {
        id: true,
        fileName: true,
        extractedText: true,
        htmlContent: true,
      },
    });
    if (!doc) {
      return this.failedDocument(documentId, 'Unknown document', 'Document is no longer accessible');
    }

    const text = this.resolveDocumentText(doc);
    if (!text) {
      const warning = `${doc.fileName}: no extracted text; OCR or HTML content is required`;
      return {
        documentId,
        fileName: doc.fileName,
        summary: 'No extracted text — upload OCR or add HTML content first.',
        risks: ['missing_text'],
        citations: [],
        confidence: 0,
        status: 'NO_TEXT',
        coverage: {
          charactersAvailable: 0,
          charactersAnalyzed: 0,
          chunksTotal: 0,
          chunksAnalyzed: 0,
          complete: false,
          warnings: [warning],
        },
      };
    }

    const chunks = this.chunkText(text);
    const successful: Array<{ summary: string; risks: string[]; chunk: number }> = [];
    const warnings: string[] = [];
    for (let index = 0; index < chunks.length; index += 1) {
      try {
        const result = await this.aiGateway.runDiligenceExtraction({
          tenantId,
          userId,
          matterId,
          documentId: `${documentId}:chunk-${index + 1}-of-${chunks.length}`,
          documentText: chunks[index],
        });
        successful.push({ summary: result.summary, risks: result.risks, chunk: index });
      } catch (error) {
        warnings.push(
          `${doc.fileName}: chunk ${index + 1}/${chunks.length} failed (${this.errorMessage(error)})`,
        );
      }
    }

    if (successful.length === 0) {
      return this.failedDocument(documentId, doc.fileName, warnings[0] ?? 'Analysis failed', text.length);
    }

    const citations = successful.map(({ chunk }) => ({
      documentId,
      fileName: doc.fileName,
      chunk: chunk + 1,
      characterRange: {
        start: chunk * DOCUMENT_CHUNK_SIZE,
        end: Math.min(text.length, (chunk + 1) * DOCUMENT_CHUNK_SIZE),
      },
    }));
    const complete = successful.length === chunks.length;
    return {
      documentId,
      fileName: doc.fileName,
      summary: successful.map((result) => result.summary).join('\n\n'),
      risks: [...new Set(successful.flatMap((result) => result.risks))].slice(0, 24),
      citations,
      confidence: Number((successful.length / chunks.length).toFixed(2)),
      status: complete ? 'COMPLETED' : 'PARTIAL',
      coverage: {
        charactersAvailable: text.length,
        charactersAnalyzed: successful.reduce(
          (total, result) => total + chunks[result.chunk].length,
          0,
        ),
        chunksTotal: chunks.length,
        chunksAnalyzed: successful.length,
        complete,
        warnings,
      },
    };
  }

  private async synthesizeMatter(
    tenantId: string,
    userId: string,
    matterId: string,
    documents: BulkReviewDocumentResult[],
    coverageWarnings: string[],
  ): Promise<BulkReviewSynthesis> {
    for (const document of documents) {
      if (
        document.summary.length > MAX_SYNTHESIS_SUMMARY_LENGTH ||
        document.risks.some((risk) => risk.length > MAX_SYNTHESIS_RISK_LENGTH) ||
        document.risks.length > 4
      ) {
        coverageWarnings.push(
          `${document.fileName}: full text was reviewed, but its findings were condensed for the matter-wide synthesis`,
        );
      }
    }
    const records = documents.map((document) => ({
      documentId: document.documentId,
      fileName: document.fileName,
      summary: this.limitForSynthesis(document.summary, MAX_SYNTHESIS_SUMMARY_LENGTH),
      risks: document.risks
        .map((risk) => this.limitForSynthesis(risk, MAX_SYNTHESIS_RISK_LENGTH))
        .slice(0, 4),
      confidence: document.confidence,
      coverage: document.coverage,
      citations: document.citations,
    }));
    const result = await this.aiGateway.runIntakeDeepAnalysis({
      tenantId,
      userId,
      taskType: 'DOCUMENT_EXPLAINER',
      reasoningModel: true,
      systemPrompt: [
        'You are a matter-wide legal due-diligence analyst for licensed attorneys.',
        'Use only the supplied document records. Do not invent dates, facts, missing documents, or citations.',
        'Return valid JSON only with keys executiveSummary, chronology, missingItems, contradictions, recommendedActions, citations, confidence.',
        'Every factual item must cite supplied documentId values. Confidence must be a number from 0 to 1.',
        'chronology items: {date,event,citations,confidence}; missingItems: {item,reason,citations,confidence}; contradictions: {description,citations,confidence}; recommendedActions: {action,priority,citations}.',
      ].join(' '),
      userPrompt: JSON.stringify({
        matterId,
        documents: records,
        coverageWarnings,
      }),
      skipDebit: false,
    });
    return this.parseSynthesis(result.outputMarkdown, documents);
  }

  private parseSynthesis(
    raw: string,
    documents: BulkReviewDocumentResult[],
  ): BulkReviewSynthesis {
    const fallbackCitations = documents.flatMap((document) => document.citations).slice(0, 50);
    const fallback: BulkReviewSynthesis = {
      executiveSummary: documents
        .map((document) => `${document.fileName}: ${document.summary}`)
        .join('\n\n'),
      chronology: [],
      missingItems: documents
        .filter((document) => document.status === 'NO_TEXT' || document.status === 'PARTIAL')
        .map((document) => ({
          item: `Complete readable copy of ${document.fileName}`,
          reason: document.coverage.warnings.join('; ') || 'Document coverage is incomplete',
          citations: [{ documentId: document.documentId, fileName: document.fileName }],
          confidence: 1,
        })),
      contradictions: [],
      recommendedActions: [],
      citations: fallbackCitations,
      confidence: this.averageConfidence(documents),
    };
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    try {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      const allowedDocumentIds = new Set(documents.map((document) => document.documentId));
      return {
        executiveSummary:
          typeof parsed.executiveSummary === 'string'
            ? parsed.executiveSummary
            : fallback.executiveSummary,
        chronology: this.normalizeChronology(parsed.chronology, allowedDocumentIds),
        missingItems: this.normalizeMissingItems(parsed.missingItems, allowedDocumentIds),
        contradictions: this.normalizeContradictions(
          parsed.contradictions,
          allowedDocumentIds,
        ),
        recommendedActions: this.normalizeActions(
          parsed.recommendedActions,
          allowedDocumentIds,
        ),
        citations: this.normalizeCitations(parsed.citations, allowedDocumentIds),
        confidence: this.confidence(parsed.confidence, fallback.confidence),
      };
    } catch {
      return fallback;
    }
  }

  private normalizeChronology(
    value: unknown,
    allowedDocumentIds: Set<string>,
  ): BulkReviewSynthesis['chronology'] {
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is Record<string, unknown> =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as Record<string, unknown>).event === 'string',
      )
      .map((item) => ({
        date: typeof item.date === 'string' ? item.date : 'Date not established',
        event: String(item.event),
        citations: this.normalizeCitations(item.citations, allowedDocumentIds),
        confidence: this.confidence(item.confidence, 0.5),
      }))
      .slice(0, 50);
  }

  private normalizeMissingItems(
    value: unknown,
    allowedDocumentIds: Set<string>,
  ): BulkReviewSynthesis['missingItems'] {
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is Record<string, unknown> =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as Record<string, unknown>).item === 'string',
      )
      .map((item) => ({
        item: String(item.item),
        reason: typeof item.reason === 'string' ? item.reason : 'Not stated',
        citations: this.normalizeCitations(item.citations, allowedDocumentIds),
        confidence: this.confidence(item.confidence, 0.5),
      }))
      .slice(0, 50);
  }

  private normalizeContradictions(
    value: unknown,
    allowedDocumentIds: Set<string>,
  ): BulkReviewSynthesis['contradictions'] {
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is Record<string, unknown> =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as Record<string, unknown>).description === 'string',
      )
      .map((item) => ({
        description: String(item.description),
        citations: this.normalizeCitations(item.citations, allowedDocumentIds),
        confidence: this.confidence(item.confidence, 0.5),
      }))
      .slice(0, 50);
  }

  private normalizeActions(
    value: unknown,
    allowedDocumentIds: Set<string>,
  ): BulkReviewSynthesis['recommendedActions'] {
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === 'object' && typeof (item as Record<string, unknown>).action === 'string',
      )
      .map((item) => ({
        action: String(item.action),
        priority: ['HIGH', 'MEDIUM', 'LOW'].includes(String(item.priority).toUpperCase())
          ? (String(item.priority).toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW')
          : 'MEDIUM',
        citations: this.normalizeCitations(item.citations, allowedDocumentIds),
      }))
      .slice(0, 50);
  }

  private normalizeCitations(
    value: unknown,
    allowedDocumentIds?: Set<string>,
  ): BulkReviewCitation[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((citation) => {
        if (typeof citation === 'string') {
          return !allowedDocumentIds || allowedDocumentIds.has(citation)
            ? { documentId: citation }
            : null;
        }
        if (!citation || typeof citation !== 'object') return null;
        const record = citation as Record<string, unknown>;
        if (typeof record.documentId !== 'string') return null;
        if (allowedDocumentIds && !allowedDocumentIds.has(record.documentId)) return null;
        return {
          documentId: record.documentId,
          fileName: typeof record.fileName === 'string' ? record.fileName : undefined,
          chunk: typeof record.chunk === 'number' ? record.chunk : undefined,
          characterRange: this.normalizeCharacterRange(record.characterRange),
          note: typeof record.note === 'string' ? record.note : undefined,
        };
      })
      .filter((citation): citation is BulkReviewCitation => citation !== null)
      .slice(0, 100);
  }

  private normalizeCharacterRange(
    value: unknown,
  ): BulkReviewCitation['characterRange'] | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const range = value as Record<string, unknown>;
    if (
      typeof range.start !== 'number' ||
      typeof range.end !== 'number' ||
      range.start < 0 ||
      range.end < range.start
    ) {
      return undefined;
    }
    return { start: range.start, end: range.end };
  }

  private buildOutput(
    docIds: string[],
    results: Map<string, BulkReviewDocumentResult>,
    coverageWarnings: string[],
  ): BulkReviewOutput {
    return {
      version: 2,
      documents: docIds
        .map((documentId) => results.get(documentId))
        .filter((result): result is BulkReviewDocumentResult => !!result),
      coverageWarnings: [...new Set(coverageWarnings)],
    };
  }

  private readOutput(value: unknown): BulkReviewOutput {
    if (Array.isArray(value)) {
      return {
        version: 2,
        documents: value as BulkReviewDocumentResult[],
        coverageWarnings: [],
      };
    }
    if (value && typeof value === 'object') {
      const output = value as Partial<BulkReviewOutput>;
      return {
        version: 2,
        documents: Array.isArray(output.documents) ? output.documents : [],
        synthesis: output.synthesis,
        coverageWarnings: Array.isArray(output.coverageWarnings)
          ? output.coverageWarnings.map(String)
          : [],
      };
    }
    return { version: 2, documents: [], coverageWarnings: [] };
  }

  private persistOutput(jobId: string, output: BulkReviewOutput) {
    return this.prisma.bulkDocumentReviewJob.update({
      where: { id: jobId },
      data: { summaryMatrix: output as unknown as Prisma.InputJsonValue },
    });
  }

  private normalizeDocumentIds(value: unknown): string[] {
    return Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === 'string'))].sort()
      : [];
  }

  private buildManifestEntry(document: {
    id: string;
    version: number;
    updatedAt: Date;
    extractedText: string | null;
    htmlContent: string | null;
  }): CorpusManifestEntry {
    const contentHash = createHash('sha256')
      .update(
        [
          String(document.version),
          document.extractedText ?? '',
          document.htmlContent ?? '',
        ].join('\u0000'),
      )
      .digest('hex');
    return {
      documentId: document.id,
      version: document.version,
      updatedAt: document.updatedAt.toISOString(),
      contentHash,
    };
  }

  private collectReusableResults(
    priorJobs: Array<{
      status: string;
      corpusManifest?: unknown;
      summaryMatrix?: unknown;
    }>,
    currentManifest: CorpusManifestEntry[],
  ): Map<string, BulkReviewDocumentResult> {
    const reusable = new Map<string, BulkReviewDocumentResult>();
    for (const current of currentManifest) {
      for (const job of priorJobs) {
        if (job.status !== 'COMPLETED' || !Array.isArray(job.corpusManifest)) continue;
        const previous = (job.corpusManifest as CorpusManifestEntry[]).find(
          (entry) =>
            entry.documentId === current.documentId &&
            entry.version === current.version &&
            entry.contentHash === current.contentHash,
        );
        if (!previous) continue;
        const result = this.readOutput(job.summaryMatrix).documents.find(
          (document) =>
            document.documentId === current.documentId &&
            document.status === 'COMPLETED' &&
            document.coverage.complete,
        );
        if (result) {
          reusable.set(current.documentId, result);
          break;
        }
      }
    }
    return reusable;
  }

  private chunkText(text: string): string[] {
    const chunks: string[] = [];
    for (let offset = 0; offset < text.length; offset += DOCUMENT_CHUNK_SIZE) {
      chunks.push(text.slice(offset, offset + DOCUMENT_CHUNK_SIZE));
    }
    return chunks;
  }

  private failedDocument(
    documentId: string,
    fileName: string,
    warning: string,
    charactersAvailable = 0,
  ): BulkReviewDocumentResult {
    return {
      documentId,
      fileName,
      summary: 'Analysis failed',
      risks: ['processing_error'],
      citations: [],
      confidence: 0,
      status: 'FAILED',
      coverage: {
        charactersAvailable,
        charactersAnalyzed: 0,
        chunksTotal: charactersAvailable ? Math.ceil(charactersAvailable / DOCUMENT_CHUNK_SIZE) : 0,
        chunksAnalyzed: 0,
        complete: false,
        warnings: [warning],
      },
    };
  }

  private limitForSynthesis(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength)} [condensed for synthesis]`;
  }

  private confidence(value: unknown, fallback: number): number {
    const number = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
  }

  private averageConfidence(documents: BulkReviewDocumentResult[]): number {
    if (documents.length === 0) return 0;
    return Number(
      (
        documents.reduce((sum, document) => sum + document.confidence, 0) / documents.length
      ).toFixed(2),
    );
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }

  private async ensureMatterAccess(
    tenantId: string,
    matterId: string,
    userId: string,
    role?: string,
  ) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      select: { id: true },
    });
    if (!matter) throw new NotFoundException('Matter not found');
    if (this.matterAccess.hasFullAccess(role)) return;
    try {
      await this.matterAccess.ensureMatterAccess(tenantId, userId, matterId, role);
    } catch {
      throw new ForbiddenException('Matter access denied');
    }
  }
}
