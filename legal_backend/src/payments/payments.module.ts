import { Module, forwardRef } from '@nestjs/common';
import { FinanceModule } from '@/finance/finance.module';
import { MarketplaceModule } from '@/marketplace/marketplace.module';
import { SubscriptionsModule } from '@/subscriptions/subscriptions.module';
import { PaymentsController } from './payments.controller';
import { MpesaProvider } from './mpesa.provider';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [
    FinanceModule,
    forwardRef(() => MarketplaceModule),
    forwardRef(() => SubscriptionsModule),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeService, MpesaProvider],
  exports: [PaymentsService, StripeService, MpesaProvider],
})
export class PaymentsModule {}
