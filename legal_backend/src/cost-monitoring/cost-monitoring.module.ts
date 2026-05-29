import { Module } from '@nestjs/common';
import { AIBudgetPolicyService } from './ai-budget-policy.service';
import { UnitEconomicsScheduler } from './unit-economics.scheduler';
import { UnitEconomicsService } from './unit-economics.service';

@Module({
  providers: [UnitEconomicsService, AIBudgetPolicyService, UnitEconomicsScheduler],
  exports: [UnitEconomicsService, AIBudgetPolicyService],
})
export class CostMonitoringModule {}
