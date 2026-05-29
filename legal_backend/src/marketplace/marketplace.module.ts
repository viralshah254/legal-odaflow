import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '@/ai/ai.module';
import { LegalSourcesModule } from '@/legal-sources/legal-sources.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { PaymentsModule } from '@/payments/payments.module';
import { FullLoopAutomationService } from './full-loop-automation.service';
import { IntakeAnalysisService } from './intake-analysis.service';
import { LeadSlaScheduler } from './lead-sla.scheduler';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  imports: [
    forwardRef(() => AiModule),
    LegalSourcesModule,
    forwardRef(() => PaymentsModule),
    NotificationsModule,
  ],
  controllers: [MarketplaceController],
  providers: [
    MarketplaceService,
    IntakeAnalysisService,
    FullLoopAutomationService,
    LeadSlaScheduler,
  ],
  exports: [MarketplaceService, IntakeAnalysisService, FullLoopAutomationService],
})
export class MarketplaceModule {}
