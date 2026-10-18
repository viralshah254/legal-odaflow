import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BulkReviewService } from './bulk-review.service';

jest.mock('@/ai/ai-gateway.service', () => ({
  AiGatewayService: class AiGatewayService {},
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClient {},
  Prisma: {},
}));

describe('BulkReviewService', () => {
  const makeService = () => {
    const prisma = {
      matter: { findFirst: jest.fn() },
      matterAccess: { findUnique: jest.fn() },
      document: { findMany: jest.fn(), findFirst: jest.fn() },
      bulkDocumentReviewJob: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const aiGateway = {
      runDiligenceExtraction: jest.fn(),
      runIntakeDeepAnalysis: jest.fn(),
    };
    const realtime = {
      publishToTenant: jest.fn(),
      publishToUser: jest.fn(),
    };
    const encryption = {
      decryptStringFromStorage: jest.fn((value: string | null) => value),
    };
    const matterAccess = {
      hasFullAccess: jest.fn(() => true),
      ensureMatterAccess: jest.fn(),
    };
    const featureFlags = {
      isEnabled: jest.fn(() => true),
    };
    const service = new BulkReviewService(
      prisma as never,
      aiGateway as never,
      realtime as never,
      encryption as never,
      matterAccess as never,
      featureFlags as never,
    );
    return { service, prisma, aiGateway, realtime, matterAccess, featureFlags };
  };

  it('rejects a document that is not owned by the requested matter', async () => {
    const { service, prisma } = makeService();
    prisma.matter.findFirst.mockResolvedValue({ id: 'matter-1' });
    prisma.document.findMany.mockResolvedValue([]);

    await expect(
      service.create('tenant-1', 'matter-1', ['other-matter-doc'], 'user-1', 'PARTNER'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.bulkDocumentReviewJob.create).not.toHaveBeenCalled();
  });

  it('enforces user matter access when listing review jobs', async () => {
    const { service, prisma, matterAccess } = makeService();
    prisma.matter.findFirst.mockResolvedValue({ id: 'matter-1' });
    matterAccess.hasFullAccess.mockReturnValue(false);
    matterAccess.ensureMatterAccess.mockRejectedValue(new Error('denied'));

    await expect(
      service.list('tenant-1', 'matter-1', 'user-1', 'ASSOCIATE'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.bulkDocumentReviewJob.findMany).not.toHaveBeenCalled();
  });

  it('returns the active job for the same normalized document set', async () => {
    const { service, prisma } = makeService();
    prisma.matter.findFirst.mockResolvedValue({ id: 'matter-1' });
    prisma.document.findMany.mockResolvedValue([
      {
        id: 'doc-a',
        version: 1,
        updatedAt: new Date('2026-01-01'),
        extractedText: 'A',
        htmlContent: null,
      },
      {
        id: 'doc-b',
        version: 1,
        updatedAt: new Date('2026-01-01'),
        extractedText: 'B',
        htmlContent: null,
      },
    ]);
    prisma.bulkDocumentReviewJob.findMany.mockResolvedValue([
      {
        id: 'existing-job',
        documentIds: ['doc-a', 'doc-b'],
        status: 'RUNNING',
      },
    ]);

    const result = await service.create(
      'tenant-1',
      'matter-1',
      ['doc-b', 'doc-a', 'doc-a'],
      'user-1',
      'PARTNER',
    );

    expect(result).toMatchObject({ id: 'existing-job' });
    expect(prisma.bulkDocumentReviewJob.create).not.toHaveBeenCalled();
  });

  it('persists a versioned content manifest for incremental re-review', async () => {
    const { service, prisma } = makeService();
    prisma.matter.findFirst.mockResolvedValue({ id: 'matter-1' });
    prisma.document.findMany.mockResolvedValue([
      {
        id: 'doc-a',
        version: 3,
        updatedAt: new Date('2026-07-26T00:00:00.000Z'),
        extractedText: 'encrypted-content',
        htmlContent: null,
      },
    ]);
    prisma.bulkDocumentReviewJob.findMany.mockResolvedValue([]);
    prisma.bulkDocumentReviewJob.create.mockResolvedValue({
      id: 'job-new',
      matterId: 'matter-1',
      documentIds: ['doc-a'],
    });
    prisma.bulkDocumentReviewJob.findFirst.mockResolvedValue(null);

    await service.create('tenant-1', 'matter-1', ['doc-a'], 'user-1', 'PARTNER');

    expect(prisma.bulkDocumentReviewJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        promptVersion: 'matter-file-review-v2',
        corpusManifest: [
          expect.objectContaining({
            documentId: 'doc-a',
            version: 3,
            contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          }),
        ],
      }),
    });
  });

  it('reviews every document chunk and stores matter-wide synthesis', async () => {
    const { service, prisma, aiGateway } = makeService();
    const text = 'x'.repeat(22_050);
    prisma.bulkDocumentReviewJob.findFirst.mockResolvedValue({
      id: 'job-1',
      tenantId: 'tenant-1',
      matterId: 'matter-1',
      status: 'QUEUED',
      documentIds: ['doc-1'],
      summaryMatrix: null,
    });
    prisma.document.findFirst.mockResolvedValue({
      id: 'doc-1',
      fileName: 'agreement.pdf',
      extractedText: text,
      htmlContent: null,
    });
    prisma.bulkDocumentReviewJob.update.mockResolvedValue({});
    aiGateway.runDiligenceExtraction.mockImplementation(
      async ({ documentId }: { documentId: string }) => ({
        summary: `Summary for ${documentId}`,
        risks: ['MEDIUM: review'],
      }),
    );
    aiGateway.runIntakeDeepAnalysis.mockResolvedValue({
      outputMarkdown: JSON.stringify({
        executiveSummary: 'Matter summary',
        chronology: [
          {
            date: '2026-01-01',
            event: 'Agreement signed',
            citations: [{ documentId: 'doc-1', chunk: 1 }],
            confidence: 0.9,
          },
        ],
        missingItems: [],
        contradictions: [],
        recommendedActions: [
          {
            action: 'Confirm signature',
            priority: 'HIGH',
            citations: [{ documentId: 'doc-1' }],
          },
        ],
        citations: [{ documentId: 'doc-1' }],
        confidence: 0.9,
      }),
    });

    await (service as unknown as { runJob: (...args: string[]) => Promise<void> }).runJob(
      'tenant-1',
      'user-1',
      'job-1',
    );

    expect(aiGateway.runDiligenceExtraction).toHaveBeenCalledTimes(3);
    for (const [input] of aiGateway.runDiligenceExtraction.mock.calls) {
      expect(input.documentText.length).toBeLessThanOrEqual(11_000);
    }
    const finalUpdate = prisma.bulkDocumentReviewJob.update.mock.calls.find(
      ([input]) => input.data.status === 'COMPLETED',
    )?.[0];
    expect(finalUpdate.data.summaryMatrix).toMatchObject({
      version: 2,
      documents: [
        {
          documentId: 'doc-1',
          confidence: 1,
          coverage: {
            charactersAvailable: 22_050,
            charactersAnalyzed: 22_050,
            chunksTotal: 3,
            chunksAnalyzed: 3,
            complete: true,
          },
        },
      ],
      synthesis: {
        executiveSummary: 'Matter summary',
        confidence: 0.9,
      },
    });
  });
});
