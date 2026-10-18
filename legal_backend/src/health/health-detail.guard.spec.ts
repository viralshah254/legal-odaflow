import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { HealthDetailGuard } from './health-detail.guard';

function contextForRequest(
  headers: Record<string, string> = {},
  user?: { userType: string },
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers, user }),
    }),
  } as ExecutionContext;
}

describe('HealthDetailGuard', () => {
  const configService = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows super admin users', () => {
    configService.get.mockReturnValue('');
    const guard = new HealthDetailGuard(configService as unknown as ConfigService);

    expect(
      guard.canActivate(
        contextForRequest({}, { userType: 'SUPER_ADMIN' }),
      ),
    ).toBe(true);
  });

  it('allows requests with a valid health detail bearer token', () => {
    configService.get.mockReturnValue('probe-secret');
    const guard = new HealthDetailGuard(configService as unknown as ConfigService);

    expect(
      guard.canActivate(
        contextForRequest({ authorization: 'Bearer probe-secret' }),
      ),
    ).toBe(true);
  });

  it('rejects requests without token when HEALTH_DETAIL_TOKEN is unset', () => {
    configService.get.mockReturnValue('');
    const guard = new HealthDetailGuard(configService as unknown as ConfigService);

    expect(() =>
      guard.canActivate(contextForRequest()),
    ).toThrow(ForbiddenException);
  });

  it('rejects requests with an invalid bearer token', () => {
    configService.get.mockReturnValue('probe-secret');
    const guard = new HealthDetailGuard(configService as unknown as ConfigService);

    expect(() =>
      guard.canActivate(
        contextForRequest({ authorization: 'Bearer wrong-token' }),
      ),
    ).toThrow(ForbiddenException);
  });
});
