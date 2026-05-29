import { Module, forwardRef } from '@nestjs/common';
import { AiCreditsModule } from '@/ai-credits/ai-credits.module';
import { AiModule } from '@/ai/ai.module';
import { PaymentsModule } from '@/payments/payments.module';
import { MarketplaceModule } from '@/marketplace/marketplace.module';
import { TrainingConsentModule } from '@/training-consent/training-consent.module';
import { ConsumersController } from './consumers.controller';
import { ConsumersService } from './consumers.service';

@Module({
  imports: [
    AiModule,
    AiCreditsModule,
    forwardRef(() => PaymentsModule),
    TrainingConsentModule,
    MarketplaceModule,
  ],
  controllers: [ConsumersController],
  providers: [ConsumersService],
  exports: [ConsumersService],
})
export class ConsumersModule {}
