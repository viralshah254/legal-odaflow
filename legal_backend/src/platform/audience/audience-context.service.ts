import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import type { ProductModeConfig } from '@prisma/client'

const MODE_DEFAULT_FEATURES: Record<string, string[]> = {
  individual: ['research', 'drafting', 'document_review'],
  lawyer: ['research', 'drafting', 'document_review', 'matter_intelligence', 'strategy', 'hearing_prep', 'verification'],
  firm: ['research', 'drafting', 'document_review', 'matter_intelligence', 'strategy', 'hearing_prep', 'verification', 'copilot', 'firm_learning'],
  in_house: ['research', 'drafting', 'contract_review', 'matter_intelligence', 'regulatory'],
  client_portal: ['document_review', 'matter_updates', 'messaging'],
}

@Injectable()
export class AudienceContextService {
  constructor(private readonly prisma: PrismaService) {}

  async getProductMode(userId: string, tenantId?: string): Promise<string> {
    const config = await this.prisma.productModeConfig.findFirst({
      where: {
        userId,
        ...(tenantId ? { tenantId } : { tenantId: null }),
      },
    })
    return config?.mode ?? 'individual'
  }

  async setProductMode(
    userId: string,
    tenantId: string | null,
    mode: string,
  ): Promise<ProductModeConfig> {
    const defaultFeatures = MODE_DEFAULT_FEATURES[mode] ?? []

    return this.prisma.productModeConfig.upsert({
      where: {
        tenantId_userId: { tenantId: tenantId ?? '', userId },
      },
      create: {
        userId,
        tenantId: tenantId ?? null,
        mode,
        features: defaultFeatures,
      },
      update: {
        mode,
        features: defaultFeatures,
      },
    })
  }

  async getEnabledFeatures(userId: string, tenantId?: string): Promise<string[]> {
    const config = await this.prisma.productModeConfig.findFirst({
      where: {
        userId,
        ...(tenantId ? { tenantId } : { tenantId: null }),
      },
    })

    if (!config) return MODE_DEFAULT_FEATURES['individual'] ?? []

    return config.features
  }
}
