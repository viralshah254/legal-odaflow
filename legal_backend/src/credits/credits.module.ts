import { Module } from '@nestjs/common';
import { AiCreditsModule } from '@/ai-credits/ai-credits.module';
import { CostMonitoringModule } from '@/cost-monitoring/cost-monitoring.module';
import { CurrencyFxService } from '@/config/currency-fx.service';
import { StripeService } from '@/payments/stripe.service';
import { AutoTopUpService } from './auto-topup.service';
import { CreditReservationService } from './credit-reservation.service';
import { CreditWalletService } from './credit-wallet.service';
import { CreditsController } from './credits.controller';
import { FreeDailyGrantScheduler } from './free-daily-grant.scheduler';
import { MonthlyTenantGrantScheduler } from './monthly-tenant-grant.scheduler';

@Module({
  imports: [AiCreditsModule, CostMonitoringModule],
  controllers: [CreditsController],
  providers: [
    CreditWalletService,
    CreditReservationService,
    AutoTopUpService,
    CurrencyFxService,
    StripeService,
    FreeDailyGrantScheduler,
    MonthlyTenantGrantScheduler,
  ],
  exports: [CreditWalletService, CreditReservationService, AutoTopUpService],
})
export class CreditsModule {}
