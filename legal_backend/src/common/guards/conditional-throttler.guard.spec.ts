import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ConditionalThrottlerGuard } from '@/common/guards/conditional-throttler.guard';

describe('ConditionalThrottlerGuard', () => {
  const reflector = new Reflector();
  const options = [{ ttl: 60_000, limit: 120 }];
  const storageService = {
    increment: jest.fn(),
  };

  const context = {
    getClass: () => ({}),
    getHandler: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ ip: '127.0.0.1' }),
      getResponse: () => ({}),
    }),
  } as ExecutionContext;

  function createGuard(env: Record<string, string>) {
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => env[key] ?? defaultValue),
    };
    return new ConditionalThrottlerGuard(
      options,
      storageService as never,
      reflector,
      configService as unknown as ConfigService,
    );
  }

  beforeEach(() => {
    jest
      .spyOn(
        ThrottlerGuard.prototype as unknown as { shouldSkip: () => Promise<boolean> },
        'shouldSkip',
      )
      .mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips throttling in development when ENABLE_RATE_LIMITING=false', async () => {
    const guard = createGuard({ NODE_ENV: 'development', ENABLE_RATE_LIMITING: 'false' });
    await expect(
      (guard as unknown as { shouldSkip: (ctx: ExecutionContext) => Promise<boolean> }).shouldSkip(
        context,
      ),
    ).resolves.toBe(true);
  });

  it('keeps throttling enabled in production even when ENABLE_RATE_LIMITING=false', async () => {
    const guard = createGuard({ NODE_ENV: 'production', ENABLE_RATE_LIMITING: 'false' });
    await expect(
      (guard as unknown as { shouldSkip: (ctx: ExecutionContext) => Promise<boolean> }).shouldSkip(
        context,
      ),
    ).resolves.toBe(false);
  });
});
