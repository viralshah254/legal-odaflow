import { Module, forwardRef } from '@nestjs/common';
import { CostMonitoringModule } from '@/cost-monitoring/cost-monitoring.module';
import { PaymentsModule } from '@/payments/payments.module';
import { PricingController, SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [forwardRef(() => PaymentsModule), CostMonitoringModule],
  controllers: [SubscriptionsController, PricingController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
