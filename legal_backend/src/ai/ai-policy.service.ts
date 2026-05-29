import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { AI_MODES } from './constants';

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
        reason: 'No free preview credits remaining',
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

  evaluateConsumerCostCap(currentSpendUsd: number): AiCostCapDecision {
    const capUsd = this.getMonthlyConsumerCostCap();
    if (currentSpendUsd >= capUsd) {
      return {
        allowed: false,
        reason: `Monthly consumer AI cost cap reached ($${capUsd})`,
        currentSpendUsd,
        capUsd,
      };
    }

    return { allowed: true, currentSpendUsd, capUsd };
  }

  evaluateTenantCostCap(currentSpendUsd: number): AiCostCapDecision {
    const capUsd = this.getMonthlyTenantCostCap();
    if (currentSpendUsd >= capUsd) {
      return {
        allowed: false,
        reason: `Monthly tenant AI cost cap reached ($${capUsd})`,
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
  ): AiCostCapDecision {
    if (currentSpendUsd + estimatedCostUsd > capUsd) {
      return {
        allowed: false,
        reason: `Estimated request would exceed monthly AI cost cap ($${capUsd})`,
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

  assertOpenAiConfigured(): void {
    const key = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const allowMock = this.configService.get<string>('ALLOW_MOCK_AI', 'false') === 'true';
    if (isProd && !key && !allowMock) {
      throw new ServiceUnavailableException(
        'AI service is not configured. Set OPENAI_API_KEY for production.',
      );
    }
  }

  shouldUseMockResponses(): boolean {
    const key = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    if (key) return false;
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    return !isProd || this.configService.get<string>('ALLOW_MOCK_AI', 'false') === 'true';
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
    const maxTaskCost = Number(
      this.configService.get<string>('AI_DEFAULT_MAX_TASK_COST_USD', '0.25'),
    );

    if (estimatedCostUsd > maxTaskCost) {
      return {
        allowed: false,
        reason: `Estimated task cost ($${estimatedCostUsd.toFixed(4)}) exceeds max per-task budget ($${maxTaskCost})`,
        estimatedCostUsd,
      };
    }

    if (tenantId) {
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
