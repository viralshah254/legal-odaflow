import {
  applyFxMarkup,
  convertUsdToLocalAmount,
  FX_MARKUP_PERCENT,
  roundForCurrency,
} from '@/config/currency-fx.util';

describe('currency-fx.util', () => {
  it('applies 1.5% markup on USD→local conversion', () => {
    const rate = 83;
    expect(applyFxMarkup(40, rate)).toBeCloseTo(40 * 83 * (1 + FX_MARKUP_PERCENT / 100), 5);
  });

  it('rounds INR to whole rupees', () => {
    const inr = convertUsdToLocalAmount(40, 'INR', 83);
    expect(inr).toBe(Math.round(40 * 83 * 1.015));
    expect(roundForCurrency(3370.2, 'INR')).toBe(3370);
  });

  it('returns zero for free tiers without conversion', () => {
    expect(convertUsdToLocalAmount(0, 'INR', 83)).toBe(0);
  });

  it('passes through USD unchanged', () => {
    expect(convertUsdToLocalAmount(40, 'USD', 1)).toBe(40);
  });
});
