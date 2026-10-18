import { Module } from '@nestjs/common';
import { CostLedgerService } from './cost-ledger.service';
import { CostBudgetPolicyService } from './cost-budget-policy.service';

@Module({
  providers: [CostLedgerService, CostBudgetPolicyService],
  exports: [CostLedgerService, CostBudgetPolicyService],
})
export class CostModule {}
