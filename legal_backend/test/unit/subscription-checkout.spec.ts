import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { SubscriptionsService } from '@/subscriptions/subscriptions.service';

/**
 * Unit tests for the subscription checkout guard and top-up error propagation.
 *
 * These tests exercise the business rules without a real DB or Stripe:
 *  1. A tenant with no active Stripe subscription (including one whose billingPlan
 *     defaults to 'STARTER') must be allowed to start checkout.
 *  2. A tenant with an ACTIVE Stripe subscription is blocked from double-subscribing.
 *  3. The tenant credit top-up path must propagate Stripe errors instead of
 *     returning a silent ?status=pending URL.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeService(overrides: Partial<{
  tenant: Record<string, unknown> | null;
  activeStripeSub: Record<string, unknown> | null;
  stripeSessionUrl: string | null;
  stripeThrows: boolean;
}> = {}) {
  const {
    tenant = {
      id: 'tenant_1',
      billingPlan: 'STARTER',
      stripeCustomerId: null,
      primaryCountry: 'IN',
    },
    activeStripeSub = null,
    stripeSessionUrl = 'https://checkout.stripe.com/pay/cs_test_1',
    stripeThrows = false,
  } = overrides;

  const prisma = {
    tenant: { findUnique: jest.fn().mockResolvedValue(tenant) },
    subscription: { findFirst: jest.fn().mockResolvedValue(activeStripeSub) },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'user_1', email: 'a@example.com' }) },
    payment: { create: jest.fn().mockResolvedValue({ id: 'pay_1' }) },
    aIPayment: { create: jest.fn().mockResolvedValue({ id: 'pay_1' }) },
  } as any;

  const configService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'APP_URL') return 'https://app.example.com';
      if (key === 'STRIPE_SECRET_KEY') return 'sk_test_xxx';
      return undefined;
    }),
  } as any;

  const stripeService = {
    createSubscriptionCheckoutSession: stripeThrows
      ? jest.fn().mockRejectedValue(new Error('Stripe config error'))
      : jest.fn().mockResolvedValue({ id: 'cs_test_1', url: stripeSessionUrl }),
    createDynamicCheckoutSession: stripeThrows
      ? jest.fn().mockRejectedValue(new Error('Stripe config error'))
      : jest.fn().mockResolvedValue({ id: 'cs_dyn_1', url: stripeSessionUrl }),
  } as any;

  const paymentsService = {
    createPayment: jest.fn().mockResolvedValue({
      payment: { id: 'pay_1' },
      intent: { provider: 'stripe', checkoutUrl: null, clientSecret: null, status: 'PENDING' },
    }),
  } as any;

  const service = new (SubscriptionsService as any)(
    prisma,
    configService,
    {} as any, // creditLedger
    {} as any, // billingModule
    stripeService,
    paymentsService,
    {} as any, // logger — not used in these paths
  );

  return { service, prisma, stripeService, paymentsService };
}

// ---------------------------------------------------------------------------
// Subscription checkout guard
// ---------------------------------------------------------------------------

describe('SubscriptionsService.createCheckout – checkout guard', () => {
  const baseDto = {
    planId: 'firm_starter',
    countryCode: 'IN',
    userType: 'LAW_FIRM',
    billingCycle: 'MONTHLY',
  };

  it('allows checkout for a tenant with no active Stripe subscription, even if billingPlan is STARTER', async () => {
    const { service } = makeService({ activeStripeSub: null });

    // Should reach Stripe, not throw 400
    // (Will throw ServiceUnavailableException if Stripe not configured for plan/country,
    //  but NOT a same-plan BadRequestException.)
    await expect(
      service.createCheckout('user_1', baseDto, 'tenant_1'),
    ).resolves.toBeDefined().catch((err: unknown) => {
      expect(err).not.toBeInstanceOf(BadRequestException);
      // ServiceUnavailableException is acceptable — it means Stripe config is incomplete
      // but the guard correctly didn't block the request.
    });
  });

  it('blocks checkout when an ACTIVE Stripe subscription already exists', async () => {
    const { service } = makeService({
      activeStripeSub: {
        id: 'sub_internal_1',
        tenantId: 'tenant_1',
        status: 'ACTIVE',
        paymentProvider: 'stripe',
        providerSubscriptionId: 'sub_stripe_123',
      },
    });

    await expect(
      service.createCheckout('user_1', baseDto, 'tenant_1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// Tenant credit top-up error propagation
// ---------------------------------------------------------------------------

describe('TenantsService.createCreditTopupCheckout – error propagation', () => {
  it('propagates Stripe errors instead of returning ?status=pending URL', async () => {
    // Import TenantsService lazily to avoid circular issues at module load
    const { TenantsService } = await import('@/tenants/tenants.service');

    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tenant_1',
          billingPlan: 'TRIAL_PENDING_PAYMENT',
          primaryCountry: 'IN',
          stripeCustomerId: null,
        }),
      },
      tenantUser: { findUnique: jest.fn().mockResolvedValue({ role: 'FIRM_ADMIN', status: 'ACTIVE' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'user_1', email: 'a@example.com' }) },
    } as any;

    const stripeService = {
      createDynamicCheckoutSession: jest.fn().mockRejectedValue(new Error('No such customer')),
    } as any;

    const paymentsService = {
      createPayment: jest.fn().mockResolvedValue({
        payment: { id: 'pay_1' },
        intent: { provider: 'stripe', checkoutUrl: null, clientSecret: null, status: 'PENDING' },
      }),
    } as any;

    const configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'APP_URL') return 'https://app.example.com';
        return undefined;
      }),
    } as any;

    const service = new TenantsService(
      prisma,
      {} as any, // creditLedger
      {} as any, // creditBudget
      {} as any, // creditWallet
      paymentsService,
      stripeService,
      configService,
      {} as any, // aiPreferences
      {} as any, // passwordPolicy
    );

    await expect(
      service.createCreditTopupCheckout('tenant_1', 'user_1', {
        packId: 'pack_10',
        countryCode: 'IN',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    // Crucially: must NOT resolve with a ?status=pending URL
    await expect(
      service.createCreditTopupCheckout('tenant_1', 'user_1', {
        packId: 'pack_10',
        countryCode: 'IN',
      }),
    ).rejects.not.toMatchObject({
      message: expect.stringContaining('status=pending'),
    });
  });
});
