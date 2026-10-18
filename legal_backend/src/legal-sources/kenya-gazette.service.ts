import { Injectable, NotFoundException } from '@nestjs/common';
import {
  GazetteLegalEventType,
  LegalCorpusExtractionMethod,
  LegalCorpusStatus,
  Prisma,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { KenyaGazetteEventExtractorService } from './kenya-gazette-event-extractor.service';

export interface KenyaGazettePageInput {
  pageNumber: number;
  text: string;
  extractionMethod: 'XML' | 'HTML' | 'PDF_TEXT' | 'OCR' | 'API' | 'MANUAL';
  extractionConfidence: number;
  imageStorageUri?: string;
}

@Injectable()
export class KenyaGazetteService {
  static readonly LAW_STATE_ALGORITHM_VERSION = 'ke-law-state-v1';
  static readonly AUTO_ACCEPT_CONFIDENCE = 0.9;

  constructor(
    private readonly prisma: PrismaService,
    private readonly extractor: KenyaGazetteEventExtractorService,
  ) {}

  async ingestIssue(input: {
    gazetteNumber: string;
    gazetteDate: Date;
    title: string;
    sourceUrl: string;
    sourcePolicyId?: string;
    publicationContent: Buffer;
    pages: KenyaGazettePageInput[];
    parserVersion: string;
    metadata?: Record<string, unknown>;
  }) {
    const publicationSha256 = sha256(input.publicationContent);
    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.kenyaGazetteIssue.upsert({
        where: { sourceUrl: input.sourceUrl },
        create: {
          gazetteNumber: input.gazetteNumber,
          gazetteDate: input.gazetteDate,
          title: input.title,
          sourceUrl: input.sourceUrl,
          sourcePolicyId: input.sourcePolicyId,
          publicationSha256,
          pageCount: input.pages.length,
          parserVersion: input.parserVersion,
          metadata: asJson(input.metadata),
        },
        update: {
          publicationSha256,
          pageCount: input.pages.length,
          parserVersion: input.parserVersion,
          metadata: asJson(input.metadata),
        },
      });

      for (const pageInput of input.pages) {
        const lowConfidence =
          pageInput.extractionConfidence < KenyaGazetteService.AUTO_ACCEPT_CONFIDENCE;
        const page = await tx.kenyaGazettePage.upsert({
          where: {
            issueId_pageNumber: {
              issueId: issue.id,
              pageNumber: pageInput.pageNumber,
            },
          },
          create: {
            issueId: issue.id,
            pageNumber: pageInput.pageNumber,
            text: pageInput.text,
            textSha256: sha256(pageInput.text),
            imageStorageUri: pageInput.imageStorageUri,
            extractionMethod:
              pageInput.extractionMethod as LegalCorpusExtractionMethod,
            extractionConfidence: pageInput.extractionConfidence,
            requiresHumanReview: lowConfidence,
          },
          update: {
            text: pageInput.text,
            textSha256: sha256(pageInput.text),
            imageStorageUri: pageInput.imageStorageUri,
            extractionMethod:
              pageInput.extractionMethod as LegalCorpusExtractionMethod,
            extractionConfidence: pageInput.extractionConfidence,
            requiresHumanReview: lowConfidence,
          },
        });
        const noticeBlocks = splitNotices(pageInput.text);
        for (const block of noticeBlocks) {
          await this.persistNotice(tx, issue.id, page.id, block, pageInput.extractionConfidence);
        }
      }
      return issue;
    });
  }

  async verifyEvent(input: {
    eventId: string;
    reviewerId: string;
    approved: boolean;
    note: string;
    affectedWorkUris?: string[];
    effectiveDate?: Date;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const event = await tx.kenyaGazetteLegalEvent.findUnique({
        where: { id: input.eventId },
      });
      if (!event) throw new NotFoundException('Gazette event not found');

      await tx.kenyaGazetteLegalEvent.update({
        where: { id: event.id },
        data: {
          verified: input.approved,
          verifiedBy: input.reviewerId,
          verifiedAt: new Date(),
          requiresHumanReview: !input.approved,
          affectedWorkUris: input.affectedWorkUris ?? event.affectedWorkUris,
          effectiveDate: input.effectiveDate ?? event.effectiveDate,
          metadata: { reviewerNote: input.note },
        },
      });
      await tx.legalCorpusReviewTask.updateMany({
        where: {
          reviewType: 'GAZETTE_EVENT',
          subjectType: 'KenyaGazetteLegalEvent',
          subjectId: event.id,
        },
        data: {
          status: input.approved ? 'APPROVED' : 'REJECTED',
          assignedTo: input.reviewerId,
          decisionNote: input.note,
          reviewedAt: new Date(),
          version: { increment: 1 },
        },
      });
    });
  }

  async computeLawState(workUri: string, asOfDate: Date) {
    const document = await this.prisma.legalCorpusDocument.findUnique({
      where: { workUri },
      include: {
        expressions: {
          where: {
            verificationStatus: 'VERIFIED',
            OR: [{ expressionDate: null }, { expressionDate: { lte: asOfDate } }],
          },
          orderBy: { expressionDate: 'desc' },
          take: 1,
        },
      },
    });
    if (!document) throw new NotFoundException(`Legal work ${workUri} not found`);

    const events = await this.prisma.kenyaGazetteLegalEvent.findMany({
      where: {
        verified: true,
        requiresHumanReview: false,
        affectedWorkUris: { has: workUri },
        OR: [{ effectiveDate: null }, { effectiveDate: { lte: asOfDate } }],
      },
      orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }],
    });
    const expression = document.expressions[0];
    const status = resolveStatus(document.status, events.map((event) => event.eventType));
    const evidence = {
      workUri,
      expressionUri: expression?.expressionUri ?? null,
      verifiedEvents: events.map((event) => ({
        id: event.id,
        type: event.eventType,
        effectiveDate: event.effectiveDate?.toISOString() ?? null,
      })),
      excludedUnverifiedEvents: true,
    };

    return this.prisma.kenyaLawStateSnapshot.upsert({
      where: {
        documentId_asOfDate_algorithmVersion: {
          documentId: document.id,
          asOfDate,
          algorithmVersion: KenyaGazetteService.LAW_STATE_ALGORITHM_VERSION,
        },
      },
      create: {
        documentId: document.id,
        expressionId: expression?.id,
        asOfDate,
        status,
        supportingEventIds: events.map((event) => event.id),
        evidence,
        algorithmVersion: KenyaGazetteService.LAW_STATE_ALGORITHM_VERSION,
      },
      update: {
        expressionId: expression?.id,
        status,
        supportingEventIds: events.map((event) => event.id),
        evidence,
        computedAt: new Date(),
      },
    });
  }

  private async persistNotice(
    tx: Prisma.TransactionClient,
    issueId: string,
    pageId: string,
    text: string,
    sourceConfidence: number,
  ): Promise<void> {
    const noticeNumber = extractNoticeNumber(text);
    const textSha256 = sha256(text);
    const events = this.extractor.extract({ text, sourceConfidence });
    const requiresHumanReview =
      sourceConfidence < KenyaGazetteService.AUTO_ACCEPT_CONFIDENCE ||
      events.some((event) => event.requiresHumanReview);
    const notice = await tx.kenyaGazetteNotice.upsert({
      where: {
        issueId_noticeNumber_textSha256: {
          issueId,
          noticeNumber,
          textSha256,
        },
      },
      create: {
        issueId,
        pageId,
        noticeNumber,
        extractedText: text,
        textSha256,
        extractionConfidence: sourceConfidence,
        requiresHumanReview,
      },
      update: {
        pageId,
        extractionConfidence: sourceConfidence,
        requiresHumanReview,
      },
    });

    const previousEvents = await tx.kenyaGazetteLegalEvent.findMany({
      where: { noticeId: notice.id },
      select: { id: true, verified: true },
    });
    if (previousEvents.some((event) => event.verified)) return;
    if (previousEvents.length > 0) {
      const previousIds = previousEvents.map((event) => event.id);
      await tx.legalCorpusReviewTask.deleteMany({
        where: {
          reviewType: 'GAZETTE_EVENT',
          subjectType: 'KenyaGazetteLegalEvent',
          subjectId: { in: previousIds },
          status: { in: ['PENDING', 'SUPERSEDED'] },
        },
      });
      await tx.kenyaGazetteLegalEvent.deleteMany({
        where: { id: { in: previousIds }, verified: false },
      });
    }

    for (const event of events) {
      const stored = await tx.kenyaGazetteLegalEvent.create({
        data: {
          noticeId: notice.id,
          eventType: event.eventType,
          affectedWorkUris: event.affectedWorkUris,
          effectiveDate: event.effectiveDate,
          extractedText: event.extractedText,
          extractionConfidence: event.extractionConfidence,
          requiresHumanReview: event.requiresHumanReview,
          metadata: { signals: event.signals },
        },
      });
      if (event.requiresHumanReview) {
        await tx.legalCorpusReviewTask.upsert({
          where: {
            reviewType_subjectType_subjectId: {
              reviewType: 'GAZETTE_EVENT',
              subjectType: 'KenyaGazetteLegalEvent',
              subjectId: stored.id,
            },
          },
          create: {
            jurisdiction: 'KE',
            reviewType: 'GAZETTE_EVENT',
            subjectType: 'KenyaGazetteLegalEvent',
            subjectId: stored.id,
            sourceKey: 'KENYA_GAZETTE',
            confidence: event.extractionConfidence,
            reason: 'Gazette event cannot alter law in force until reviewed',
            payload: {
              noticeNumber,
              eventType: event.eventType,
              affectedWorkUris: event.affectedWorkUris,
              effectiveDate: event.effectiveDate?.toISOString(),
              text: event.extractedText,
            },
          },
          update: {
            confidence: event.extractionConfidence,
            payload: {
              noticeNumber,
              eventType: event.eventType,
              affectedWorkUris: event.affectedWorkUris,
              effectiveDate: event.effectiveDate?.toISOString(),
              text: event.extractedText,
            },
            status: 'PENDING',
          },
        });
      }
    }
  }
}

function splitNotices(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const blocks = normalized.split(
    /(?=^\s*(?:GAZETTE NOTICE|LEGAL NOTICE)\s+(?:NO\.?\s*)?\d+)/gim,
  );
  return blocks.map((block) => block.trim()).filter((block) => block.length >= 30);
}

function extractNoticeNumber(text: string): string {
  return (
    text.match(/\b(?:GAZETTE|LEGAL)\s+NOTICE\s+(?:NO\.?\s*)?([A-Z0-9/-]+)/i)?.[1] ??
    ''
  );
}

function resolveStatus(
  initial: LegalCorpusStatus,
  events: GazetteLegalEventType[],
): LegalCorpusStatus {
  let status = initial;
  for (const event of events) {
    if (event === GazetteLegalEventType.COMMENCEMENT) status = 'IN_FORCE';
    if (event === GazetteLegalEventType.REVOCATION) status = 'REPEALED';
  }
  return status;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function asJson(
  value: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  return value as Prisma.InputJsonValue | undefined;
}
