import { ClientsService } from './clients.service';

describe('ClientsService activity summary', () => {
  function buildService(accessibleMatterIds: string[] | null) {
    const prisma = {
      client: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'client-1' })
          .mockResolvedValueOnce({
            id: 'client-1',
            name: 'Example Client',
            updatedAt: new Date('2026-07-20T00:00:00.000Z'),
          }),
      },
      matter: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'matter-1',
            title: 'Claim',
            updatedAt: new Date('2026-07-25T00:00:00.000Z'),
          },
        ]),
      },
      document: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'document-1',
            fileName: 'Evidence.pdf',
            createdAt: new Date('2026-07-26T00:00:00.000Z'),
          },
        ]),
      },
      kycDocument: { findMany: jest.fn().mockResolvedValue([]) },
      meeting: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'meeting-1',
            title: 'Review',
            scheduledAt: new Date('2026-07-24T00:00:00.000Z'),
            createdAt: new Date('2026-07-23T00:00:00.000Z'),
          },
        ]),
      },
      savedResearch: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'research-1',
            title: 'Liability memo',
            matterId: 'matter-1',
            aiOutputId: 'output-1',
            createdAt: new Date('2026-07-27T00:00:00.000Z'),
          },
        ]),
      },
    };
    const matterAccess = {
      hasFullAccess: jest.fn().mockReturnValue(accessibleMatterIds === null),
      getAccessibleClientIds: jest.fn().mockResolvedValue(['client-1']),
      getAccessibleMatterIds: jest.fn().mockResolvedValue(accessibleMatterIds),
    };
    const service = Object.create(ClientsService.prototype) as ClientsService;
    Object.assign(service, { prisma, matterAccess });
    return { service, prisma };
  }

  it('scopes related activity to matters the user can access', async () => {
    const { service, prisma } = buildService(['matter-1']);

    const result = await service.getActivitySummary(
      'tenant-1',
      'client-1',
      'user-1',
      'ASSOCIATE',
    );

    expect(prisma.matter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', clientId: 'client-1', id: { in: ['matter-1'] } },
      }),
    );
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          clientId: 'client-1',
          status: 'ACTIVE',
          OR: [{ matterId: null }, { matterId: { in: ['matter-1'] } }],
        }),
      }),
    );
    expect(result.items.map((item) => item.id)).toEqual([
      'research-research-1',
      'document-document-1',
      'matter-matter-1',
      'meeting-meeting-1',
      'client-client-1',
    ]);
    expect(prisma.savedResearch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          clientId: 'client-1',
          OR: [{ matterId: null }, { matterId: { in: ['matter-1'] } }],
        },
      }),
    );
  });

  it('does not constrain matter activity for full-access roles', async () => {
    const { service, prisma } = buildService(null);

    await service.getActivitySummary('tenant-1', 'client-1', 'admin-1', 'ADMIN');

    expect(prisma.matter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', clientId: 'client-1' },
      }),
    );
  });
});
