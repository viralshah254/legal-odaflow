import { NotFoundException } from '@nestjs/common';
import {
  FeatureFlagsService,
  RESEARCH_FEATURE_FLAGS,
} from './feature-flags.service';

describe('FeatureFlagsService research rollout', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const flagEnvKeys = Object.values(RESEARCH_FEATURE_FLAGS).map(
    (key) => `FEATURE_${key}`,
  );
  const originalFlagEnv = Object.fromEntries(
    flagEnvKeys.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    for (const key of flagEnvKeys) {
      const original = originalFlagEnv[key];
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    }
  });

  it('keeps Kenya Verified opt-in while allowing role-gated review in production', () => {
    process.env.NODE_ENV = 'production';
    const service = new FeatureFlagsService();

    expect(
      service.isEnabled(RESEARCH_FEATURE_FLAGS.MANUAL_CITATION_REVIEW, {
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    ).toBe(true);
    expect(
      service.isEnabled(RESEARCH_FEATURE_FLAGS.KENYA_VERIFIED, {
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    ).toBe(false);
  });

  it('enables early rollout stages in test but keeps filing opt-in', () => {
    process.env.NODE_ENV = 'test';
    const service = new FeatureFlagsService();

    expect(
      service.isEnabled(RESEARCH_FEATURE_FLAGS.WORKSPACE_FOLLOW_ON, {
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    ).toBe(true);
    expect(
      service.isEnabled(RESEARCH_FEATURE_FLAGS.MANUAL_CITATION_REVIEW, {
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    ).toBe(true);
    expect(
      service.isEnabled(RESEARCH_FEATURE_FLAGS.MATTER_FILING, {
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    ).toBe(false);
  });

  it('enables workspace follow-on in production and keeps filing opt-in unless overridden', () => {
    process.env.NODE_ENV = 'production';
    const service = new FeatureFlagsService();

    expect(
      service.isEnabled(RESEARCH_FEATURE_FLAGS.WORKSPACE_FOLLOW_ON, {
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    ).toBe(true);

    expect(() =>
      service.assertEnabled(RESEARCH_FEATURE_FLAGS.MATTER_FILING, {
        tenantId: 'tenant-1',
        userId: 'user-1',
      }),
    ).toThrow(NotFoundException);
    try {
      service.assertEnabled(RESEARCH_FEATURE_FLAGS.MATTER_FILING, {
        tenantId: 'tenant-1',
        userId: 'user-1',
      });
    } catch (error) {
      expect(error).toMatchObject({
        response: {
          code: 'FEATURE_UNAVAILABLE',
          feature: 'RESEARCH_MATTER_FILING',
          fallback: 'legacy_research',
        },
        status: 404,
      });
    }
  });
});
