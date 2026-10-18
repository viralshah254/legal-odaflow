import { MatterAccessManagementService } from './matter-access-management.service';

describe('MatterAccessManagementService identifier contract', () => {
  it('updates access by userId, matching revoke semantics', async () => {
    const prisma = {
      matter: { findFirst: jest.fn().mockResolvedValue({ id: 'matter-1' }) },
      matterAccess: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'share-1',
          tenantId: 'tenant-1',
          matterId: 'matter-1',
          userId: 'user-1',
        }),
        update: jest.fn().mockResolvedValue({ id: 'share-1', accessLevel: 'WRITE' }),
      },
    };
    const service = Object.create(
      MatterAccessManagementService.prototype,
    ) as MatterAccessManagementService;
    Object.assign(service, {
      prisma,
      matterAccess: { hasFullAccess: () => true },
    });

    await service.updateAccess(
      'tenant-1',
      'matter-1',
      'user-1',
      'admin-1',
      'FIRM_ADMIN',
      { accessLevel: 'WRITE' },
    );

    expect(prisma.matterAccess.findUnique).toHaveBeenCalledWith({
      where: { matterId_userId: { matterId: 'matter-1', userId: 'user-1' } },
    });
    expect(prisma.matterAccess.update).toHaveBeenCalledWith({
      where: { matterId_userId: { matterId: 'matter-1', userId: 'user-1' } },
      data: { accessLevel: 'WRITE', grantedBy: 'admin-1' },
    });
  });

  it('revokes access by the same matterId/userId compound identifier', async () => {
    const prisma = {
      matter: { findFirst: jest.fn().mockResolvedValue({ id: 'matter-1' }) },
      matterAccess: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'share-1',
          tenantId: 'tenant-1',
          matterId: 'matter-1',
          userId: 'user-1',
        }),
        delete: jest.fn().mockResolvedValue({ id: 'share-1' }),
      },
    };
    const service = Object.create(
      MatterAccessManagementService.prototype,
    ) as MatterAccessManagementService;
    Object.assign(service, {
      prisma,
      matterAccess: { hasFullAccess: () => true },
    });

    await expect(
      service.revokeAccess(
        'tenant-1',
        'matter-1',
        'user-1',
        'admin-1',
        'FIRM_ADMIN',
      ),
    ).resolves.toEqual({ success: true, revokedBy: 'admin-1' });
    expect(prisma.matterAccess.delete).toHaveBeenCalledWith({
      where: { matterId_userId: { matterId: 'matter-1', userId: 'user-1' } },
    });
  });
});
