import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MatterAccessService } from '@/access/matter-access.service';
import { AuditService } from '@/audit/audit.service';
import { ClientsService } from '@/clients/clients.service';
import { MattersService } from '@/matters/matters.service';
import { FeatureFlagsService } from '@/platform/feature-flags/feature-flags.service';
import { PrismaService } from '@/prisma/prisma.service';
import { TimelineService } from '@/timeline/timeline.service';
import { SavedResearchService } from './saved-research.service';

describe('SavedResearchService', () => {
  const actor = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    tenantRole: 'ASSOCIATE',
  };
  const dto = {
    clientId: 'client-1',
    matterId: 'matter-1',
    aiOutputId: 'output-1',
    title: 'Liability memo',
    query: 'What is the applicable standard?',
    countryCode: 'IN',
    researchJson: { verificationStatus: 'verified', answer: 'Memo' },
  };
  const output = {
    id: 'output-1',
    userId: 'user-1',
    tenantId: 'tenant-1',
    matterId: 'matter-1',
    verified: true,
    requiresLawyerReview: false,
    approvedByLawyerId: null,
    citationAudit: { safeForReliance: true },
    citations: {},
  };
  const saved = {
    id: 'saved-1',
    userId: 'user-1',
    clientId: 'client-1',
    matterId: 'matter-1',
    aiOutputId: 'output-1',
    title: 'Liability memo',
    query: 'What is the applicable standard?',
    countryCode: 'IN',
    researchJson: dto.researchJson,
    createdAt: new Date('2026-07-27T00:00:00.000Z'),
    client: { id: 'client-1', name: 'Client' },
    matter: { id: 'matter-1', title: 'Claim' },
  };

  function setup() {
    const prisma = {
      savedResearch: {
        create: jest.fn().mockResolvedValue(saved),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      aIOutput: {
        findFirst: jest.fn().mockResolvedValue(output),
        findMany: jest.fn().mockResolvedValue([output]),
      },
      manualCitationReviewTask: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const matterAccess = {
      ensureMatterAccess: jest.fn().mockResolvedValue(undefined),
      getAccessibleMatterIds: jest.fn().mockResolvedValue(['matter-1']),
      getAccessibleClientIds: jest.fn().mockResolvedValue(['client-1']),
    };
    const clients = {
      findOne: jest.fn().mockResolvedValue({ id: 'client-1' }),
    };
    const matters = {
      findOne: jest.fn().mockResolvedValue({ id: 'matter-1', clientId: 'client-1' }),
    };
    const audit = {
      logDomainEvent: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    const timeline = {
      create: jest.fn().mockResolvedValue({ id: 'timeline-1' }),
    };
    const featureFlags = {
      assertEnabled: jest.fn(),
    };
    const smartWorkspace = {
      pinSavedResearchToCanvas: jest.fn().mockResolvedValue(undefined),
    };
    const researchCachePromotion = {
      promote: jest.fn().mockResolvedValue(true),
    };
    const service = new SavedResearchService(
      prisma as unknown as PrismaService,
      matterAccess as unknown as MatterAccessService,
      clients as unknown as ClientsService,
      matters as unknown as MattersService,
      audit as unknown as AuditService,
      timeline as unknown as TimelineService,
      featureFlags as unknown as FeatureFlagsService,
      smartWorkspace as never,
      researchCachePromotion as never,
    );
    return {
      service,
      prisma,
      matterAccess,
      clients,
      matters,
      audit,
      timeline,
      featureFlags,
      smartWorkspace,
      researchCachePromotion,
    };
  }

  it('files accessible research and records immutable audit and matter activity', async () => {
    const {
      service,
      prisma,
      matterAccess,
      audit,
      timeline,
      smartWorkspace,
      researchCachePromotion,
    } = setup();

    const result = await service.save(actor, dto);

    expect(matterAccess.ensureMatterAccess).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'matter-1',
      'ASSOCIATE',
    );
    expect(prisma.savedResearch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          aiOutputId: 'output-1',
        }),
      }),
    );
    expect(researchCachePromotion.promote).toHaveBeenCalledWith({
      aiOutputId: 'output-1',
      tenantId: 'tenant-1',
      reason: 'save',
    });
    expect(audit.logDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'saved_research.filed',
        entityType: 'SavedResearch',
        entityId: 'saved-1',
      }),
    );
    expect(timeline.create).toHaveBeenCalledWith(
      'tenant-1',
      'matter-1',
      'user-1',
      'ASSOCIATE',
      expect.objectContaining({ eventType: 'RESEARCH_FILED' }),
    );
    expect(smartWorkspace.pinSavedResearchToCanvas).toHaveBeenCalledWith(
      'tenant-1',
      'matter-1',
      'user-1',
      expect.objectContaining({
        savedResearchId: 'saved-1',
        title: 'Liability memo',
      }),
    );
    expect(result).toEqual(expect.objectContaining({
      aiOutputId: 'output-1',
      verification: expect.objectContaining({
        status: 'verified',
        safeForReliance: true,
      }),
    }));
  });

  it('denies an output from another tenant', async () => {
    const { service, prisma, audit } = setup();
    prisma.aIOutput.findFirst.mockResolvedValue(null);

    await expect(service.save(actor, dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.aIOutput.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'output-1', tenantId: 'tenant-1' }),
      }),
    );
    expect(audit.logDomainEvent).not.toHaveBeenCalled();
  });

  it('denies filing when matter ACL fails', async () => {
    const { service, matterAccess, prisma } = setup();
    matterAccess.ensureMatterAccess.mockRejectedValue(new Error('Matter access denied'));

    await expect(service.save(actor, dto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.savedResearch.create).not.toHaveBeenCalled();
  });

  it('denies a matter assigned to a different client', async () => {
    const { service, matters, prisma } = setup();
    matters.findOne.mockResolvedValue({ id: 'matter-1', clientId: 'client-2' });

    await expect(service.save(actor, dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.savedResearch.create).not.toHaveBeenCalled();
  });

  it('denies another user output that is not attached to an authorized matter', async () => {
    const { service, prisma } = setup();
    prisma.aIOutput.findFirst.mockResolvedValue({
      ...output,
      userId: 'user-2',
      matterId: null,
    });

    await expect(service.save(actor, dto)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows another user output when its matter is authorized and matches the client', async () => {
    const { service, prisma } = setup();
    prisma.aIOutput.findFirst.mockResolvedValue({ ...output, userId: 'user-2' });

    await expect(service.save(actor, dto)).resolves.toEqual(
      expect.objectContaining({ id: 'saved-1' }),
    );
  });

  it('enforces client accessibility for client-only filing', async () => {
    const { service, clients, prisma } = setup();
    clients.findOne.mockRejectedValue(new NotFoundException('Client not found'));

    await expect(service.save(actor, {
      ...dto,
      matterId: undefined,
      aiOutputId: undefined,
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.savedResearch.create).not.toHaveBeenCalled();
  });

  it('keeps tenant and ACL filters on list metadata queries', async () => {
    const { service, prisma } = setup();
    prisma.savedResearch.findMany.mockResolvedValue([saved]);
    prisma.aIOutput.findMany.mockResolvedValue([output]);

    await service.list(actor, {});

    expect(prisma.savedResearch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          clientId: { in: ['client-1'] },
          OR: [{ matterId: null }, { matterId: { in: ['matter-1'] } }],
        }),
      }),
    );
    expect(prisma.aIOutput.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['output-1'] }, tenantId: 'tenant-1' },
      }),
    );
    expect(prisma.manualCitationReviewTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', aiOutputId: { in: ['output-1'] } },
      }),
    );
  });

  it('returns a typed promotion blocker without creating a document', async () => {
    const { service, prisma } = setup();
    prisma.savedResearch.findFirst.mockResolvedValue(saved);
    prisma.aIOutput.findMany.mockResolvedValue([output]);

    const result = await service.promote(actor, 'saved-1', {
      confirmPromotion: true,
      format: 'MARKDOWN_WITH_JSON_APPENDIX',
    });

    expect(result).toEqual(expect.objectContaining({
      supported: false,
      code: 'SERVER_SIDE_DOCUMENT_PROMOTION_UNSUPPORTED',
      preservationRequirements: expect.objectContaining({
        markdownBody: true,
        verificationJsonAppendix: true,
      }),
    }));
  });

  it('fails closed before filing when the rollout flag is unavailable', async () => {
    const { service, prisma, featureFlags } = setup();
    featureFlags.assertEnabled.mockImplementation(() => {
      throw new NotFoundException({
        code: 'FEATURE_UNAVAILABLE',
        feature: 'RESEARCH_MATTER_FILING',
      });
    });

    await expect(service.save(actor, dto)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'FEATURE_UNAVAILABLE' }),
    });
    expect(prisma.savedResearch.create).not.toHaveBeenCalled();
  });
});
