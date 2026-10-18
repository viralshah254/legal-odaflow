/**
 * Stripe Tax helpers for Checkout (India IGST / APAC digital services).
 * @see https://docs.stripe.com/tax/set-up
 */

/** Electronically supplied services (OIDAR / digital products). */
export const DEFAULT_STRIPE_TAX_CODE_DIGITAL = 'txcd_10000000';

export function resolveStripeTaxCodeDigital(envValue?: string): string {
  const trimmed = envValue?.trim();
  return trimmed || DEFAULT_STRIPE_TAX_CODE_DIGITAL;
}

export function isStripeTaxEnabled(envValue?: string): boolean {
  const normalized = envValue?.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export interface StripeCheckoutTaxOptions {
  enabled: boolean;
  /** Tax code for dynamic price_data line items (product_data.tax_code). */
  digitalTaxCode?: string;
  /** When true, sets line_items[0][price_data][product_data][tax_code]. */
  dynamicPriceData?: boolean;
  /** Existing Stripe customer — allow Checkout to refresh address for tax. */
  hasCustomer?: boolean;
}

/**
 * Appends Checkout Session params for automatic tax + India state/province collection.
 */
export function appendStripeCheckoutTaxSettings(
  params: URLSearchParams,
  options: StripeCheckoutTaxOptions,
): void {
  if (!options.enabled) return;

  params.append('automatic_tax[enabled]', 'true');
  params.append('billing_address_collection', 'required');
  params.append('tax_id_collection[enabled]', 'true');

  if (options.hasCustomer) {
    params.append('customer_update[address]', 'auto');
    params.append('customer_update[name]', 'auto');
  }

  const taxCode = options.digitalTaxCode ?? DEFAULT_STRIPE_TAX_CODE_DIGITAL;
  if (options.dynamicPriceData) {
    params.append('line_items[0][price_data][product_data][tax_code]', taxCode);
  }
}
