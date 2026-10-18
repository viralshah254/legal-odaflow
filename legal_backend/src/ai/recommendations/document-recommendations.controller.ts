import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { RequestUser } from '@/common/types/request-user.interface';
import {
  DocumentRecommendationService,
  type DocumentRecommendationInput,
} from './document-recommendation.service';

@Controller('ai/document-recommendations')
@UseGuards(TenantGuard)
export class DocumentRecommendationsController {
  constructor(private readonly recommendations: DocumentRecommendationService) {}

  @Post()
  recommend(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: Omit<DocumentRecommendationInput, 'tenantId' | 'userId'>,
  ) {
    return this.recommendations.recommend({
      ...body,
      tenantId,
      userId: user.id,
    });
  }
}
