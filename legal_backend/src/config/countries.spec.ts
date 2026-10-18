import { getCountryConfig } from './countries';

describe('Country payment providers', () => {
  it('routes India through Stripe only (UPI / Google Pay via Stripe Checkout)', () => {
    const india = getCountryConfig('IN');
    expect(india.defaultPaymentProvider).toBe('stripe');
    expect(india.paymentProviders).toEqual(['stripe']);
    expect(india.currency).toBe('INR');
  });
});
