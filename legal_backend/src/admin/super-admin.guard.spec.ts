import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';

function contextForUser(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe('SuperAdminGuard', () => {
  const guard = new SuperAdminGuard();

  it('allows true platform super admins', () => {
    expect(
      guard.canActivate(contextForUser({ userType: 'SUPER_ADMIN' })),
    ).toBe(true);
  });

  it('blocks firm admins from platform admin routes', () => {
    expect(() =>
      guard.canActivate(contextForUser({ userType: 'LAWYER', tenantRole: 'FIRM_ADMIN' })),
    ).toThrow(ForbiddenException);
  });
});
