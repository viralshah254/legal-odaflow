import {
  appendStripeCheckoutTaxSettings,
  DEFAULT_STRIPE_TAX_CODE_DIGITAL,
  isStripeTaxEnabled,
  resolveStripeTaxCodeDigital,
} from './stripe-tax.util';

describe('stripe-tax.util', () => {
  it('detects STRIPE_TAX_ENABLED', () => {
    expect(isStripeTaxEnabled('true')).toBe(true);
    expect(isStripeTaxEnabled('1')).toBe(true);
    expect(isStripeTaxEnabled('false')).toBe(false);
    expect(isStripeTaxEnabled(undefined)).toBe(false);
  });

  it('defaults digital tax code', () => {
    expect(resolveStripeTaxCodeDigital(undefined)).toBe(DEFAULT_STRIPE_TAX_CODE_DIGITAL);
    expect(resolveStripeTaxCodeDigital('txcd_custom')).toBe('txcd_custom');
  });

  it('appends automatic tax and address collection when enabled', () => {
    const params = new URLSearchParams();
    appendStripeCheckoutTaxSettings(params, {
      enabled: true,
      dynamicPriceData: true,
      hasCustomer: true,
    });
    expect(params.get('automatic_tax[enabled]')).toBe('true');
    expect(params.get('billing_address_collection')).toBe('required');
    expect(params.get('tax_id_collection[enabled]')).toBe('true');
    expect(params.get('customer_update[address]')).toBe('auto');
    expect(params.get('line_items[0][price_data][product_data][tax_code]')).toBe(
      DEFAULT_STRIPE_TAX_CODE_DIGITAL,
    );
  });

  it('skips params when tax disabled', () => {
    const params = new URLSearchParams();
    appendStripeCheckoutTaxSettings(params, { enabled: false, dynamicPriceData: true });
    expect(params.toString()).toBe('');
  });
});
