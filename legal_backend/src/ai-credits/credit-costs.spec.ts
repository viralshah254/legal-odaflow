import { AIBudgetPolicyService } from '@/cost-monitoring/ai-budget-policy.service';
import {
  DRAFT_CREDIT_FLOORS,
  FULL_AI_DRAFT_MIN_CREDITS,
  getCreditCost,
} from '@/ai-credits/credit-costs';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';
import { computeCreditsFromProviderCost } from '@/ai-credits/credit-pricing.util';

describe('AIBudgetPolicyService', () => {
  it('computes max AI budget from MRR and target net margin', () => {
    const service = new AIBudgetPolicyService({} as never);
    expect(service.computeMaxAiBudget(1000, 0.4)).toBe(350);
    expect(service.computeMaxAiBudget(0, 0.4)).toBe(0);
  });
});

describe('AI credit costs', () => {
  it('returns mapped costs and falls back to 1', () => {
    expect(getCreditCost('STRATEGY_MEMO')).toBe(60);
    expect(getCreditCost('UNKNOWN_TASK')).toBe(1);
  });

  it('uses standard draft floor across document draft task types', () => {
    expect(getCreditCost(AI_TASK_TYPES.DOCUMENT_DRAFT)).toBe(DRAFT_CREDIT_FLOORS.STANDARD_DRAFT);
    expect(getCreditCost(AI_TASK_TYPES.TEMPLATE_DRAFT)).toBe(DRAFT_CREDIT_FLOORS.STANDARD_DRAFT);
    expect(getCreditCost(AI_TASK_TYPES.INDIA_COURT_DRAFT)).toBe(DRAFT_CREDIT_FLOORS.STANDARD_DRAFT);
  });

  it('charges draft intent search and minor edit tasks', () => {
    expect(getCreditCost(AI_TASK_TYPES.DRAFT_INTENT_SEARCH)).toBe(5);
    expect(getCreditCost(AI_TASK_TYPES.DRAFT_FILL_BLANKS)).toBe(5);
    expect(getCreditCost(AI_TASK_TYPES.DRAFT_SELECTION_EDIT)).toBe(1);
    expect(getCreditCost(AI_TASK_TYPES.DRAFT_VERIFICATION_FIX)).toBe(1);
  });

  it('enforces task floor even when provider cost is tiny', () => {
    const credits = computeCreditsFromProviderCost(0.001, 0.01, 40, FULL_AI_DRAFT_MIN_CREDITS);
    expect(credits).toBe(FULL_AI_DRAFT_MIN_CREDITS);
  });

  it('computes verification-fix credits with 20 percent net margin', () => {
    expect(computeCreditsFromProviderCost(0.016, 0.01, 20, getCreditCost(AI_TASK_TYPES.DRAFT_VERIFICATION_FIX))).toBe(2);
  });
});
