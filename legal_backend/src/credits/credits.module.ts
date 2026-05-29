import { Module } from '@nestjs/common';
import { AiCreditsModule } from '@/ai-credits/ai-credits.module';
import { StripeService } from '@/payments/stripe.service';
import { AutoTopUpService } from './auto-topup.service';
import { CreditReservationService } from './credit-reservation.service';
import { CreditWalletService } from './credit-wallet.service';
import { CreditsController } from './credits.controller';

@Module({
  imports: [AiCreditsModule],
  controllers: [CreditsController],
  providers: [
    CreditWalletService,
    CreditReservationService,
    AutoTopUpService,
    StripeService,
  ],
  exports: [CreditWalletService, CreditReservationService, AutoTopUpService],
})
export class CreditsModule {}
