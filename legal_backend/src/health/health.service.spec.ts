import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const mockResearchReadiness = { snapshot: jest.fn() } as never;

  it('returns minimal public health', () => {
    const service = new HealthService(
      { $queryRaw: jest.fn() } as never,
      { get: jest.fn((_key: string, fallback?: string) => fallback ?? 'Umbrella') } as unknown as ConfigService,
      mockResearchReadiness,
    );

    expect(service.getPublicHealth()).toEqual({ status: 'ok' });
  });

  it('returns build version metadata', () => {
    const get = jest.fn((key: string, fallback?: string) => {
      if (key === 'GIT_COMMIT_SHA') return 'abc123def456';
      if (key === 'GIT_BRANCH') return 'main';
      if (key === 'BUILD_TIME') return '2026-07-06T00:00:00Z';
      if (key === 'CI_WORKFLOW') return 'ci-swarm.yml';
      if (key === 'CI_RUN_ID') return '247';
      if (key === 'DEPLOY_PROBE_MARKER') return 'deploy-probe-247';
      return fallback ?? 'Umbrella';
    });
    const service = new HealthService(
      { $queryRaw: jest.fn() } as never,
      { get } as unknown as ConfigService,
      mockResearchReadiness,
    );

    const version = service.getVersionInfo();
    expect(version.status).toBe('ok');
    expect(version.gitCommitShort).toBe('abc123d');
    expect(version.gitBranch).toBe('main');
    expect(version.probe).toBe('deploy-probe-247');
  });

  it('returns aggregate-only public readiness', async () => {
    const service = new HealthService(
      { $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]) } as never,
      { get: jest.fn((_key: string, fallback?: string) => fallback ?? 'Umbrella') } as unknown as ConfigService,
      mockResearchReadiness,
    );
    jest.spyOn(service, 'getRedisHealth').mockResolvedValue({
      status: 'error',
      latencyMs: 1,
      message: 'Redis unavailable',
    });

    const readiness = await service.getPublicReadiness();

    expect(readiness).toEqual({ status: 'degraded' });
    expect(readiness).not.toHaveProperty('checks');
    expect(readiness).not.toHaveProperty('uptimeSeconds');
  });

  it('returns degraded readiness when a dependency is not ok', async () => {
    const service = new HealthService(
      { $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]) } as never,
      { get: jest.fn((_key: string, fallback?: string) => fallback ?? 'Umbrella') } as unknown as ConfigService,
      mockResearchReadiness,
    );
    jest.spyOn(service, 'getRedisHealth').mockResolvedValue({
      status: 'error',
      latencyMs: 1,
      message: 'Redis unavailable',
    });

    const readiness = await service.getReadiness();

    expect(readiness.status).toBe('degraded');
    expect(readiness.checks.database.status).toBe('ok');
    expect(readiness.checks.redis.status).toBe('error');
    expect(readiness.checks.ai.status).toBe('degraded');
  });

  const FULL_DEPLOYMENT_MAP = {
    'gpt-5.6-luna': 'gpt-56-luna',
    'gpt-5.6-terra': 'gpt-56-terra',
    'gpt-5.6-sol': 'gpt-56-sol',
    'gpt-5.4-mini': 'gpt-54-mini',
    'gpt-5.4-nano': 'gpt-54-nano',
  };

  function azureConfig(deploymentMap: string | undefined) {
    return jest.fn((key: string, fallback?: string) => {
      if (key === 'OPENAI_API_MODE') return 'azure';
      if (key === 'AZURE_OPENAI_ENDPOINT') return 'https://example.openai.azure.com';
      if (key === 'AZURE_OPENAI_API_KEY') return 'azure-key';
      if (key === 'AI_LEGAL_STANDARD_MODEL') return 'gpt-5.6-terra';
      if (key === 'AZURE_OPENAI_DEPLOYMENT_MAP') return deploymentMap;
      return fallback;
    });
  }

  function healthService(get: jest.Mock) {
    return new HealthService(
      { $queryRaw: jest.fn() } as never,
      { get } as unknown as ConfigService,
      mockResearchReadiness,
    );
  }

  it('reports legal model env configuration in AI health', () => {
    const ai = healthService(azureConfig(JSON.stringify(FULL_DEPLOYMENT_MAP))).getAiHealth();
    const standard = ai.legalModels.find((m) => m.envVar === 'AI_LEGAL_STANDARD_MODEL');

    expect(ai.status).toBe('ok');
    expect(standard).toMatchObject({
      modelId: 'gpt-5.6-terra',
      provider: 'openai',
      providerConfigured: true,
      azureDeployment: 'gpt-56-terra',
      deploymentMapped: true,
      fallbackChain: ['deepseek-chat', 'gpt-5.4-mini', 'gpt-4o-mini'],
    });
  });

  it('flags models missing an Azure deployment instead of failing at request time', () => {
    const ai = healthService(
      azureConfig(JSON.stringify({ 'gpt-5.6-terra': 'gpt-56-terra' })),
    ).getAiHealth();

    expect(ai.status).toBe('degraded');
    expect(ai.azure?.unmappedModels).toContain('gpt-5.6-sol');
    expect(ai.message).toContain('AZURE_OPENAI_DEPLOYMENT_MAP');
    expect(
      ai.legalModels.find((m) => m.envVar === 'AI_LEGAL_COMPLEX_MODEL'),
    ).toMatchObject({ deploymentMapped: false, ready: false });
  });

  it('surfaces an unparseable deployment map rather than silently ignoring it', () => {
    const ai = healthService(azureConfig('{not json')).getAiHealth();

    expect(ai.status).toBe('degraded');
    expect(ai.azure?.deploymentMapValid).toBe(false);
    expect(ai.message).toContain('not valid JSON');
  });

  it('does not require a deployment map in direct mode', () => {
    const get = jest.fn((key: string, fallback?: string) => {
      if (key === 'OPENAI_API_MODE') return 'direct';
      if (key === 'OPENAI_API_KEY') return 'sk-test';
      return fallback;
    });

    const ai = healthService(get).getAiHealth();

    expect(ai.status).toBe('ok');
    expect(ai.azure).toBeUndefined();
  });
});
