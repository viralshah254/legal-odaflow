import {
  computeAiBudgetUsd,
  computeCreditsFromLocalPrice,
  computeCreditsFromPayment,
  computeCreditsFromProviderCost,
  DEFAULT_CREDIT_USD_VALUE,
  DEFAULT_SUBSCRIPTION_MARGIN_PERCENT,
  estimateTokenCostUsd,
} from './credit-pricing.util';
import { getPricingForCountry, PRICING_PLANS } from '@/config/pricing.config';
import { getModelCostSync, TYPICAL_COPILOT_INPUT_TOKENS, TYPICAL_COPILOT_OUTPUT_TOKENS } from '@/ai/model-costs.config';

describe('credit-pricing.util', () => {
  it('computes AI budget with 40% margin', () => {
    expect(computeAiBudgetUsd(10, 40)).toBe(6);
    expect(computeAiBudgetUsd(9.99, 40)).toBe(5.994);
  });

  it('computes credits from payment at $0.01/credit and 40% margin', () => {
    expect(computeCreditsFromPayment(9.99, 0.01, 40)).toBe(599);
    expect(computeCreditsFromPayment(4.99, 0.01, 40)).toBe(299);
  });

  it('computes India native plan credits with 40% gross margin floor', () => {
    const solo = getPricingForCountry('IN', 'LAW_FIRM', PRICING_PLANS.LAWYER_SOLO);
    const pro = getPricingForCountry('IN', 'LAW_FIRM', PRICING_PLANS.FIRM_PROFESSIONAL);
    const proPlus = getPricingForCountry('IN', 'LAW_FIRM', PRICING_PLANS.FIRM_PRO_PLUS);
    const consumer = getPricingForCountry('IN', 'CONSUMER', PRICING_PLANS.CONSUMER_PLUS);

    expect(Number(solo?.amount)).toBe(1400);
    expect(solo?.aiCredits).toBe(computeCreditsFromLocalPrice(1400, 'INR'));
    expect(pro?.aiCredits).toBe(computeCreditsFromLocalPrice(6000, 'INR'));
    expect(proPlus?.aiCredits).toBe(computeCreditsFromLocalPrice(30000, 'INR'));
    expect(consumer?.aiCredits).toBe(computeCreditsFromLocalPrice(1000, 'INR'));

    for (const plan of [solo, pro, proPlus, consumer]) {
      if (!plan || Number(plan.amount) <= 0) continue;
      const revenueUsd = Number(plan.amount) / 85;
      const maxProviderBudgetUsd = revenueUsd * (1 - DEFAULT_SUBSCRIPTION_MARGIN_PERCENT / 100);
      const maxBurnUsd = plan.aiCredits * DEFAULT_CREDIT_USD_VALUE;
      expect(maxBurnUsd).toBeLessThanOrEqual(maxProviderBudgetUsd + 0.02);
    }
  });

  it('India plan credits survive worst-case premium token burn within margin', () => {
    const proPlus = getPricingForCountry('IN', 'LAW_FIRM', PRICING_PLANS.FIRM_PRO_PLUS);
    expect(proPlus).toBeDefined();
    const revenueUsd = 30000 / 85;
    const maxProviderBudgetUsd = revenueUsd * 0.6;

    const premiumModel = getModelCostSync('gpt-5.5');
    const costPerMessage = estimateTokenCostUsd(
      premiumModel.inputPer1M,
      premiumModel.outputPer1M,
      TYPICAL_COPILOT_INPUT_TOKENS,
      TYPICAL_COPILOT_OUTPUT_TOKENS,
    );
    const messagesAtFullBurn = maxProviderBudgetUsd / costPerMessage;
    const creditsPerMessage = Math.ceil(costPerMessage / DEFAULT_CREDIT_USD_VALUE);

    expect(proPlus!.aiCredits / creditsPerMessage).toBeLessThanOrEqual(messagesAtFullBurn + 1);
  });

  it('charges twice provider cost regardless of legacy margins and floors', () => {
    expect(computeCreditsFromProviderCost(0.042, 0.01, 30)).toBe(9);
    expect(computeCreditsFromProviderCost(0.008, 0.01, 20, 40)).toBe(2);
    expect(computeCreditsFromProviderCost(0.016, 0.01, 20)).toBe(4);
    expect(computeCreditsFromProviderCost(0, 0.01, 20, 40)).toBe(0);
    expect(computeCreditsFromProviderCost(0.035, 0.01)).toBe(7);
  });

  it('rejects invalid accounting inputs instead of silently charging a floor', () => {
    for (const cost of [NaN, Infinity, -1]) {
      expect(() => computeCreditsFromProviderCost(cost)).toThrow();
    }
    for (const value of [0, -1, NaN, Infinity]) {
      expect(() => computeCreditsFromProviderCost(0.01, value)).toThrow();
    }
  });

  it('estimates token cost from model rates', () => {
    const cost = estimateTokenCostUsd(3, 12, 2500, 800);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeCloseTo(0.0171, 3);
  });
});
