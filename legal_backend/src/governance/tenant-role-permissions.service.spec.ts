import { TenantRolePermissionsService } from './tenant-role-permissions.service';

describe('TenantRolePermissionsService', () => {
  const prisma = {
    firmProfile: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
  let service: TenantRolePermissionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantRolePermissionsService(prisma as any);
  });

  it('grants all permissions to FIRM_ADMIN via PARTNER_ADMIN alias', async () => {
    await expect(
      service.hasPermission('tenant_1', 'FIRM_ADMIN', 'canViewFinance'),
    ).resolves.toBe(true);
  });

  it('denies finance access to ASSOCIATE', async () => {
    await expect(
      service.hasPermission('tenant_1', 'ASSOCIATE', 'canViewFinance'),
    ).resolves.toBe(false);
  });

  it('grants finance access to FINANCE role', async () => {
    await expect(
      service.hasPermission('tenant_1', 'FINANCE', 'canViewFinance'),
    ).resolves.toBe(true);
  });

  it('maps PARTNER to JUNIOR_PARTNER permissions', async () => {
    await expect(
      service.hasPermission('tenant_1', 'PARTNER', 'canViewFinance'),
    ).resolves.toBe(false);
    await expect(
      service.hasPermission('tenant_1', 'PARTNER', 'canCreateMatter'),
    ).resolves.toBe(true);
  });
});
