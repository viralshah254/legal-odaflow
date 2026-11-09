import { MatterAccessService } from './matter-access.service';

describe('Central matter access boundaries', () => {
  function setup() {
    const prisma = {
      matter: { findFirst: jest.fn().mockResolvedValue({ id: 'matter', clientId: 'client' }), findMany: jest.fn().mockResolvedValue([{ id: 'allowed' }]) },
      ethicalWall: { findMany: jest.fn().mockResolvedValue([]) },
      matterAccess: { findMany: jest.fn().mockResolvedValue([{ matterId: 'matter' }]), findUnique: jest.fn().mockResolvedValue({ tenantId: 'firm' }) },
    };
    const walls = { checkAccess: jest.fn().mockResolvedValue({ allowed: true }) };
    return { prisma, walls, service: new MatterAccessService(prisma as any, walls as any) };
  }
  it('does not let an administrative role bypass another tenant or an ethical wall', async () => {
    const { prisma, walls, service } = setup();
    prisma.matter.findFirst.mockResolvedValueOnce(null);
    await expect(service.ensureMatterAccess('firm', 'admin', 'foreign', 'FIRM_ADMIN')).rejects.toThrow('access denied');
    walls.checkAccess.mockResolvedValueOnce({ allowed: false });
    await expect(service.ensureMatterAccess('firm', 'admin', 'matter', 'FIRM_ADMIN')).rejects.toThrow('ethical wall');
    expect(walls.checkAccess).toHaveBeenCalledWith('firm', 'admin', 'matter', 'client');
  });
  it('filters restricted matters from a broad-role listing instead of returning unrestricted null scope', async () => {
    const { prisma, service } = setup();
    prisma.ethicalWall.findMany.mockResolvedValue([{ protectedMatterIds: ['restricted'], protectedClientIds: [] }]);
    expect(await service.getAccessibleMatterIds('firm', 'admin', 'PARTNER')).toEqual(['allowed']);
    expect(prisma.matter.findMany).toHaveBeenCalledWith({ where: { tenantId: 'firm', id: { notIn: ['restricted'] } }, select: { id: true } });
  });
});
