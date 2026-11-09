import { getModelCostForUsage } from './model-costs.config';

describe('Google standard rate versions', () => {
  it('applies the published introductory expiry instead of permanently undercharging', () => {
    expect(getModelCostForUsage('gemini-3.8-flash', 100, new Date('2026-12-31T23:59:59Z'))).toMatchObject({ inputPer1M: 0.75, outputPer1M: 3.75 });
    expect(getModelCostForUsage('gemini-3.8-flash', 100, new Date('2027-01-01T00:00:00Z'))).toMatchObject({ inputPer1M: 1.5, outputPer1M: 7.5 });
  });
  it('prices the entire long-context request at the appropriate tier', () => {
    expect(getModelCostForUsage('gemini-3.1-pro-preview', 200000)).toMatchObject({ inputPer1M: 2, outputPer1M: 12 });
    expect(getModelCostForUsage('gemini-3.1-pro-preview', 200001)).toMatchObject({ inputPer1M: 4, outputPer1M: 18 });
  });
});
