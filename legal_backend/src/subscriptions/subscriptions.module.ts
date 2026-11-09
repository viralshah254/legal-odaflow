import { Module, forwardRef } from '@nestjs/common';
import { CostMonitoringModule } from '@/cost-monitoring/cost-monitoring.module';
import { CurrencyFxService } from '@/config/currency-fx.service';
import { PaymentsModule } from '@/payments/payments.module';
import { ReferralsModule } from '@/referrals/referrals.module';
import { AccountBillingController } from './account-billing.controller';
import { PricingController, SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { ProfessionalPricingController } from './professional-pricing.controller';

@Module({
  imports: [forwardRef(() => PaymentsModule), CostMonitoringModule, ReferralsModule],
  controllers: [SubscriptionsController, PricingController, AccountBillingController, ProfessionalPricingController],
  providers: [SubscriptionsService, CurrencyFxService],
  exports: [SubscriptionsService, CurrencyFxService],
})
export class SubscriptionsModule {}
