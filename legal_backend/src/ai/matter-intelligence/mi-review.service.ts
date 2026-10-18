import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { MatterProfile } from './matter-intelligence.types';

@Injectable()
export class MiReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueueLowConfidence(params: {
    entityType: string;
    entityId?: string;
    tenantId?: string;
    profile: MatterProfile;
    recommendationMode: string;
  }): Promise<void> {
    if (params.recommendationMode !== 'low_confidence') return;

    await this.prisma.matterIntelligenceReview.create({
      data: {
        tenantId: params.tenantId,
        entityType: params.entityType,
        entityId: params.entityId,
        profileSnapshot: params.profile as unknown as Prisma.InputJsonValue,
        recommendationMode: params.recommendationMode,
        status: 'pending',
      },
    });
  }

  list(params: { status?: string }) {
    return this.prisma.matterIntelligenceReview.findMany({
      where: params.status ? { status: params.status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async submitReview(
    reviewId: string,
    body: {
      correction?: Record<string, unknown>;
      status?: string;
      reviewerId?: string;
    },
  ) {
    const row = await this.prisma.matterIntelligenceReview.findUnique({ where: { id: reviewId } });
    if (!row) throw new NotFoundException('Review not found');

    return this.prisma.matterIntelligenceReview.update({
      where: { id: reviewId },
      data: {
        correction: (body.correction as Prisma.InputJsonValue) ?? row.correction,
        status: body.status ?? 'reviewed',
        reviewerId: body.reviewerId,
        reviewedAt: new Date(),
      },
    });
  }
}
