import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantPermissionGuard } from './tenant-permission.guard';

function contextForRequest(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('TenantPermissionGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const permissions = {
    hasPermission: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows requests with the required tenant permission', async () => {
    reflector.getAllAndOverride.mockReturnValue('canViewFinance');
    permissions.hasPermission.mockResolvedValue(true);
    const guard = new TenantPermissionGuard(reflector as unknown as Reflector, permissions as any);

    await expect(
      guard.canActivate(
        contextForRequest({
          tenantId: 'tenant_1',
          user: { tenantRole: 'FINANCE' },
        }),
      ),
    ).resolves.toBe(true);
  });

  it('blocks requests without the required tenant permission', async () => {
    reflector.getAllAndOverride.mockReturnValue('canViewFinance');
    permissions.hasPermission.mockResolvedValue(false);
    const guard = new TenantPermissionGuard(reflector as unknown as Reflector, permissions as any);

    await expect(
      guard.canActivate(
        contextForRequest({
          tenantId: 'tenant_1',
          user: { tenantRole: 'ASSOCIATE' },
        }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
