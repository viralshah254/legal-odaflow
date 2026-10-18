import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ManualCitationReviewStatus } from '@prisma/client';
import { MatterAccessService } from '@/access/matter-access.service';
import { FeatureFlagsService } from '@/platform/feature-flags/feature-flags.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ManualCitationReviewService } from './manual-citation-review.service';

describe('ManualCitationReviewService', () => {
  const task = {
    id: 'task-1',
    tenantId: 'tenant-1',
    aiOutputId: 'output-1',
    matterId: null,
    citationKey: 'key-1',
    citation: '(2010) 11 SCC 441',
    claim: null,
    auditEntry: {},
    status: ManualCitationReviewStatus.PENDING,
    version: 0,
    createdAt: new Date('2026-07-27T00:00:00.000Z'),
    updatedAt: new Date('2026-07-27T00:00:00.000Z'),
  };

  function setup() {
    const tx = {
      manualCitationReviewTask: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      manualCitationReview: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      aIOutput: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };
    const prisma = {
      ...tx,
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => unknown): Promise<unknown> =>
          callback(tx),
      ),
    };
    const matterAccess = {
      ensureMatterAccess: jest.fn(),
    };
    const featureFlags = {
      assertEnabled: jest.fn(),
    };
    const service = new ManualCitationReviewService(
      prisma as unknown as PrismaService,
      matterAccess as unknown as MatterAccessService,
      featureFlags as unknown as FeatureFlagsService,
    );
    return { service, prisma, matterAccess, featureFlags };
  }

  it('materializes unresolved audit entries once and returns a separate manual summary', async () => {
    const { service, prisma } = setup();
    prisma.aIOutput.findFirst.mockResolvedValue({
      id: 'output-1',
      tenantId: 'tenant-1',
      matterId: null,
      citationAudit: {
        safeForReliance: false,
        rejectedCitations: [
          {
            citation: '(2010) 11 SCC 441',
            verified: false,
            missingReasons: ['passage: missing'],
          },
        ],
        verificationGaps: [
          {
            citation: '(2010) 11 SCC 441',
            reasons: ['passage: missing'],
          },
        ],
      },
    });
    prisma.manualCitationReviewTask.findMany.mockResolvedValue([task]);

    const result = await service.listAndMaterialize({
      outputId: 'output-1',
      tenantId: 'tenant-1',
      userId: 'lawyer-1',
      userType: 'LAWYER',
      tenantRole: 'ASSOCIATE',
    });

    expect(prisma.manualCitationReviewTask.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: [
          expect.objectContaining({
            tenantId: 'tenant-1',
            aiOutputId: 'output-1',
            citation: '(2010) 11 SCC 441',
          }),
        ],
      }),
    );
    expect(result.tasks[0].status).toBe('pending');
    expect(result.summary).toEqual(
      expect.objectContaining({
        total: 1,
        pending: 1,
        automatedCitationAuditUnchanged: true,
        safeForRelianceUnchanged: true,
      }),
    );
  });

  it('records a passage-backed approval, reviewer identity, and immutable audit event', async () => {
    const { service, prisma } = setup();
    prisma.aIOutput.findFirst.mockResolvedValue({
      id: 'output-1',
      tenantId: 'tenant-1',
      matterId: null,
      citationAudit: { safeForReliance: false },
    });
    prisma.manualCitationReviewTask.findFirst.mockResolvedValue(task);
    prisma.manualCitationReviewTask.updateMany.mockResolvedValue({ count: 1 });
    prisma.manualCitationReview.create.mockResolvedValue({ id: 'review-1' });
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
    prisma.manualCitationReviewTask.findMany.mockResolvedValue([
      { ...task, status: ManualCitationReviewStatus.APPROVED, version: 1 },
    ]);
    prisma.manualCitationReview.findMany.mockResolvedValue([
      { id: 'review-1', decision: 'APPROVE', reviewerId: 'lawyer-1' },
    ]);

    const result = await service.decide({
      outputId: 'output-1',
      taskId: 'task-1',
      tenantId: 'tenant-1',
      userId: 'lawyer-1',
      userType: 'LAWYER',
      tenantRole: 'PARTNER',
      dto: {
        decision: 'APPROVE',
        reviewerNote: 'Checked against the reported judgment.',
        expectedVersion: 0,
        sourceUrl: 'https://court.example/judgment',
        sourceHash: 'a'.repeat(64),
        exactPassage: 'The exact holding supports the proposition stated in the memo.',
        pinpoint: 'paragraph 42',
        evidenceKind: 'PASSAGE',
      },
    });

    expect(prisma.manualCitationReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reviewerId: 'lawyer-1',
        decision: 'APPROVE',
        sourceHash: 'a'.repeat(64),
        exactPassage: expect.stringContaining('exact holding'),
        pinpoint: 'paragraph 42',
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'manual_citation_review.approve',
        entityId: 'task-1',
        metadata: expect.objectContaining({ reviewId: 'review-1' }),
      }),
    });
    expect(result.tasks[0].status).toBe('approved');
    expect(result.summary.approved).toBe(1);
    expect((prisma.aIOutput as { update?: jest.Mock }).update).toBeUndefined();
  });

  it('requires a note and complete evidence for decisions', async () => {
    const { service, prisma } = setup();
    prisma.aIOutput.findFirst.mockResolvedValue({
      id: 'output-1',
      tenantId: 'tenant-1',
      matterId: null,
      citationAudit: {},
    });

    await expect(
      service.decide({
        outputId: 'output-1',
        taskId: 'task-1',
        tenantId: 'tenant-1',
        userId: 'lawyer-1',
        userType: 'LAWYER',
        tenantRole: 'ASSOCIATE',
        dto: {
          decision: 'APPROVE',
          reviewerNote: 'Checked',
          expectedVersion: 0,
          evidenceKind: 'PASSAGE',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.decide({
        outputId: 'output-1',
        taskId: 'task-1',
        tenantId: 'tenant-1',
        userId: 'lawyer-1',
        userType: 'LAWYER',
        tenantRole: 'ASSOCIATE',
        dto: {
          decision: 'REJECT',
          reviewerNote: ' ',
          expectedVersion: 0,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails closed when the submitted evidence is identity-only', async () => {
    const { service, prisma } = setup();
    prisma.aIOutput.findFirst.mockResolvedValue({
      id: 'output-1',
      tenantId: 'tenant-1',
      matterId: null,
      citationAudit: {},
    });

    await expect(
      service.decide({
        outputId: 'output-1',
        taskId: 'task-1',
        tenantId: 'tenant-1',
        userId: 'lawyer-1',
        userType: 'LAWYER',
        tenantRole: 'ASSOCIATE',
        dto: {
          decision: 'APPROVE',
          reviewerNote: 'The citation exists.',
          expectedVersion: 0,
          sourceUrl: 'https://court.example/case',
          sourceHash: 'b'.repeat(64),
          exactPassage: 'Case title and reporter citation only',
          pinpoint: 'reporter page 1',
          evidenceKind: 'IDENTITY_ONLY',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.manualCitationReviewTask.findFirst.mockResolvedValue(task);
    await expect(
      service.decide({
        outputId: 'output-1',
        taskId: 'task-1',
        tenantId: 'tenant-1',
        userId: 'lawyer-1',
        userType: 'LAWYER',
        tenantRole: 'ASSOCIATE',
        dto: {
          decision: 'APPROVE',
          reviewerNote: 'The citation exists.',
          expectedVersion: 0,
          sourceUrl: 'https://court.example/case',
          sourceHash: 'b'.repeat(64),
          exactPassage: '(2010) 11 SCC 441',
          pinpoint: 'reporter page 441',
          evidenceKind: 'PASSAGE',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.manualCitationReviewTask.updateMany).not.toHaveBeenCalled();
  });

  it('hides outputs from other tenants and enforces matter access', async () => {
    const { service, prisma, matterAccess } = setup();
    prisma.aIOutput.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.listAndMaterialize({
        outputId: 'output-1',
        tenantId: 'tenant-2',
        userId: 'lawyer-1',
        userType: 'LAWYER',
        tenantRole: 'ASSOCIATE',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.aIOutput.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'output-1', tenantId: 'tenant-2' },
      }),
    );

    prisma.aIOutput.findFirst.mockResolvedValueOnce({
      id: 'output-1',
      tenantId: 'tenant-1',
      matterId: 'matter-1',
      citationAudit: {},
    });
    matterAccess.ensureMatterAccess.mockRejectedValueOnce(new Error('denied'));
    await expect(
      service.listAndMaterialize({
        outputId: 'output-1',
        tenantId: 'tenant-1',
        userId: 'lawyer-1',
        userType: 'LAWYER',
        tenantRole: 'ASSOCIATE',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects stale task versions instead of silently overwriting', async () => {
    const { service, prisma } = setup();
    prisma.aIOutput.findFirst.mockResolvedValue({
      id: 'output-1',
      tenantId: 'tenant-1',
      matterId: null,
      citationAudit: {},
    });
    prisma.manualCitationReviewTask.findFirst.mockResolvedValue(task);
    prisma.manualCitationReviewTask.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.decide({
        outputId: 'output-1',
        taskId: 'task-1',
        tenantId: 'tenant-1',
        userId: 'lawyer-1',
        userType: 'LAWYER',
        tenantRole: 'FIRM_ADMIN',
        dto: {
          decision: 'REJECT',
          reviewerNote: 'The cited source does not support this proposition.',
          expectedVersion: 0,
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.manualCitationReview.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('returns feature-unavailable before materializing review tasks', async () => {
    const { service, prisma, featureFlags } = setup();
    featureFlags.assertEnabled.mockImplementation(() => {
      throw new NotFoundException({
        code: 'FEATURE_UNAVAILABLE',
        feature: 'RESEARCH_MANUAL_CITATION_REVIEW',
      });
    });

    await expect(
      service.listAndMaterialize({
        outputId: 'output-1',
        tenantId: 'tenant-1',
        userId: 'lawyer-1',
        userType: 'LAWYER',
        tenantRole: 'ASSOCIATE',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FEATURE_UNAVAILABLE' }),
    });
    expect(prisma.manualCitationReviewTask.createMany).not.toHaveBeenCalled();
  });
});
