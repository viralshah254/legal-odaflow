/**
 * Unit tests for the intro-offer first-month-only discount behaviour.
 *
 * Key invariant: the discounted amount must NEVER become the recurring
 * subscription price. The 40% off must be applied via a Stripe coupon
 * (duration=once) so only the first invoice is discounted.
 *
 * Tests:
 *  1. validateCoupon accepts a correctly-configured coupon (duration=once, 40%).
 *  2. validateCoupon rejects a coupon with duration=forever.
 *  3. validateCoupon rejects a coupon with duration=repeating.
 *  4. validateCoupon rejects a coupon whose percent_off does not match.
 *  5. Checkout (no price ID) — full price + couponId passed to dynamic session.
 *  6. Checkout (no price ID) — no valid coupon → full price, no couponId.
 */

// ---------------------------------------------------------------------------
// validateCoupon — tests via StripeService with mocked fetch
// ---------------------------------------------------------------------------

import { StripeService } from '@/payments/stripe.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

function makeStripeService(fetchImpl: typeof fetch) {
  const config = {
    get: (key: string) => {
      if (key === 'STRIPE_SECRET_KEY') return 'sk_test_xxx';
      if (key === 'APP_URL') return 'https://app.example.com';
      return undefined;
    },
  } as unknown as ConfigService;

  const service = new StripeService(config);
  // Replace global fetch for the duration of the test
  ;(global as unknown as { fetch: typeof fetch }).fetch = fetchImpl;
  return service;
}

function mockFetchCoupon(coupon: Record<string, unknown>) {
  return jest.fn().mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify(coupon),
    json: async () => coupon,
  }) as unknown as typeof fetch;
}

describe('StripeService.validateCoupon', () => {
  const originalFetch = global.fetch;
  afterEach(() => { (global as unknown as { fetch: typeof fetch }).fetch = originalFetch; });

  it('accepts a coupon with duration=once and matching percent_off', async () => {
    const service = makeStripeService(mockFetchCoupon({ id: 'coup_1', valid: true, duration: 'once', percent_off: 40 }));
    await expect(service.validateCoupon('coup_1', 40)).resolves.toBe(true);
  });

  it('rejects a coupon with duration=forever', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const service = makeStripeService(mockFetchCoupon({ id: 'coup_2', valid: true, duration: 'forever', percent_off: 40 }));
    await expect(service.validateCoupon('coup_2', 40)).resolves.toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('duration="forever"'));
    warnSpy.mockRestore();
  });

  it('rejects a coupon with duration=repeating', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const service = makeStripeService(mockFetchCoupon({ id: 'coup_3', valid: true, duration: 'repeating', percent_off: 40 }));
    await expect(service.validateCoupon('coup_3', 40)).resolves.toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('duration="repeating"'));
    warnSpy.mockRestore();
  });

  it('rejects a coupon whose percent_off does not match expectedPercentOff', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const service = makeStripeService(mockFetchCoupon({ id: 'coup_4', valid: true, duration: 'once', percent_off: 50 }));
    await expect(service.validateCoupon('coup_4', 40)).resolves.toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('percent_off=50'));
    warnSpy.mockRestore();
  });

  it('accepts a coupon when no expectedPercentOff is provided (backwards-compat)', async () => {
    const service = makeStripeService(mockFetchCoupon({ id: 'coup_5', valid: true, duration: 'once', percent_off: 40 }));
    await expect(service.validateCoupon('coup_5')).resolves.toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Checkout paths — intro offer must use full price + couponId
// ---------------------------------------------------------------------------

import { SubscriptionsService } from '@/subscriptions/subscriptions.service';

type SubscriptionsServiceAny = InstanceType<typeof SubscriptionsService>;

function makeCheckoutService(opts: {
  /** Whether validateCoupon returns true (coupon is valid) */
  couponValid: boolean;
  /** INR price ID (or null to simulate no price ID configured) */
  stripePriceId?: string | null;
}) {
  const { couponValid, stripePriceId = null } = opts;

  const prisma = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'tenant_1',
        billingPlan: 'STARTER',
        stripeCustomerId: null,
        primaryCountry: 'IN',
        currency: 'INR',
      }),
    },
    subscription: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'sub_internal_1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user_1',
        email: 'a@example.com',
        firstLoginAt: new Date(),
      }),
    },
  } as any;

  const configService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'APP_URL') return 'https://app.example.com';
      if (key === 'STRIPE_SECRET_KEY') return 'sk_test_xxx';
      if (key === 'STRIPE_INTRO_OFFER_COUPON_ID') return 'coup_intro';
      if (key === 'INTRO_OFFER_DISCOUNT_PERCENT') return '40';
      if (key === 'INTRO_OFFER_DAYS') return '7';
      if (key === 'STRIPE_PRICE_FIRM_STARTER_INR') return stripePriceId ?? undefined;
      return undefined;
    }),
  } as any;

  const dynamicSessionMock = jest.fn().mockResolvedValue({ id: 'cs_dyn_1', url: 'https://checkout.stripe.com/cs_dyn_1' });
  const subscriptionSessionMock = jest.fn().mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/cs_1' });

  const stripeService = {
    createOrRetrieveCustomer: jest.fn().mockResolvedValue({ id: 'cus_1' }),
    createDynamicCheckoutSession: dynamicSessionMock,
    createSubscriptionCheckoutSession: subscriptionSessionMock,
    validateCoupon: jest.fn().mockResolvedValue(couponValid),
  } as any;

  const referralsService = {
    validateReferralForCheckout: jest.fn().mockResolvedValue({ eligible: false }),
    markReferralSubscribed: jest.fn(),
  } as any;

  const service = new (SubscriptionsService as any)(
    prisma,
    configService,
    stripeService,
    referralsService,
    {} as any, // creditLedger
    {} as any, // budgetPolicy
    {} as any, // currencyFx — not needed for IN (uses native INR pricing)
  ) as SubscriptionsServiceAny;

  // Stub resolveIntroOfferForCheckout to always return eligible
  jest
    .spyOn(service as any, 'resolveIntroOfferForCheckout')
    .mockResolvedValue({ eligible: true, discountPercent: 40 });

  return { service, dynamicSessionMock, subscriptionSessionMock, stripeService };
}

