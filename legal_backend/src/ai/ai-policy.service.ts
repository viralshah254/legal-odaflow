import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { AI_MODES } from './constants';
import {
  getOpenAiApiMode,
  isDeepSeekConfigured,
  isOpenAiConfigured,
  openAiNotConfiguredMessage,
} from './openai-transport';

export interface AiPolicyDecision {
  allowed: boolean;
  reason?: string;
  mode: string;
  requireCitations: boolean;
  requireDisclaimer: boolean;
}

export interface AiCostCapDecision {
  allowed: boolean;
  reason?: string;
  currentSpendUsd: number;
  capUsd: number;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  estimatedCostUsd?: number;
}

@Injectable()
export class AiPolicyService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  evaluateConsumerPreview(userCreditsRemaining: number): AiPolicyDecision {
    if (userCreditsRemaining <= 0) {
      return {
        allowed: false,
        reason:
          "You've used all your free daily AI credits. Subscribe to get unlimited access, or wait until tomorrow for your daily credits to reset.",
        mode: AI_MODES.CONSUMER_FREE_PREVIEW,
        requireCitations: true,
        requireDisclaimer: true,
      };
    }

    return {
      allowed: true,
      mode: AI_MODES.CONSUMER_FREE_PREVIEW,
      requireCitations:
        this.configService.get<string>('AI_REQUIRE_CITATIONS', 'true') === 'true',
      requireDisclaimer:
        this.configService.get<string>('AI_CONSUMER_DISCLAIMER_REQUIRED', 'true') ===
        'true',
    };
  }

  evaluateConsumerCostCap(
    currentSpendUsd: number,
    hardStopEnabled = false,
  ): AiCostCapDecision {
    const capUsd = this.getMonthlyConsumerCostCap();
    if (currentSpendUsd >= capUsd) {
      if (!hardStopEnabled) {
        // Soft limit: warn but allow through
        return { allowed: true, currentSpendUsd, capUsd };
      }
      return {
        allowed: false,
        reason: `Monthly AI spend limit reached ($${capUsd}). Adjust your limit in Settings → AI Usage.`,
        currentSpendUsd,
        capUsd,
      };
    }

    return { allowed: true, currentSpendUsd, capUsd };
  }

  evaluateTenantCostCap(
    currentSpendUsd: number,
    hardStopEnabled = false,
  ): AiCostCapDecision {
    const capUsd = this.getMonthlyTenantCostCap();
    if (currentSpendUsd >= capUsd) {
      if (!hardStopEnabled) {
        return { allowed: true, currentSpendUsd, capUsd };
      }
      return {
        allowed: false,
        reason: `Monthly AI spend limit reached ($${capUsd}). Adjust your limit in Settings → AI Usage.`,
        currentSpendUsd,
        capUsd,
      };
    }

    return { allowed: true, currentSpendUsd, capUsd };
  }

  evaluateEstimatedCostCap(
    currentSpendUsd: number,
    estimatedCostUsd: number,
    capUsd: number,
    hardStopEnabled = false,
  ): AiCostCapDecision {
    if (currentSpendUsd + estimatedCostUsd > capUsd) {
      if (!hardStopEnabled) {
        return { allowed: true, currentSpendUsd, capUsd };
      }
      return {
        allowed: false,
        reason: `Estimated request would exceed monthly AI spend limit ($${capUsd}). Adjust your limit in Settings → AI Usage.`,
        currentSpendUsd,
        capUsd,
      };
    }

    return { allowed: true, currentSpendUsd, capUsd };
  }

  getMonthlyConsumerCostCap(): number {
    return Number(
      this.configService.get<string>('AI_MAX_MONTHLY_CONSUMER_COST_USD', '25'),
    );
  }

  getMonthlyTenantCostCap(): number {
    return Number(
      this.configService.get<string>('AI_MAX_MONTHLY_TENANT_COST_USD', '500'),
    );
  }

  isTrainingOptInDefault(): boolean {
    return this.configService.get<string>('TRAINING_OPT_IN_DEFAULT', 'false') === 'true';
  }

  assertAiConfigured(): void {
    const openAiReady = isOpenAiConfigured(this.configService);
    const deepSeekReady = isDeepSeekConfigured(this.configService);
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const allowMock = this.configService.get<string>('ALLOW_MOCK_AI', 'false') === 'true';
    if (isProd && !openAiReady && !deepSeekReady && !allowMock) {
      const hint =
        getOpenAiApiMode(this.configService) === 'azure'
          ? openAiNotConfiguredMessage(this.configService)
          : 'Set OPENAI_API_KEY and/or DEEPSEEK_API_KEY for production.';
      throw new ServiceUnavailableException(
        `AI service is not configured. ${hint}`,
      );
    }
  }

  /** @deprecated Use assertAiConfigured */
  assertOpenAiConfigured(): void {
    this.assertAiConfigured();
  }

  shouldUseMockResponses(): boolean {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    if (isProd) {
      return false;
    }
    if (isOpenAiConfigured(this.configService)) return false;
    if (isDeepSeekConfigured(this.configService)) return false;
    return this.configService.get<string>('ALLOW_MOCK_AI', 'false') === 'true';
  }

  async getTenantAiPolicy(tenantId: string) {
    const profile = await this.prisma.firmProfile.findUnique({ where: { tenantId } });
    const settings =
      profile?.settings && typeof profile.settings === 'object' && !Array.isArray(profile.settings)
        ? (profile.settings as Record<string, unknown>)
        : {};
    const governance =
      settings.governance && typeof settings.governance === 'object'
        ? (settings.governance as Record<string, unknown>)
        : {};
    const aiPolicy =
      governance.aiPolicy && typeof governance.aiPolicy === 'object'
        ? (governance.aiPolicy as Record<string, boolean>)
        : {};
    return {
      disclaimerRequired: aiPolicy.disclaimerRequired ?? true,
      citationGuardrails: aiPolicy.citationGuardrails ?? true,
      trainingOptOut: aiPolicy.trainingOptOut ?? true,
      requireLawyerApproval: aiPolicy.requireLawyerApproval ?? true,
    };
  }

  async assertProviderTrainingAllowed(tenantId: string, userId: string): Promise<void> {
    const firmProfile = await this.prisma.firmProfile.findUnique({
      where: { tenantId },
    });
    const settings =
      firmProfile?.settings &&
      typeof firmProfile.settings === 'object' &&
      !Array.isArray(firmProfile.settings)
        ? (firmProfile.settings as Record<string, unknown>)
        : {};

    if (settings.aiTrainingOptOut === true) {
      throw new ForbiddenException('Tenant has opted out of AI provider training');
    }

    const consent = await this.prisma.trainingConsent.findFirst({
      where: {
        consentStatus: 'GRANTED',
        OR: [
          { tenantId, userId },
          { tenantId, userId: null },
          { userId, tenantId: null },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (consent) {
      return;
    }

    if (!this.isTrainingOptInDefault()) {
      throw new ForbiddenException(
        'Explicit training consent required before provider training use',
      );
    }
  }

  async checkBudgetBeforeTask(
    tenantId: string | undefined,
    userId: string,
    estimatedCostUsd: number,
  ): Promise<BudgetCheckResult> {
    const chargeMode = this.configService.get<string>('AI_CHARGE_MODE', 'token_based');

    // Credit / token billing: wallet + margin are the product gates. Do not hard-block
    // Premium Verified research on a tiny USD per-task floor (users pay in credits).
    // Flat / non-credit modes keep the env USD safety cap.
    if (chargeMode === 'flat') {
      const maxTaskCost = Number(
        this.configService.get<string>('AI_DEFAULT_MAX_TASK_COST_USD', '2'),
      );
      if (Number.isFinite(maxTaskCost) && estimatedCostUsd > maxTaskCost) {
        return {
          allowed: false,
          reason: `Estimated task cost ($${estimatedCostUsd.toFixed(4)}) exceeds max per-task budget ($${maxTaskCost})`,
          estimatedCostUsd,
        };
      }
    }

    // Tenant USD per-task caps only apply in flat mode. Credit mode already
    // reserves/charges the wallet; MRR-derived $0.25 task caps must not block Premium.
    if (chargeMode === 'flat' && tenantId) {
      const policy = await this.prisma.aIBudgetPolicy.findFirst({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
      });

      if (policy?.maxCostPerTaskUsd && estimatedCostUsd > Number(policy.maxCostPerTaskUsd)) {
        return {
          allowed: false,
          reason: 'Estimated task cost exceeds tenant budget policy',
          estimatedCostUsd,
        };
      }
    }

    return { allowed: true, estimatedCostUsd };
  }
}
