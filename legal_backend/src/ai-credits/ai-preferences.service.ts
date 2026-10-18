import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import {
  AiModelMode,
  DEFAULT_PREMIUM_MODEL_ID,
  getAutoModelName,
  getPremiumModel,
  listPremiumModels,
} from '@/ai/premium-models.config';
import { normalizeModelId } from '@/ai/model-costs.config';
import { CreditPricingService } from './credit-pricing.service';

export interface AiPreferencesView {
  aiModelMode: AiModelMode;
  premiumModelId: string;
  deepAnalysisPremiumModelId: string;
  autoTopUpEnabled: boolean;
  autoTopUpThresholdCredits: number;
  autoTopUpPackId: string;
  hasPaymentMethod: boolean;
  availablePremiumModels: ReturnType<typeof listPremiumModels>;
  autoModelName: string;
}

export interface UpdateAiPreferencesInput {
  aiModelMode?: AiModelMode;
  premiumModelId?: string;
  deepAnalysisPremiumModelId?: string;
  autoTopUpEnabled?: boolean;
  autoTopUpThresholdCredits?: number;
  autoTopUpPackId?: string;
}

@Injectable()
export class AiPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly creditPricing: CreditPricingService,
  ) {}

  async getForConsumer(userId: string): Promise<AiPreferencesView> {
    const profile = await this.prisma.consumerProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Consumer profile not found');
    }
    const prefs = await this.prisma.userPreferences.findUnique({ where: { userId } });
    return this.buildView({
      aiModelMode: (prefs?.aiModelMode ?? profile.aiModelMode) as AiModelMode,
      premiumModelId: prefs?.premiumModelId ?? profile.premiumModelId,
      autoTopUpEnabled: profile.autoTopUpEnabled,
      autoTopUpThresholdCredits: profile.autoTopUpThresholdCredits,
      autoTopUpPackId: profile.autoTopUpPackId,
      hasPaymentMethod: Boolean(profile.stripePaymentMethodId),
    });
  }

  async getForTenant(tenantId: string): Promise<AiPreferencesView> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const tenantExtra = await this.prisma.$queryRaw<Array<{ deepAnalysisPremiumModelId: string }>>`
      SELECT "deepAnalysisPremiumModelId" FROM "Tenant" WHERE "id" = ${tenantId} LIMIT 1
    `.catch(() => [] as Array<{ deepAnalysisPremiumModelId: string }>);
    return this.buildView({
      aiModelMode: tenant.aiModelMode as AiModelMode,
      premiumModelId: tenant.premiumModelId,
      deepAnalysisPremiumModelId: tenantExtra[0]?.deepAnalysisPremiumModelId ?? tenant.premiumModelId,
      autoTopUpEnabled: tenant.autoTopUpEnabled,
      autoTopUpThresholdCredits: tenant.autoTopUpThresholdCredits,
      autoTopUpPackId: tenant.autoTopUpPackId,
      hasPaymentMethod: Boolean(tenant.stripePaymentMethodId),
    });
  }

  async updateForConsumer(userId: string, input: UpdateAiPreferencesInput) {
    this.validatePremiumModel(input.premiumModelId);
    await this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        aiModelMode: input.aiModelMode ?? 'AUTO',
        premiumModelId: input.premiumModelId ?? DEFAULT_PREMIUM_MODEL_ID,
        autoTopUpEnabled: input.autoTopUpEnabled ?? false,
        autoTopUpThresholdCredits: input.autoTopUpThresholdCredits ?? 10,
        autoTopUpPackId: input.autoTopUpPackId ?? 'pack_25',
      },
      update: {
        aiModelMode: input.aiModelMode,
        premiumModelId: input.premiumModelId,
        autoTopUpEnabled: input.autoTopUpEnabled,
        autoTopUpThresholdCredits: input.autoTopUpThresholdCredits,
        autoTopUpPackId: input.autoTopUpPackId,
      },
    });
    await this.prisma.consumerProfile.updateMany({
      where: { userId },
      data: {
        aiModelMode: input.aiModelMode,
        premiumModelId: input.premiumModelId,
        autoTopUpEnabled: input.autoTopUpEnabled,
        autoTopUpThresholdCredits: input.autoTopUpThresholdCredits,
        autoTopUpPackId: input.autoTopUpPackId,
      },
    });
    return this.getForConsumer(userId);
  }

  async updateForTenant(tenantId: string, input: UpdateAiPreferencesInput) {
    this.validatePremiumModel(input.premiumModelId);
    this.validatePremiumModel(input.deepAnalysisPremiumModelId);
    const updateData: Record<string, unknown> = {};
    if (input.aiModelMode !== undefined) updateData.aiModelMode = input.aiModelMode;
    if (input.premiumModelId !== undefined) updateData.premiumModelId = input.premiumModelId;
    if (input.autoTopUpEnabled !== undefined) updateData.autoTopUpEnabled = input.autoTopUpEnabled;
    if (input.autoTopUpThresholdCredits !== undefined) updateData.autoTopUpThresholdCredits = input.autoTopUpThresholdCredits;
    if (input.autoTopUpPackId !== undefined) updateData.autoTopUpPackId = input.autoTopUpPackId;
    if (Object.keys(updateData).length > 0) {
      await this.prisma.tenant.update({ where: { id: tenantId }, data: updateData as any });
    }
    if (input.deepAnalysisPremiumModelId !== undefined) {
      await this.prisma.$executeRaw`
        UPDATE "Tenant" SET "deepAnalysisPremiumModelId" = ${input.deepAnalysisPremiumModelId}
        WHERE "id" = ${tenantId}
      `;
    }
    return this.getForTenant(tenantId);
  }

  async resolveForRequest(params: {
    userId: string;
    tenantId?: string;
    overrideMode?: AiModelMode;
    overridePremiumModelId?: string;
    forDeepAnalysis?: boolean;
  }): Promise<{
    aiModelMode: AiModelMode;
    premiumModelId: string;
    autoModelName: string;
    premiumFallback: boolean;
  }> {
    let aiModelMode: AiModelMode = 'AUTO';
    let premiumModelId = DEFAULT_PREMIUM_MODEL_ID;
    let deepAnalysisPremiumModelId = DEFAULT_PREMIUM_MODEL_ID;

    if (params.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: params.tenantId },
        select: { aiModelMode: true, premiumModelId: true },
      });
      const tenantExtra = await this.prisma.$queryRaw<Array<{ deepAnalysisPremiumModelId: string }>>`
        SELECT "deepAnalysisPremiumModelId" FROM "Tenant" WHERE "id" = ${params.tenantId} LIMIT 1
      `.catch(() => [] as Array<{ deepAnalysisPremiumModelId: string }>);
      if (tenant) {
        aiModelMode = (tenant as any).aiModelMode as AiModelMode;
        premiumModelId = (tenant as any).premiumModelId;
        deepAnalysisPremiumModelId = tenantExtra[0]?.deepAnalysisPremiumModelId ?? (tenant as any).premiumModelId;
      }
    } else {
      const profile = await this.prisma.consumerProfile.findUnique({
        where: { userId: params.userId },
      });
      const prefs = await this.prisma.userPreferences.findUnique({
        where: { userId: params.userId },
      });
      aiModelMode = (prefs?.aiModelMode ?? profile?.aiModelMode ?? 'AUTO') as AiModelMode;
      premiumModelId = prefs?.premiumModelId ?? profile?.premiumModelId ?? DEFAULT_PREMIUM_MODEL_ID;
      deepAnalysisPremiumModelId = premiumModelId;
    }

    if (params.overrideMode) {
      aiModelMode = params.overrideMode;
    }
    if (params.overridePremiumModelId) {
      premiumModelId = params.overridePremiumModelId;
      deepAnalysisPremiumModelId = params.overridePremiumModelId;
    }

    // Deep analysis always uses PREMIUM mode with the dedicated model
    const resolvedMode = params.forDeepAnalysis ? 'PREMIUM' : aiModelMode;
    const envModels = this.configService.get<string>('AI_PREMIUM_MODELS');
    const available = listPremiumModels(envModels, {
      creditUsdValue: this.creditPricing.getCreditUsdValue(),
      netMarginPercent: this.creditPricing.getNetMarginPercent(),
    });
    const defaultPremium = available[0]?.modelId ?? DEFAULT_PREMIUM_MODEL_ID;
    const candidate = normalizeModelId(
      params.forDeepAnalysis ? deepAnalysisPremiumModelId : premiumModelId,
    );
    const resolvedModel = available.some((m) => m.modelId === candidate)
      ? candidate
      : defaultPremium;

    return {
      aiModelMode: resolvedMode,
      premiumModelId: resolvedModel,
      autoModelName: getAutoModelName(this.configService),
      premiumFallback: false,
    };
  }

  private buildView(input: {
    aiModelMode: AiModelMode;
    premiumModelId: string;
    deepAnalysisPremiumModelId?: string;
    autoTopUpEnabled: boolean;
    autoTopUpThresholdCredits: number;
    autoTopUpPackId: string;
    hasPaymentMethod: boolean;
  }): AiPreferencesView {
    const envModels = this.configService.get<string>('AI_PREMIUM_MODELS');
    const availablePremiumModels = listPremiumModels(envModels, {
      creditUsdValue: this.creditPricing.getCreditUsdValue(),
      netMarginPercent: this.creditPricing.getNetMarginPercent(),
    });
    const defaultPremium =
      availablePremiumModels[0]?.modelId ?? DEFAULT_PREMIUM_MODEL_ID;

    const resolveAvailable = (modelId: string | undefined): string => {
      const normalized = normalizeModelId(modelId);
      return availablePremiumModels.some((m) => m.modelId === normalized)
        ? normalized
        : defaultPremium;
    };

    const premiumModelId = resolveAvailable(input.premiumModelId);
    const deepAnalysisPremiumModelId = resolveAvailable(
      input.deepAnalysisPremiumModelId ?? input.premiumModelId,
    );

    return {
      aiModelMode: input.aiModelMode,
      premiumModelId,
      deepAnalysisPremiumModelId,
      autoTopUpEnabled: input.autoTopUpEnabled,
      autoTopUpThresholdCredits: input.autoTopUpThresholdCredits,
      autoTopUpPackId: input.autoTopUpPackId,
      hasPaymentMethod: input.hasPaymentMethod,
      availablePremiumModels,
      autoModelName: getAutoModelName(this.configService),
    };
  }

  private validatePremiumModel(modelId?: string) {
    if (!modelId) {
      return;
    }
    const normalized = normalizeModelId(modelId);
    const envModels = this.configService.get<string>('AI_PREMIUM_MODELS');
    const model = getPremiumModel(normalized, envModels);
    if (!model) {
      throw new NotFoundException(`Premium model not available: ${modelId}`);
    }
  }
}
