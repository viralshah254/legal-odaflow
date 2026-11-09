import { contributionMargin, grossUpPrice, professionalCatalog } from './professional-catalog';

describe('Professional catalog economics', () => {
  it('preserves global entry price including annual equivalent and global fallback countries', () => {
    for (const countryCode of ['US', 'GB', 'UG', 'BR', 'JP']) {
      expect(professionalCatalog({ countryCode }).plans[0].amount).toBe(100);
      expect(professionalCatalog({ countryCode, interval: 'year' }).plans[0].amount / 12).toBe(100);
    }
  });
  it('uses native regional prices and fails closed until regional allowance FX is approved', () => {
    const india = professionalCatalog({ countryCode: 'IN' });
    expect(india.currency).toBe('INR');
    expect(india.plans[0]).toMatchObject({ amount: 1499, monthlyCredits: null, readiness: 'CATALOG_FX_REQUIRED', checkoutEligible: false });
    expect(professionalCatalog({ countryCode: 'KE' }).plans[0].amount).toBe(6500);
  });
  it('freezes regional allowances using a declared catalog FX reference', () => {
    const catalog = professionalCatalog({ countryCode: 'KE', localPerUsd: 130, fxVersion: 'test-only-reference' });
    expect(catalog.plans[0].monthlyCredits).toBe(1000);
    expect(catalog.plans[0].maximumIncludedProviderCostUsd).toBe(5);
  });
  it('grosses up deductions instead of simply adding the fee', () => {
    expect(grossUpPrice(100, 0.15)).toBe(117.65);
    expect(grossUpPrice(100, 0.30)).toBe(142.86);
    expect(grossUpPrice(100, 0.15) * 0.85).toBeGreaterThanOrEqual(100);
    expect(() => grossUpPrice(100, 1)).toThrow();
  });
  it('keeps identical included usage across channels and blocks unconfigured store purchases', () => {
    const web = professionalCatalog({ countryCode: 'US' });
    const mobile = professionalCatalog({ countryCode: 'US', channel: 'apple', deductionRate: 0.3 });
    expect(mobile.plans[0].monthlyCredits).toBe(web.plans[0].monthlyCredits);
    expect(mobile.plans[0].referencePurchaseAmount).toBe(142.86);
    expect(mobile.plans.every((plan) => !plan.checkoutEligible)).toBe(true);
    expect(professionalCatalog({ countryCode: 'US', channel: 'google' }).plans[0].readiness).toBe('STORE_FEE_PROFILE_REQUIRED');
  });
  it('reports direct contribution without disguising other operating costs as profit', () => {
    expect(contributionMargin({ revenue: 100, paymentRate: 0.03, providerCost: 5, otherDirectCost: 15 })).toEqual({ netRevenue: 97, contribution: 77, margin: 77 / 97 });
    expect(contributionMargin({ revenue: 0, paymentRate: 0, providerCost: 0, otherDirectCost: 1 }).margin).toBeNull();
  });
});
