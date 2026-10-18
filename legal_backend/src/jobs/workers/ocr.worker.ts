import { Worker, Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { EncryptionService } from '@/security/encryption.service';
import { OcrJobPayload } from '../jobs.service';
import { getWorkerServices } from './worker-context';
import type { EvidenceExtractorService } from '@/ai/matter-intelligence/evidence-extractor.service';
import type { MatterMemoryService } from '@/ai/matter-intelligence/matter-memory.service';

const prisma = new PrismaClient();
const encryption = new EncryptionService(new ConfigService());

function getRedisConnectionOptions() {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    maxRetriesPerRequest: null,
  };
}

async function processOcrJob(job: Job<OcrJobPayload>) {
  const payload = job.data;
  const { azureOcr, aiGateway, evidenceExtractor, matterMemory } = await getWorkerServices();

  const agentJob = await prisma.agentJob.findFirst({
    where: {
      queue: 'ocr-processing',
      userId: payload.userId,
      status: 'QUEUED',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (agentJob) {
    await prisma.agentJob.update({
      where: { id: agentJob.id },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
      },
    });
  }

  try {
    const extractedText = await azureOcr.extractTextFromUrl(payload.fileUrl);
    if (!extractedText.trim()) {
      throw new Error('OCR returned no extractable text');
    }

    const encryptedExtractedText = encryption.encryptStringForStorage(
      extractedText,
      extractedTextAad(payload),
    );

    if (payload.scope === 'CONSUMER') {
      const consumerDoc = await prisma.consumerDocument.update({
        where: { id: payload.documentId },
        data: {
          extractedText: encryptedExtractedText,
          ocrStatus: 'COMPLETED',
        },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          consumerCaseId: true,
        },
      });

      await mergeExtractedEvidence({
        evidenceExtractor,
        matterMemory,
        extractedText,
        fileName: consumerDoc.fileName ?? 'document',
        mimeType: consumerDoc.mimeType ?? undefined,
        sourceDocumentId: consumerDoc.id,
        consumerCaseId: consumerDoc.consumerCaseId,
      });
    } else if (payload.scope === 'LEAD') {
      await prisma.leadDocument.update({
        where: { id: payload.documentId },
        data: {
          extractedText: encryptedExtractedText,
          ocrStatus: 'COMPLETED',
        },
      });
    } else {
      const doc = await prisma.document.update({
        where: { id: payload.documentId },
        data: {
          extractedText: encryptedExtractedText,
        },
        select: {
          id: true,
          tenantId: true,
          fileName: true,
          mimeType: true,
          matterId: true,
        },
      });

      await mergeExtractedEvidence({
        evidenceExtractor,
        matterMemory,
        extractedText,
        fileName: doc.fileName ?? 'document',
        mimeType: doc.mimeType ?? undefined,
        sourceDocumentId: doc.id,
        matterId: doc.matterId ?? undefined,
      });

      // Auto-classify + summarise lawyer documents after OCR
      try {
        if (doc) {
          await aiGateway.runDocumentClassifyAndSummarize({
            tenantId: doc.tenantId,
            documentId: payload.documentId,
            fileName: doc.fileName ?? 'document',
            extractedText,
            countryCode: payload.countryCode ?? 'US',
          });
        }
      } catch {
        // classification is best-effort; don't fail OCR job
      }
    }

    if (agentJob) {
      await prisma.agentJob.update({
        where: { id: agentJob.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: { extractedText, documentId: payload.documentId },
        },
      });
    }

    return { extractedText, documentId: payload.documentId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OCR processing failed';

    if (payload.scope === 'CONSUMER') {
      await prisma.consumerDocument.update({
        where: { id: payload.documentId },
        data: { ocrStatus: 'FAILED' },
      }).catch(() => undefined);
    } else if (payload.scope === 'LEAD') {
      await prisma.leadDocument.update({
        where: { id: payload.documentId },
        data: { ocrStatus: 'FAILED' },
      }).catch(() => undefined);
    }

    if (agentJob) {
      await prisma.agentJob.update({
        where: { id: agentJob.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: message,
        },
      });
    }

    throw error;
  }
}

async function mergeExtractedEvidence(params: {
  evidenceExtractor: EvidenceExtractorService;
  matterMemory: MatterMemoryService;
  extractedText: string;
  fileName: string;
  mimeType?: string;
  sourceDocumentId: string;
  matterId?: string;
  consumerCaseId?: string;
}): Promise<void> {
  try {
    const entity = params.matterId
      ? ({ kind: 'matter' as const, id: params.matterId })
      : params.consumerCaseId
        ? ({ kind: 'consumerCase' as const, id: params.consumerCaseId })
        : null;

    if (!entity) return;

    const snapshot = await params.matterMemory.load(entity.kind, entity.id);
    const result = await params.evidenceExtractor.extract({
      fileName: params.fileName,
      mimeType: params.mimeType,
      textContent: params.extractedText,
      sourceDocumentId: params.sourceDocumentId,
      matterId: params.matterId,
      consumerCaseId: params.consumerCaseId,
      matterProfile: snapshot?.profile,
    });

    if (result.items.length > 0) {
      await params.matterMemory.mergeEvidenceItems(entity.kind, entity.id, result.items);
    }
  } catch {
    // evidence merge is best-effort; don't fail OCR job
  }
}

function extractedTextAad(payload: OcrJobPayload) {
  if (payload.scope === 'CONSUMER') {
    return `consumer-document-extracted-text:${payload.documentId}`;
  }
  if (payload.scope === 'LEAD') {
    return `lead-document-extracted-text:${payload.documentId}`;
  }
  return `document-extracted-text:${payload.documentId}`;
}

export function createOcrWorker() {
  return new Worker<OcrJobPayload>('ocr-processing', processOcrJob, {
    connection: getRedisConnectionOptions(),
    concurrency: 2,
  });
}
