import { AIBudgetPolicyService } from '@/cost-monitoring/ai-budget-policy.service';
import { getCreditCost } from '@/ai-credits/credit-costs';

describe('AIBudgetPolicyService', () => {
  it('computes max AI budget from MRR and target net margin', () => {
    const service = new AIBudgetPolicyService({} as never);
    expect(service.computeMaxAiBudget(1000, 0.4)).toBe(350);
    expect(service.computeMaxAiBudget(0, 0.4)).toBe(0);
  });
});

describe('AI credit costs', () => {
  it('returns mapped costs and falls back to 1', () => {
    expect(getCreditCost('STRATEGY_MEMO')).toBe(40);
    expect(getCreditCost('UNKNOWN_TASK')).toBe(1);
  });
});
