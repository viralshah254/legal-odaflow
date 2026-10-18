import {
  appendStripeCheckoutSessionPaymentMethods,
  appendStripePaymentIntentPaymentMethods,
} from './stripe-checkout.util';

describe('appendStripeCheckoutSessionPaymentMethods', () => {
  it('enables card for non-INR checkout', () => {
    const params = new URLSearchParams();
    appendStripeCheckoutSessionPaymentMethods(params, 'usd');
    expect(params.getAll('payment_method_types[]')).toEqual(['card']);
  });

  it('enables card and UPI for INR checkout', () => {
    const params = new URLSearchParams();
    appendStripeCheckoutSessionPaymentMethods(params, 'inr');
    expect(params.getAll('payment_method_types[]')).toEqual(['card', 'upi']);
  });
});

describe('appendStripePaymentIntentPaymentMethods', () => {
  it('enables automatic payment methods for payment intents', () => {
    const params = new URLSearchParams();
    appendStripePaymentIntentPaymentMethods(params, 'usd');
    expect(params.get('automatic_payment_methods[enabled]')).toBe('true');
    expect(params.get('automatic_payment_methods[allow_redirects]')).toBeNull();
  });

  it('allows redirects for INR payment intents', () => {
    const params = new URLSearchParams();
    appendStripePaymentIntentPaymentMethods(params, 'inr');
    expect(params.get('automatic_payment_methods[enabled]')).toBe('true');
    expect(params.get('automatic_payment_methods[allow_redirects]')).toBe('always');
  });
});