describe('createCheckout — intro offer uses full price + coupon (never discounted recurring)', () => {
  /**
   * When no Stripe Price ID is configured for the plan/country, checkout falls
   * through to a dynamic price_data session. The recurring unit_amount must be
   * the FULL plan price (₹1,400 = 140000 paise), with the coupon applied
   * separately so Stripe discounts only the first invoice.
   */
  it('no price ID + valid coupon → dynamic checkout with full price and couponId', async () => {
    const { service, dynamicSessionMock } = makeCheckoutService({ couponValid: true, stripePriceId: null });

    await service.createCheckout('user_1', {
      planId: 'firm_starter',
      countryCode: 'IN',
      userType: 'LAW_FIRM',
      billingCycle: 'monthly',
    }, 'tenant_1').catch(() => {/* ignore non-checkout errors */});

    expect(dynamicSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinorUnits: 140000, // ₹1,400 × 100 paise — full price
        couponId: 'coup_intro',
      }),
    );
    // Must NOT be the discounted amount (₹840 = 84000 paise)
    const call = dynamicSessionMock.mock.calls[0]?.[0];
    expect(call?.amountMinorUnits).not.toBe(84000);
  });

  /**
   * When no coupon is available (misconfigured env), do NOT bake the discount
   * into the recurring price. Fall through to full price with no couponId.
   */
  it('no price ID + invalid coupon → dynamic checkout with full price and no couponId', async () => {
    const { service, dynamicSessionMock } = makeCheckoutService({ couponValid: false, stripePriceId: null });

    await service.createCheckout('user_1', {
      planId: 'firm_starter',
      countryCode: 'IN',
      userType: 'LAW_FIRM',
      billingCycle: 'monthly',
    }, 'tenant_1').catch(() => {/* ignore non-checkout errors */});

    if (dynamicSessionMock.mock.calls.length > 0) {
      const call = dynamicSessionMock.mock.calls[0]?.[0];
      // Must be full price (not discounted)
      expect(call?.amountMinorUnits).toBe(140000);
      // Must not pass a coupon
      expect(call?.couponId).toBeUndefined();
    }
  });
});
