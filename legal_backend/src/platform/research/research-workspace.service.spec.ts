import { ConflictException, NotFoundException } from '@nestjs/common';
import { MatterAccessService } from '@/access/matter-access.service';
import { FeatureFlagsService } from '@/platform/feature-flags/feature-flags.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ResearchWorkspaceService } from './research-workspace.service';

describe('ResearchWorkspaceService', () => {
  const workspace = {
    id: 'workspace-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    matterId: null,
    revision: 0,
    contextItems: [],
  };

  function setup() {
    const tx = {
      researchWorkspace: {
        create: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findFirstOrThrow: jest.fn(),
      },
      researchWorkspaceRevision: {
        aggregate: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      researchWorkspaceContextItem: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      aIOutput: {
        findFirst: jest.fn(),
      },
      matter: {
        findFirst: jest.fn(),
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
      hasFullAccess: jest.fn().mockReturnValue(false),
      ensureMatterAccess: jest.fn(),
    };
    const featureFlags = {
      assertEnabled: jest.fn(),
    };
    const service = new ResearchWorkspaceService(
      prisma as unknown as PrismaService,
      matterAccess as unknown as MatterAccessService,
      featureFlags as unknown as FeatureFlagsService,
    );
    return { service, prisma, matterAccess, featureFlags };
  }

  it('creates a tenant-owned workspace after checking matter access', async () => {
    const { service, prisma, matterAccess } = setup();
    prisma.matter.findFirst.mockResolvedValue({ id: 'matter-1' });
    prisma.researchWorkspace.create.mockResolvedValue({
      ...workspace,
      matterId: 'matter-1',
    });

    await service.create('tenant-1', 'user-1', 'ASSOCIATE', {
      objective: '  Determine limitation period  ',
      matterId: 'matter-1',
    });

    expect(matterAccess.ensureMatterAccess).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'matter-1',
      'ASSOCIATE',
    );
    expect(prisma.researchWorkspace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          matterId: 'matter-1',
          objective: 'Determine limitation period',
        }),
      }),
    );
  });

  it('supports a matterless workspace without a matter-access lookup', async () => {
    const { service, prisma, matterAccess } = setup();
    prisma.researchWorkspace.findFirst.mockResolvedValue(workspace);

    await expect(
      service.get('workspace-1', 'tenant-1', 'user-1', 'ASSOCIATE'),
    ).resolves.toEqual(workspace);
    expect(matterAccess.ensureMatterAccess).not.toHaveBeenCalled();
  });

  it('appends structured context and advances the optimistic revision', async () => {
    const { service, prisma } = setup();
    prisma.researchWorkspace.findFirst.mockResolvedValue(workspace);
    prisma.researchWorkspace.updateMany.mockResolvedValue({ count: 1 });
    prisma.researchWorkspaceContextItem.create.mockResolvedValue({
      id: 'context-1',
      ordinal: 1,
    });

    await expect(
      service.appendContext('workspace-1', 'tenant-1', 'user-1', undefined, {
        expectedRevision: 0,
        kind: 'fact',
        content: { text: 'Notice served on 1 July' },
        provenance: { sourceType: 'document', sourceId: 'document-1' },
        affectedIssueIds: ['limitations'],
      }),
    ).resolves.toEqual({
      item: { id: 'context-1', ordinal: 1 },
      workspaceRevision: 1,
    });
    expect(prisma.researchWorkspace.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          revision: 0,
        }),
      }),
    );
  });

  it('links a scoped AI output as the next ordered revision', async () => {
    const { service, prisma } = setup();
    prisma.researchWorkspace.findFirst.mockResolvedValue(workspace);
    prisma.aIOutput.findFirst.mockResolvedValue({ matterId: null });
    prisma.researchWorkspace.updateMany.mockResolvedValue({ count: 1 });
    prisma.researchWorkspaceRevision.aggregate.mockResolvedValue({
      _max: { revision: null },
    });
    prisma.researchWorkspaceRevision.create.mockResolvedValue({ id: 'revision-1' });
    prisma.researchWorkspace.findFirstOrThrow.mockResolvedValue({
      ...workspace,
      revision: 1,
    });

    await service.update('workspace-1', 'tenant-1', 'user-1', undefined, {
      expectedRevision: 0,
      revision: {
        aiOutputId: 'output-1',
        affectedIssueIds: ['limitations'],
        provenance: { sourceType: 'research-run' },
      },
    });

    expect(prisma.researchWorkspaceRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-1',
        aiOutputId: 'output-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        revision: 1,
      }),
    });
  });

  it('rejects a stale update instead of silently overwriting', async () => {
    const { service, prisma } = setup();
    prisma.researchWorkspace.findFirst.mockResolvedValue(workspace);
    prisma.researchWorkspace.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.update('workspace-1', 'tenant-1', 'user-1', undefined, {
        expectedRevision: 0,
        title: 'New title',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('hides workspaces outside the caller tenant and user scope', async () => {
    const { service, prisma } = setup();
    prisma.researchWorkspace.findFirst.mockResolvedValue(null);

    await expect(
      service.get('workspace-1', 'tenant-2', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.researchWorkspace.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'workspace-1',
          tenantId: 'tenant-2',
          userId: 'user-1',
        },
      }),
    );
  });

  it('fails closed before persistence when the workspace flag is unavailable', async () => {
    const { service, prisma, featureFlags } = setup();
    featureFlags.assertEnabled.mockImplementation(() => {
      throw new NotFoundException({
        code: 'FEATURE_UNAVAILABLE',
        feature: 'RESEARCH_WORKSPACE_FOLLOW_ON',
      });
    });

    await expect(
      service.create('tenant-1', 'user-1', 'ASSOCIATE', {
        objective: 'Assess limitation',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'FEATURE_UNAVAILABLE',
        feature: 'RESEARCH_WORKSPACE_FOLLOW_ON',
      }),
    });
    expect(prisma.researchWorkspace.create).not.toHaveBeenCalled();
  });
});
