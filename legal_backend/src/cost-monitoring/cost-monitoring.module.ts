import { Module } from '@nestjs/common';
import { AIBudgetPolicyService } from './ai-budget-policy.service';
import { UnitEconomicsScheduler } from './unit-economics.scheduler';
import { UnitEconomicsService } from './unit-economics.service';
import { ProviderBillingReconciliationService } from './provider-billing-reconciliation.service';
import { ProviderBillingScheduler } from './provider-billing.scheduler';

@Module({
  providers: [
    UnitEconomicsService,
    AIBudgetPolicyService,
    UnitEconomicsScheduler,
    ProviderBillingReconciliationService,
    ProviderBillingScheduler,
  ],
  exports: [
    UnitEconomicsService,
    AIBudgetPolicyService,
    ProviderBillingReconciliationService,
  ],
})
export class CostMonitoringModule {}
