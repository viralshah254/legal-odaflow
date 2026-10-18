import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantGuard } from './tenant.guard';

function contextForRequest(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('TenantGuard', () => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
  const prisma = {
    tenantUser: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires active tenant membership before accepting x-tenant-id', async () => {
    prisma.tenantUser.findUnique.mockResolvedValue(null);
    const guard = new TenantGuard(reflector, prisma as any);
    const request = {
      user: { id: 'user_1', userType: 'LAWYER' },
      headers: { 'x-tenant-id': 'tenant_other' },
      params: {},
    };

    await expect(
      guard.canActivate(contextForRequest(request)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('sets tenant context only after validating membership', async () => {
    prisma.tenantUser.findUnique.mockResolvedValue({
      tenantId: 'tenant_1',
      userId: 'user_1',
      status: 'ACTIVE',
      role: 'PARTNER',
    });
    const guard = new TenantGuard(reflector, prisma as any);
    const request = {
      user: { id: 'user_1', userType: 'LAWYER' },
      headers: { 'x-tenant-id': 'tenant_1' },
      params: {},
    };

    await expect(guard.canActivate(contextForRequest(request))).resolves.toBe(true);
    expect(request).toMatchObject({ tenantId: 'tenant_1' });
    expect(request.user).toMatchObject({ tenantId: 'tenant_1', tenantRole: 'PARTNER' });
  });
});
