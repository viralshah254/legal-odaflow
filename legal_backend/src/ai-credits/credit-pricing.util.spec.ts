import {
  computeAiBudgetUsd,
  computeCreditsFromPayment,
} from './credit-pricing.util';

describe('credit-pricing.util', () => {
  it('computes AI budget with 40% margin', () => {
    expect(computeAiBudgetUsd(10, 40)).toBe(6);
    expect(computeAiBudgetUsd(9.99, 40)).toBe(5.994);
  });

  it('computes credits from payment', () => {
    expect(computeCreditsFromPayment(9.99, 0.06, 40)).toBe(99);
    expect(computeCreditsFromPayment(4.99, 0.06, 40)).toBe(49);
  });
});
