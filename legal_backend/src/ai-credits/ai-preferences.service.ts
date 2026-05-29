import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import {
  AiModelMode,
  getAutoModelName,
  getPremiumModel,
  listPremiumModels,
} from '@/ai/premium-models.config';

export interface AiPreferencesView {
  aiModelMode: AiModelMode;
  premiumModelId: string;
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
  autoTopUpEnabled?: boolean;
  autoTopUpThresholdCredits?: number;
  autoTopUpPackId?: string;
}

@Injectable()
export class AiPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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
    return this.buildView({
      aiModelMode: tenant.aiModelMode as AiModelMode,
      premiumModelId: tenant.premiumModelId,
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
        premiumModelId: input.premiumModelId ?? 'gpt-4.1',
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
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        aiModelMode: input.aiModelMode,
        premiumModelId: input.premiumModelId,
        autoTopUpEnabled: input.autoTopUpEnabled,
        autoTopUpThresholdCredits: input.autoTopUpThresholdCredits,
        autoTopUpPackId: input.autoTopUpPackId,
      },
    });
    return this.getForTenant(tenantId);
  }

  async resolveForRequest(params: {
    userId: string;
    tenantId?: string;
    overrideMode?: AiModelMode;
    overridePremiumModelId?: string;
  }): Promise<{
    aiModelMode: AiModelMode;
    premiumModelId: string;
    autoModelName: string;
    premiumFallback: boolean;
  }> {
    let aiModelMode: AiModelMode = 'AUTO';
    let premiumModelId = 'gpt-4.1';

    if (params.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: params.tenantId },
        select: { aiModelMode: true, premiumModelId: true },
      });
      if (tenant) {
        aiModelMode = tenant.aiModelMode as AiModelMode;
        premiumModelId = tenant.premiumModelId;
      }
    } else {
      const profile = await this.prisma.consumerProfile.findUnique({
        where: { userId: params.userId },
      });
      const prefs = await this.prisma.userPreferences.findUnique({
        where: { userId: params.userId },
      });
      aiModelMode = (prefs?.aiModelMode ?? profile?.aiModelMode ?? 'AUTO') as AiModelMode;
      premiumModelId = prefs?.premiumModelId ?? profile?.premiumModelId ?? 'gpt-4.1';
    }

    if (params.overrideMode) {
      aiModelMode = params.overrideMode;
    }
    if (params.overridePremiumModelId) {
      premiumModelId = params.overridePremiumModelId;
    }

    return {
      aiModelMode,
      premiumModelId,
      autoModelName: getAutoModelName(this.configService),
      premiumFallback: false,
    };
  }

  private buildView(input: {
    aiModelMode: AiModelMode;
    premiumModelId: string;
    autoTopUpEnabled: boolean;
    autoTopUpThresholdCredits: number;
    autoTopUpPackId: string;
    hasPaymentMethod: boolean;
  }): AiPreferencesView {
    const envModels = this.configService.get<string>('AI_PREMIUM_MODELS');
    return {
      aiModelMode: input.aiModelMode,
      premiumModelId: input.premiumModelId,
      autoTopUpEnabled: input.autoTopUpEnabled,
      autoTopUpThresholdCredits: input.autoTopUpThresholdCredits,
      autoTopUpPackId: input.autoTopUpPackId,
      hasPaymentMethod: input.hasPaymentMethod,
      availablePremiumModels: listPremiumModels(envModels),
      autoModelName: getAutoModelName(this.configService),
    };
  }

  private validatePremiumModel(modelId?: string) {
    if (!modelId) {
      return;
    }
    const envModels = this.configService.get<string>('AI_PREMIUM_MODELS');
    const model = getPremiumModel(modelId, envModels);
    if (!model) {
      throw new NotFoundException(`Premium model not available: ${modelId}`);
    }
  }
}
