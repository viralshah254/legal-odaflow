import { Injectable } from '@nestjs/common';
import { ModelRouterService } from '@/ai/model-router/model-router.service';
import { AiPreferencesService } from './ai-preferences.service';
import { PremiumAllowanceService } from './premium-allowance.service';
import { AiModelMode } from '@/ai/premium-models.config';

export interface ResolvedAiModelContext {
  modelMode: AiModelMode;
  premiumModelId: string;
  premiumFallback: boolean;
  route: ReturnType<ModelRouterService['resolveRoute']>;
}

@Injectable()
export class AiModelResolverService {
  constructor(
    private readonly preferences: AiPreferencesService,
    private readonly allowance: PremiumAllowanceService,
    private readonly modelRouter: ModelRouterService,
  ) {}

  async resolveForTask(params: {
    userId: string;
    tenantId?: string;
    taskType: string;
    planCreditsMonthly: number;
    cycleStart: Date;
    overrideMode?: AiModelMode;
    overridePremiumModelId?: string;
  }): Promise<ResolvedAiModelContext> {
    const prefs = await this.preferences.resolveForRequest({
      userId: params.userId,
      tenantId: params.tenantId,
      overrideMode: params.overrideMode,
      overridePremiumModelId: params.overridePremiumModelId,
    });

    let premiumFallback = false;
    if (prefs.aiModelMode === 'PREMIUM') {
      const remaining = await this.allowance.getPremiumAllowanceRemaining({
        userId: params.tenantId ? undefined : params.userId,
        tenantId: params.tenantId,
        planCreditsMonthly: params.planCreditsMonthly,
        cycleStart: params.cycleStart,
      });
      if (remaining <= 0) {
        premiumFallback = true;
      }
    }

    const route = this.modelRouter.resolveRoute(params.taskType, undefined, {
      modelMode: prefs.aiModelMode,
      premiumModelId: prefs.premiumModelId,
      premiumFallback,
    });

    return {
      modelMode: route.modelMode,
      premiumModelId: prefs.premiumModelId,
      premiumFallback: route.premiumFallback,
      route,
    };
  }
}
