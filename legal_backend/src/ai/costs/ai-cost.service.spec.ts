import { AiCostService } from './ai-cost.service';

describe('AiCostService credit denomination', () => {
  it('values the same wallet credits equally in every jurisdiction', () => {
    const pricing = { computeCreditValueUsd: jest.fn((credits: number) => credits * 0.01) };
    const service = new AiCostService({} as any, {} as any, pricing as any);
    for (const country of ['US', 'IN', 'KE', 'UG']) {
      expect(service.computeCreditValueUsd(100, country)).toBe(1);
      expect(service.computeMargin({
        creditValueUsd: service.computeCreditValueUsd(100, country), actualCostUsd: 0.5,
      }).grossMarginPercent).toBe(50);
    }
  });
});
