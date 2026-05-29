import { Module, forwardRef } from '@nestjs/common';
import { MarketplaceModule } from '@/marketplace/marketplace.module';
import { SubscriptionsModule } from '@/subscriptions/subscriptions.module';
import { PaymentsController } from './payments.controller';
import { MpesaProvider } from './mpesa.provider';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [
    forwardRef(() => MarketplaceModule),
    forwardRef(() => SubscriptionsModule),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeService, RazorpayService, MpesaProvider],
  exports: [PaymentsService, StripeService, RazorpayService, MpesaProvider],
})
export class PaymentsModule {}
