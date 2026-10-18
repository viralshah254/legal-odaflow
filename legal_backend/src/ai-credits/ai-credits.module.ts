import { Global, Module } from '@nestjs/common';
import { CurrencyFxService } from '@/config/currency-fx.service';
import { ModelRouterService } from '@/ai/model-router/model-router.service';
import { AICreditLedgerService } from './ai-credit-ledger.service';
import { AiPreferencesService } from './ai-preferences.service';
import { CreditPricingService } from './credit-pricing.service';
import { PremiumAllowanceService } from './premium-allowance.service';
import { AiModelResolverService } from './ai-model-resolver.service';
import { CreditPacksService } from './credit-packs.service';
import { TokenCreditChargeService } from './token-credit-charge.service';
import { AiCreditEnforcementService } from './ai-credit-enforcement.service';
import { AICreditBudgetService } from './ai-credit-budget.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    AICreditLedgerService,
    AICreditBudgetService,
    CreditPricingService,
    PremiumAllowanceService,
    AiPreferencesService,
    AiModelResolverService,
    ModelRouterService,
    CreditPacksService,
    CurrencyFxService,
    TokenCreditChargeService,
    AiCreditEnforcementService,
  ],
  exports: [
    AICreditLedgerService,
    AICreditBudgetService,
    CreditPricingService,
    PremiumAllowanceService,
    AiPreferencesService,
    AiModelResolverService,
    ModelRouterService,
    CreditPacksService,
    TokenCreditChargeService,
    AiCreditEnforcementService,
  ],
})
export class AiCreditsModule {}
