/**
 * Checkout Session payment methods (raw REST form params).
 * Do not use automatic_payment_methods here — Stripe rejects it on some accounts/API versions.
 */
export function appendStripeCheckoutSessionPaymentMethods(
  params: URLSearchParams,
  currency?: string,
): void {
  params.append('payment_method_types[]', 'card');
  if (currency?.toLowerCase() === 'inr') {
    params.append('payment_method_types[]', 'upi');
  }
}

/** PaymentIntent — Dashboard-driven method eligibility. */
export function appendStripePaymentIntentPaymentMethods(
  params: URLSearchParams,
  currency?: string,
): void {
  params.append('automatic_payment_methods[enabled]', 'true');
  if (currency?.toLowerCase() === 'inr') {
    params.append('automatic_payment_methods[allow_redirects]', 'always');
  }
}

/** @deprecated Use appendStripeCheckoutSessionPaymentMethods */
export function appendStripeCheckoutPaymentMethods(
  params: URLSearchParams,
  currency?: string,
): void {
  appendStripeCheckoutSessionPaymentMethods(params, currency);
}
