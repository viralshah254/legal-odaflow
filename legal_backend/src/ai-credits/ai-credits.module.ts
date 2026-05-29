import { Global, Module } from '@nestjs/common';
import { ModelRouterService } from '@/ai/model-router/model-router.service';
import { AICreditLedgerService } from './ai-credit-ledger.service';
import { AiPreferencesService } from './ai-preferences.service';
import { CreditPricingService } from './credit-pricing.service';
import { PremiumAllowanceService } from './premium-allowance.service';
import { AiModelResolverService } from './ai-model-resolver.service';
import { CreditPacksService } from './credit-packs.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    AICreditLedgerService,
    CreditPricingService,
    PremiumAllowanceService,
    AiPreferencesService,
    AiModelResolverService,
    ModelRouterService,
    CreditPacksService,
  ],
  exports: [
    AICreditLedgerService,
    CreditPricingService,
    PremiumAllowanceService,
    AiPreferencesService,
    AiModelResolverService,
    ModelRouterService,
    CreditPacksService,
  ],
})
export class AiCreditsModule {}
