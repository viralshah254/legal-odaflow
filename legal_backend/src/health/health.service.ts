import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AI_LEGAL_MODEL_ENV_VARS } from '@/ai/legal-model-env.config';
import { buildLlmFallbackChain } from '@/ai/llm-fallback.config';
import { resolveModelProvider } from '@/ai/model-costs.config';
import {
  getOpenAiApiMode,
  isDeepSeekConfigured,
  isOpenAiConfigured,
  parseAzureDeploymentMap,
  resolveAzureDeployment,
} from '@/ai/openai-transport';
import { PrismaService } from '@/prisma/prisma.service';
import { getDeploymentInfo } from '@/common/deployment-info';
import {
  ResearchReadinessService,
  type ResearchReadinessReport,
} from '@/legal-sources/research-readiness.service';

@Injectable()
export class HealthService {
  private redisClient: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly researchReadiness: ResearchReadinessService,
  ) {}

  getPublicHealth() {
    return { status: 'ok' as const };
  }

  getVersionInfo() {
    const deployment = getDeploymentInfo(this.configService);
    return {
      status: 'ok' as const,
      gitCommit: deployment.gitCommit,
      gitCommitShort: deployment.gitCommitShort,
      gitBranch: deployment.gitBranch,
      builtAt: deployment.builtAt,
      probe: deployment.probe,
      image: deployment.image,
    };
  }

  getAppHealth() {
    return {
      status: 'ok',
      service: this.configService.get<string>('APP_NAME', 'Umbrella'),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  async getDatabaseHealth() {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: 'error',
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Database check failed',
      };
    }
  }

  async getPublicReadiness() {
    const readiness = await this.getReadiness();
    return { status: readiness.status };
  }

  async getReadiness() {
    const [database, redis, ai] = await Promise.all([
      this.getDatabaseHealth(),
      this.getRedisHealth(),
      Promise.resolve(this.getAiHealth()),
    ]);
    const checks = { database, redis, ai };
    const status = Object.values(checks).every((check) => check.status === 'ok')
      ? 'ok'
      : 'degraded';

    return {
      status,
      service: this.configService.get<string>('APP_NAME', 'Umbrella'),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      checks,
    };
  }

  async getRedisHealth() {
    const startedAt = Date.now();
    const redisUrl = this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );

    try {
      if (!this.redisClient) {
        this.redisClient = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
        });
      }

      if (this.redisClient.status !== 'ready') {
        await this.redisClient.connect();
      }

      const pong = await this.redisClient.ping();

      return {
        status: pong === 'PONG' ? 'ok' : 'degraded',
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        status: 'error',
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Redis check failed',
      };
    }
  }

  async getResearchReadiness(countryCode = 'IN'): Promise<ResearchReadinessReport & { status: 'ok' | 'degraded' }> {
    const snapshot = await this.researchReadiness.snapshot(countryCode);
    return {
      ...snapshot,
      status: snapshot.researchReady ? 'ok' : 'degraded',
    };
  }

  getAiHealth() {
    const openAiMode = getOpenAiApiMode(this.configService);
    const openAiConfigured = isOpenAiConfigured(this.configService);
    const deepSeekConfigured = isDeepSeekConfigured(this.configService);
    const allowedProviders = this.configService
      .get<string>('AI_ALLOWED_PROVIDERS', 'openai,deepseek,google')
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);

    const providers = {
      openai: {
        configured: openAiConfigured,
        enabled: allowedProviders.includes('openai'),
        mode: openAiMode,
      },
      deepseek: {
        configured: deepSeekConfigured,
        enabled: allowedProviders.includes('deepseek'),
        mode: 'direct' as const,
      },
      google: {
        configured:
          Boolean(this.configService.get<string>('GOOGLE_AI_API_KEY')?.trim()) ||
          (Boolean(this.configService.get<string>('GOOGLE_CLOUD_PROJECT')?.trim()) &&
            Boolean(
              this.configService.get<string>('VERTEX_LOCATION')?.trim() ||
                this.configService.get<string>('GOOGLE_CLOUD_LOCATION')?.trim(),
            )),
        enabled: allowedProviders.includes('google'),
        mode: this.configService.get<string>('GOOGLE_AI_API_KEY')?.trim()
          ? ('api_key' as const)
          : ('vertex_adc' as const),
      },
    };

    const legalModels = this.getLegalModelHealth(openAiMode, providers);
    const anyConfigured =
      (providers.openai.enabled && providers.openai.configured) ||
      (providers.deepseek.enabled && providers.deepseek.configured) ||
      (providers.google.enabled && providers.google.configured);
    const legalModelsReady = legalModels.every((entry) => entry.ready);
    const deploymentMap = parseAzureDeploymentMap(this.configService);
    const azure =
      openAiMode === 'azure'
        ? {
            endpointSet: Boolean(
              (this.configService.get<string>('AZURE_OPENAI_ENDPOINT', '') ?? '').trim(),
            ),
            apiKeySet: Boolean(
              (this.configService.get<string>('AZURE_OPENAI_API_KEY', '') ?? '').trim(),
            ),
            apiVersion: this.configService.get<string>('AZURE_OPENAI_API_VERSION', '2024-10-21'),
            deploymentMapPresent: deploymentMap.present,
            deploymentMapValid: !deploymentMap.parseError,
            deploymentMapError: deploymentMap.parseError,
            mappedModels: Object.keys(deploymentMap.map),
            unmappedModels: legalModels
              .filter((entry) => !entry.deploymentMapped)
              .map((entry) => entry.modelId),
          }
        : undefined;

    const openAiHint =
      openAiMode === 'azure'
        ? 'AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY (GPT only)'
        : 'OPENAI_API_KEY';

    return {
      status: anyConfigured && legalModelsReady ? 'ok' : 'degraded',
      providers,
      allowedProviders,
      configured: anyConfigured,
      legalModels,
      azure,
      message: anyConfigured
        ? legalModelsReady
          ? `AI providers configured (OpenAI mode=${openAiMode}; DeepSeek uses native API)`
          : deploymentMap.parseError
            ? `AZURE_OPENAI_DEPLOYMENT_MAP is not valid JSON (${deploymentMap.parseError}) — every model will request its own id as an Azure deployment and 404`
            : azure && azure.unmappedModels.length > 0
              ? `Azure deployments missing for: ${azure.unmappedModels.join(', ')} — add them to AZURE_OPENAI_DEPLOYMENT_MAP`
              : `AI providers present but one or more AI_LEGAL_* models are not configured — check /health/ai legalModels`
        : `Set ${openAiHint} and/or DEEPSEEK_API_KEY — Google AI is not supported`,
      timestamp: new Date().toISOString(),
    };
  }

  private getLegalModelHealth(
    openAiMode: ReturnType<typeof getOpenAiApiMode>,
    providers: {
      openai: { configured: boolean; enabled: boolean };
      deepseek: { configured: boolean; enabled: boolean };
      google: { configured: boolean; enabled: boolean };
    },
  ) {
    const deploymentMap = parseAzureDeploymentMap(this.configService);
    const deploymentMapKeys = Object.keys(deploymentMap.map);

    return AI_LEGAL_MODEL_ENV_VARS.map((entry) => {
      const modelId = this.configService.get<string>(entry.envVar, entry.defaultModel);
      const provider = resolveModelProvider(modelId);
      const providerEntry = providers[provider];
      const providerConfigured = providerEntry?.configured ?? false;
      const providerEnabled = providerEntry?.enabled ?? false;
      const azureDeployment =
        openAiMode === 'azure' && provider === 'openai'
          ? resolveAzureDeployment(this.configService, modelId)
          : undefined;
      // On Azure a model that is not in the deployment map falls through to its
      // own id as the deployment name, which usually 404s at request time. Treat
      // that as not ready so it shows up here rather than as a live failure.
      const deploymentMapped =
        openAiMode !== 'azure' ||
        provider !== 'openai' ||
        (!deploymentMap.parseError &&
          (deploymentMapKeys.length === 0 || deploymentMapKeys.includes(modelId)));

      return {
        envVar: entry.envVar,
        role: entry.role,
        modelId,
        provider,
        providerConfigured,
        providerEnabled,
        ready: providerEnabled && providerConfigured && deploymentMapped,
        azureDeployment,
        deploymentMapped,
        fallbackChain: buildLlmFallbackChain(modelId),
      };
    });
  }
}
