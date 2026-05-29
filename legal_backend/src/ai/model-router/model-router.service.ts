import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getCreditCost, requiresCreditConfirmation } from '@/ai-credits/credit-costs';
import {
  AiModelMode,
  getAutoModelName,
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
  requiresConfirmation: boolean;
  routingEnabled: boolean;
  modelMode: AiModelMode;
  premiumFallback: boolean;
  baseCredits: number;
}

@Injectable()
export class ModelRouterService {
  constructor(private readonly configService: ConfigService) {}

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
        options?.premiumModelId ?? 'gpt-4.1',
        envModels,
      );
      modelName = premiumModel?.modelId ?? this.resolveModelName(route);
      tier = 'premium';
    } else {
      modelName = getAutoModelName(this.configService);
      tier = 'cheap';
    }

    const estimatedCredits = this.computeCredits(
      baseCredits,
      effectiveMode,
      options?.premiumModelId,
    );

    return {
      taskType,
      tier,
      modelName,
      provider: this.configService.get<string>('AI_PROVIDER', 'openai'),
      maxInputTokens: route.maxInputTokens,
      maxOutputTokens: route.maxOutputTokens,
      requiresRag: route.requiresRag,
      requiresCitationVerification: route.requiresCitationVerification,
      requiresMatterContext: route.requiresMatterContext ?? false,
      estimatedCredits,
      requiresConfirmation: requiresCreditConfirmation(taskType),
      routingEnabled,
      modelMode: effectiveMode,
      premiumFallback: requestedMode === 'PREMIUM' && premiumFallback,
      baseCredits,
    };
  }

  computeCredits(
    baseCredits: number,
    modelMode: AiModelMode,
    premiumModelId?: string,
  ): number {
    if (modelMode !== 'PREMIUM') {
      return baseCredits;
    }
    const envModels = this.configService.get<string>('AI_PREMIUM_MODELS');
    const premiumModel = getPremiumModel(premiumModelId ?? 'gpt-4.1', envModels);
    const multiplier = premiumModel?.creditMultiplier ?? 3;
    return Math.max(baseCredits, Math.ceil(baseCredits * multiplier));
  }

  resolveModelName(route: ModelRouteConfig): string {
    const cheap = this.configService.get<string>('AI_CHEAP_MODEL', '');
    const mid = this.configService.get<string>('AI_MID_MODEL', '');
    const fast = this.configService.get<string>('AI_FAST_MODEL', 'gpt-4.1-mini');
    const reasoning = this.configService.get<string>(
      'AI_REASONING_MODEL',
      'gpt-4.1',
    );
    const local = this.configService.get<string>('AI_LOCAL_CLASSIFIER_MODEL', '');

    const envKey = route.defaultModelEnv;
    const envValue = this.configService.get<string>(envKey, '');

    if (envValue) {
      return envValue;
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
