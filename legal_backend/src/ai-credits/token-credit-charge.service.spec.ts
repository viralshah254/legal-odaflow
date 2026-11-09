import { TokenCreditChargeService } from './token-credit-charge.service';

describe('usage pricing policy', () => {
  const service = new TokenCreditChargeService(
    { get: () => 'flat' } as any,
    { getCreditUsdValue: () => 0.01, getNetMarginPercent: () => 50 } as any,
    {} as any,
  );

  it('uses actual supplied provider cost and ignores legacy task floors and caps', async () => {
    const usage = await service.computeCreditsForUsage({
      modelName: 'gpt-5.4-mini', inputTokens: 10, outputTokens: 10,
      providerCostUsd: 0.035, taskType: 'LEGAL_RESEARCH',
      minCredits: 40, maxCredits: 3, billingPlan: 'test',
    });
    expect(usage.credits).toBe(7);
    expect(usage.providerCostUsd).toBe(0.035);
    expect(service.isTokenBased()).toBe(true);
  });

  it('does not charge free calls a minimum task fee', async () => {
    const usage = await service.computeCreditsForUsage({
      modelName: 'gpt-5.4-mini', inputTokens: 0, outputTokens: 0,
      providerCostUsd: 0, minCredits: 40, billingPlan: 'test',
    });
    expect(usage.credits).toBe(0);
  });
});
