import { AiCreditEnforcementService } from './ai-credit-enforcement.service';

describe('Premium-only credit enforcement', () => {
  it('uses the priced balance without downgrading when a legacy premium allowance is exhausted', async () => {
    const service = new AiCreditEnforcementService(
      { aICreditLedger: { findMany: async () => [] } } as never,
      { getBalance: async () => 1000 } as never,
      { getPremiumAllowanceRemaining: async () => 0 } as never,
      { estimateCreditsForModel: () => ({ credits: 20 }) } as never,
    );
    const result = await service.checkUsageAccess({ userId: 'local-user', modelMode: 'PREMIUM', modelName: 'gpt-5.6-sol', planCreditsMonthly: 1000, cycleStart: new Date() });
    expect(result).toMatchObject({ allowed: true, effectiveModelMode: 'PREMIUM', downgradedFromPremium: false });
  });
});
