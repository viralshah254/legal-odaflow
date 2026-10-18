import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CacheService } from '@/cache/cache.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';

type PromotionMetadata = {
  cacheKey?: string;
  eligible?: boolean;
  promotedAt?: string;
  promotedBy?: 'approval' | 'save';
};

@Injectable()
export class ResearchCachePromotionService {
  private readonly logger = new Logger(ResearchCachePromotionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async promote(input: {
    aiOutputId: string;
    tenantId: string;
    userId?: string;
    reason: 'approval' | 'save';
  }): Promise<boolean> {
    const output = await this.prisma.aIOutput.findFirst({
      where: {
        id: input.aiOutputId,
        tenantId: input.tenantId,
        taskType: AI_TASK_TYPES.LEGAL_RESEARCH,
        ...(input.userId ? { userId: input.userId } : {}),
      },
      select: { id: true, citations: true },
    });
    if (!output) throw new NotFoundException('Research output not found');

    const citations = this.asObject(output.citations);
    const promotion = this.asObject(citations.cachePromotion) as PromotionMetadata;
    const payload = this.asObject(citations.cachePayload);
    if (!promotion.cacheKey || Object.keys(payload).length === 0) {
      this.logger.warn(`Research output ${output.id} lacks cache promotion metadata`);
      return false;
    }

    await this.cache.set(promotion.cacheKey, payload);
    await this.prisma.aIOutput.update({
      where: { id: output.id },
      data: {
        citations: {
          ...citations,
          cachePromotion: {
            ...promotion,
            eligible: true,
            promotedAt: new Date().toISOString(),
            promotedBy: input.reason,
          },
        } as Prisma.InputJsonValue,
      },
    });
    return true;
  }

  private asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
