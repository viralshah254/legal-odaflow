import { Module, forwardRef } from '@nestjs/common';
import { AiCreditsModule } from '@/ai-credits/ai-credits.module';
import { AiModule } from '@/ai/ai.module';
import { MatterIntelligencePlatformModule } from '@/ai/matter-intelligence/matter-intelligence.module';
import { CacheModule } from '@/cache/cache.module';
import { DocumentsModule } from '@/documents/documents.module';
import { PaymentsModule } from '@/payments/payments.module';
import { MarketplaceModule } from '@/marketplace/marketplace.module';
import { SiteAnalyticsModule } from '@/site-analytics/site-analytics.module';
import { TrainingConsentModule } from '@/training-consent/training-consent.module';
import { UsersModule } from '@/users/users.module';
import { ConsumersController } from './consumers.controller';
import { ConsumersService } from './consumers.service';
import { IntakeIntelligenceService } from './intake-intelligence.service';
import { IssueCheckerAbuseGuard } from './issue-checker-abuse.guard';
import { IssueCheckerAbuseService } from './issue-checker-abuse.service';

@Module({
  imports: [
    AiModule,
    MatterIntelligencePlatformModule,
    AiCreditsModule,
    CacheModule,
    DocumentsModule,
    forwardRef(() => PaymentsModule),
    TrainingConsentModule,
    MarketplaceModule,
    SiteAnalyticsModule,
    UsersModule,
  ],
  controllers: [ConsumersController],
  providers: [
    ConsumersService,
    IntakeIntelligenceService,
    IssueCheckerAbuseService,
    IssueCheckerAbuseGuard,
  ],
  exports: [ConsumersService, IntakeIntelligenceService],
})
export class ConsumersModule {}
