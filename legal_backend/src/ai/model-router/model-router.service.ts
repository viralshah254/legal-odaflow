import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getCreditCost, requiresCreditConfirmation } from '@/ai-credits/credit-costs';
import { CreditPricingService } from '@/ai-credits/credit-pricing.service';
import { TokenCreditChargeService } from '@/ai-credits/token-credit-charge.service';
import { resolveModelProvider } from '@/ai/model-costs.config';
import {
  AiModelMode,
  DEFAULT_PREMIUM_MODEL_ID,
  getPremiumModel,
} from '@/ai/premium-models.config';
import {
  DEFAULT_MODEL_ROUTE,
  MODEL_ROUTES,
  type ModelRouteConfig,
  type ModelTier,
} from './model-route.config';

export interface ModelRouteOptions {
  modelMode?: AiModelMode;
  premiumModelId?: string;
  premiumFallback?: boolean;
}

export interface ResolvedModelRoute {
  taskType: string;
  tier: ModelTier;
  modelName: string;
  provider: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  requiresRag: boolean;
  requiresCitationVerification: boolean;
  requiresMatterContext: boolean;
  estimatedCredits: number;
  estimatedProviderCostUsd?: number;
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
  requiresConfirmation: boolean;
  routingEnabled: boolean;
  modelMode: AiModelMode;
  premiumFallback: boolean;
  baseCredits: number;
}

@Injectable()
export class ModelRouterService {
  constructor(
    private readonly configService: ConfigService,
    private readonly creditPricing: CreditPricingService,
    private readonly tokenCreditCharge: TokenCreditChargeService,
  ) {}

  isRoutingEnabled(): boolean {
    const flag = this.configService.get<string>('AI_ENABLE_MODEL_ROUTING', 'true');
    return flag !== 'false' && flag !== '0';
  }

  resolveRoute(
    taskType: string,
    _userSegment?: string,
    options?: ModelRouteOptions,
  ): ResolvedModelRoute {
    const route = MODEL_ROUTES[taskType] ?? DEFAULT_MODEL_ROUTE;
    const routingEnabled = this.isRoutingEnabled();
    const baseCredits = getCreditCost(taskType);
    const requestedMode = options?.modelMode ?? 'AUTO';
    const premiumFallback = options?.premiumFallback ?? false;
    const effectiveMode: AiModelMode =
      requestedMode === 'PREMIUM' && premiumFallback ? 'AUTO' : requestedMode;

    let modelName: string;
    let tier: ModelTier;

    if (effectiveMode === 'PREMIUM') {
      const envModels = this.configService.get<string>('AI_PREMIUM_MODELS');
      const premiumModel = getPremiumModel(
        options?.premiumModelId ?? DEFAULT_PREMIUM_MODEL_ID,
        envModels,
        {
          creditUsdValue: this.creditPricing.getCreditUsdValue(),
          netMarginPercent: this.creditPricing.getNetMarginPercent(),
        },
      );
      modelName = premiumModel?.modelId ?? this.resolveModelName(route);
      tier = 'premium';
    } else {
      // AUTO: use each task type's configured tier (e.g. LEGAL_RESEARCH → reasoning model).
      modelName = this.resolveModelName(route);
      tier = route.tier;
    }

    const typicalInput = Math.min(
      route.maxInputTokens,
      Math.max(500, Math.round(route.maxInputTokens * 0.12)),
    );
    const typicalOutput = Math.min(
      route.maxOutputTokens,
      Math.max(200, Math.round(route.maxOutputTokens * 0.2)),
    );

    const tokenEstimate = this.tokenCreditCharge.estimateCreditsForModel({
      modelName,
      inputTokens: typicalInput,
      outputTokens: typicalOutput,
      minCredits: baseCredits,
    });

    const estimatedCredits = this.tokenCreditCharge.isTokenBased()
      ? tokenEstimate.credits
      : baseCredits;

    return {
      taskType,
      tier,
      modelName,
      provider: resolveModelProvider(modelName),
      maxInputTokens: route.maxInputTokens,
      maxOutputTokens: route.maxOutputTokens,
      requiresRag: route.requiresRag,
      requiresCitationVerification: route.requiresCitationVerification,
      requiresMatterContext: route.requiresMatterContext ?? false,
      estimatedCredits,
      estimatedProviderCostUsd: tokenEstimate.providerCostUsd,
      estimatedInputTokens: tokenEstimate.inputTokens,
      estimatedOutputTokens: tokenEstimate.outputTokens,
      requiresConfirmation: requiresCreditConfirmation(taskType),
      routingEnabled,
      modelMode: effectiveMode,
      premiumFallback: requestedMode === 'PREMIUM' && premiumFallback,
      baseCredits,
    };
  }

  resolveModelName(route: ModelRouteConfig): string {
    const cheap = this.configService.get<string>('AI_CHEAP_MODEL', '');
    const mid = this.configService.get<string>('AI_MID_MODEL', '');
    const fast = this.configService.get<string>('AI_FAST_MODEL', 'gpt-5.4-mini');
    const reasoning = this.configService.get<string>(
      'AI_REASONING_MODEL',
      'gpt-5.5',
    );
    const local = this.configService.get<string>('AI_LOCAL_CLASSIFIER_MODEL', '');

    const envKey = route.defaultModelEnv;
    const envValue = this.configService.get<string>(envKey, '');

    if (envValue) {
      return envValue;
    }

    if (route.fallbackModelEnv) {
      const fallbackValue = this.configService.get<string>(route.fallbackModelEnv, '');
      if (fallbackValue) {
        return fallbackValue;
      }
    }

    switch (route.tier) {
      case 'premium':
        return reasoning;
      case 'mid':
        return mid || reasoning;
      case 'local_or_cheap':
        return local || cheap || fast;
      case 'cheap':
      default:
        return cheap || fast;
    }
  }
}
