import { ExecutionContext, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ScimBearerGuard } from './scim-bearer.guard';

function contextForRequest(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('ScimBearerGuard', () => {
  const prisma = {
    tenant: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects missing Authorization header', async () => {
    const guard = new ScimBearerGuard(prisma as any);
    const request = { params: { tenantId: 'tenant_1' }, headers: {} };

    await expect(guard.canActivate(contextForRequest(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects wrong bearer token', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant_1',
      isActive: true,
      ssoConfig: {
        scimEnabled: true,
        scimBearerToken: 'correct-secret-token-with-enough-length-here',
      },
    });
    const guard = new ScimBearerGuard(prisma as any);
    const request = {
      params: { tenantId: 'tenant_1' },
      headers: { authorization: 'Bearer wrong-token' },
    };

    await expect(guard.canActivate(contextForRequest(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when SCIM is disabled', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant_1',
      isActive: true,
      ssoConfig: { scimEnabled: false, scimBearerToken: 'token' },
    });
    const guard = new ScimBearerGuard(prisma as any);
    const request = {
      params: { tenantId: 'tenant_1' },
      headers: { authorization: 'Bearer token' },
    };

    await expect(guard.canActivate(contextForRequest(request))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('returns 404 for inactive tenant', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);
    const guard = new ScimBearerGuard(prisma as any);
    const request = {
      params: { tenantId: 'tenant_1' },
      headers: { authorization: 'Bearer token' },
    };

    await expect(guard.canActivate(contextForRequest(request))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('allows valid bearer token', async () => {
    const token = 'correct-secret-token-with-enough-length-here';
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant_1',
      isActive: true,
      ssoConfig: { scimEnabled: true, scimBearerToken: token },
    });
    const guard = new ScimBearerGuard(prisma as any);
    const request = {
      params: { tenantId: 'tenant_1' },
      headers: { authorization: `Bearer ${token}` },
    };

    await expect(guard.canActivate(contextForRequest(request))).resolves.toBe(true);
  });
});
