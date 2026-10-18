import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Stripe zero-decimal currencies — these must NOT be multiplied by 100.
 * https://stripe.com/docs/currencies#zero-decimal
 */
const STRIPE_ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
  'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

/**
 * Converts a decimal amount to Stripe minor units, correctly handling
 * zero-decimal currencies (JPY, KRW, etc.) which must NOT be ×100.
 */
export function toStripeMinorUnits(amount: number, currency: string): number {
  if (STRIPE_ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase())) {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
}
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import {
  CreatePaymentIntentInput,
  PaymentGateway,
  PaymentIntentResult,
} from './payment-gateway.interface';
import { appendStripeCheckoutSessionPaymentMethods, appendStripePaymentIntentPaymentMethods } from './stripe-checkout.util';
import {
  appendStripeCheckoutTaxSettings,
  isStripeTaxEnabled,
  resolveStripeTaxCodeDigital,
} from './stripe-tax.util';
import { resolveAppUrl } from '@/common/app-url';

@Injectable()
export class StripeService implements PaymentGateway {
  readonly providerName = 'stripe';
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {}

  private assertDevMockAllowed(): void {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      throw new ServiceUnavailableException(
        'Payment provider error: STRIPE_SECRET_KEY is not configured. Contact your administrator.',
      );
    }
  }

  private getSecretKey(): string {
    return this.configService.get<string>('STRIPE_SECRET_KEY', '')?.trim() ?? '';
  }

  private async stripePost<T>(
    path: string,
    params: URLSearchParams,
    idempotencyKey?: string,
  ): Promise<T> {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      throw new ServiceUnavailableException('STRIPE_SECRET_KEY is not configured');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const response = await fetch(`https://api.stripe.com/v1${path}`, {
      method: 'POST',
      headers,
      body: params.toString(),
    });

    if (!response.ok) {
      const rawText = await response.text();
      let stripeMessage = `Stripe error on ${path}`;
      try {
        const errBody = JSON.parse(rawText) as { error?: { message?: string; code?: string } };
        if (errBody?.error?.message) {
          stripeMessage = errBody.error.message;
        }
      } catch {
        stripeMessage = rawText.slice(0, 200);
      }
      this.logger.error(`Stripe POST ${path} failed [${response.status}]: ${stripeMessage}`);
      if (response.status >= 500) {
        throw new ServiceUnavailableException(`Payment provider error: ${stripeMessage}`);
      }
      throw new BadRequestException(`Payment configuration error: ${stripeMessage}`);
    }

    return (await response.json()) as T;
  }

  /**
   * Enables Stripe dynamic payment methods (UPI, Google Pay, cards, etc.) for Checkout.
   */
  private appendCheckoutPaymentMethods(
    params: URLSearchParams,
    currency?: string,
  ): void {
    appendStripeCheckoutSessionPaymentMethods(params, currency);
  }

  private appendCheckoutTaxSettings(
    params: URLSearchParams,
    opts: { dynamicPriceData?: boolean; hasCustomer?: boolean } = {},
  ): void {
    appendStripeCheckoutTaxSettings(params, {
      enabled: isStripeTaxEnabled(this.configService.get<string>('STRIPE_TAX_ENABLED')),
      digitalTaxCode: resolveStripeTaxCodeDigital(
        this.configService.get<string>('STRIPE_TAX_CODE_DIGITAL'),
      ),
      dynamicPriceData: opts.dynamicPriceData,
      hasCustomer: opts.hasCustomer,
    });
  }

  private async stripeGet<T>(path: string): Promise<T> {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      throw new ServiceUnavailableException('STRIPE_SECRET_KEY is not configured');
    }

    const response = await fetch(`https://api.stripe.com/v1${path}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    if (!response.ok) {
      const rawText = await response.text();
      let stripeMessage = `Stripe GET error on ${path}`;
      try {
        const errBody = JSON.parse(rawText) as { error?: { message?: string } };
        if (errBody?.error?.message) stripeMessage = errBody.error.message;
      } catch {
        stripeMessage = rawText.slice(0, 200);
      }
      this.logger.error(`Stripe GET ${path} failed [${response.status}]: ${stripeMessage}`);
      if (response.status === 404) throw new BadRequestException(`Stripe resource not found: ${stripeMessage}`);
      throw new BadRequestException(`Payment provider error: ${stripeMessage}`);
    }

    return (await response.json()) as T;
  }

  async createOrRetrieveCustomer(input: {
    email?: string;
    name?: string;
    existingCustomerId?: string | null;
    metadata?: Record<string, string>;
  }): Promise<{ id: string }> {
    if (input.existingCustomerId) {
      return { id: input.existingCustomerId };
    }

    const secretKey = this.getSecretKey();
    if (!secretKey) {
      this.assertDevMockAllowed();
      return { id: `cus_mock_${randomBytes(8).toString('hex')}` };
    }

    const params = new URLSearchParams();
    if (input.email) {
      params.append('email', input.email);
    }
    if (input.name) {
      params.append('name', input.name);
    }
    if (input.metadata) {
      for (const [key, value] of Object.entries(input.metadata)) {
        params.append(`metadata[${key}]`, value);
      }
    }

    return this.stripePost<{ id: string }>('/customers', params);
  }

  async createSubscriptionCheckoutSession(input: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
    couponId?: string;
    /** Presentment currency — enables UPI redirect flow when INR. */
    currency?: string;
  }): Promise<{ id: string; url?: string }> {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      this.assertDevMockAllowed();
      const mockId = `cs_mock_${Date.now()}`;
      return {
        id: mockId,
        url: `${resolveAppUrl(this.configService.get<string>('APP_URL'))}/subscription/success?session_id=${mockId}`,
      };
    }

    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('customer', input.customerId);
    params.append('success_url', input.successUrl);
    params.append('cancel_url', input.cancelUrl);
    params.append('line_items[0][price]', input.priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('subscription_data[metadata][source]', 'umbrella');

    // Intro offer coupon (40% off first month) applied at checkout level
    if (input.couponId) {
      params.append('discounts[0][coupon]', input.couponId);
    }

    if (input.metadata) {
      for (const [key, value] of Object.entries(input.metadata)) {
        params.append(`metadata[${key}]`, value);
        params.append(`subscription_data[metadata][${key}]`, value);
      }
    }

    this.appendCheckoutPaymentMethods(params, input.currency);
    this.appendCheckoutTaxSettings(params, { hasCustomer: true });

    return this.stripePost<{ id: string; url?: string }>('/checkout/sessions', params);
  }

  /**
   * Validates a Stripe coupon for use as a first-month intro offer.
   * Requires duration=once and the expected percent off so a misconfigured
   * coupon (forever/repeating) does not silently become a permanent discount.
   */
  async validateCoupon(
    couponId: string,
    expectedPercentOff?: number,
  ): Promise<boolean> {
    const secretKey = this.getSecretKey();
    if (!secretKey) return false;
    try {
      const coupon = await this.stripeGet<{
        valid?: boolean;
        deleted?: boolean;
        duration?: string;
        percent_off?: number;
      }>(`/coupons/${encodeURIComponent(couponId)}`);

      if (!coupon.valid || coupon.deleted) return false;

      if (coupon.duration !== 'once') {
        this.logger.warn(
          `Intro offer coupon "${couponId}" has duration="${coupon.duration}" — must be "once". Coupon rejected.`,
        );
        return false;
      }

      if (
        expectedPercentOff !== undefined &&
        coupon.percent_off !== expectedPercentOff
      ) {
        this.logger.warn(
          `Intro offer coupon "${couponId}" has percent_off=${coupon.percent_off}, expected ${expectedPercentOff}. Coupon rejected.`,
        );
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  async createBillingPortalSession(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      this.assertDevMockAllowed();
      return {
        url: `${resolveAppUrl(this.configService.get<string>('APP_URL'))}/app/settings/plan-usage`,
      };
    }

    const params = new URLSearchParams();
    params.append('customer', input.customerId);
    params.append('return_url', input.returnUrl);

    const payload = await this.stripePost<{ url: string }>(
      '/billing_portal/sessions',
      params,
    );
    return payload;
  }

  async retrieveCheckoutSession(sessionId: string): Promise<{
    id: string;
    status: string;
    payment_status: string;
    customer?: string | { id?: string };
    subscription?: string | { id?: string };
    metadata?: Record<string, string>;
  }> {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      this.assertDevMockAllowed();
      return {
        id: sessionId,
        status: 'complete',
        payment_status: 'paid',
        customer: `cus_mock_${randomBytes(4).toString('hex')}`,
        subscription: `sub_mock_${randomBytes(4).toString('hex')}`,
        metadata: {},
      };
    }

    return this.stripeGet(
      `/checkout/sessions/${encodeURIComponent(sessionId)}?expand[0]=subscription`,
    );
  }

  async retrieveSubscription(subscriptionId: string): Promise<{
    id: string;
    status: string;
    customer: string;
    metadata?: Record<string, string>;
    items?: {
      data?: Array<{
        price?: { id?: string; metadata?: Record<string, string> };
      }>;
    };
    current_period_end?: number;
  }> {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      this.assertDevMockAllowed();
      return {
        id: subscriptionId,
        status: 'active',
        customer: `cus_mock_${randomBytes(4).toString('hex')}`,
        metadata: {},
      };
    }

    return this.stripeGet(
      `/subscriptions/${encodeURIComponent(subscriptionId)}?expand[0]=items.data.price`,
    );
  }

  extractPlanIdFromStripeSubscription(stripeSub: {
    metadata?: Record<string, string>;
    items?: {
      data?: Array<{
        price?: { id?: string; metadata?: Record<string, string> };
      }>;
    };
  }): string | null {
    if (stripeSub.metadata?.planId) {
      return stripeSub.metadata.planId;
    }
    const price = stripeSub.items?.data?.[0]?.price;
    if (price?.metadata?.planId) {
      return price.metadata.planId;
    }
    return null;
  }

  async createDynamicCheckoutSession(input: {
    /** Optional — omit for guest checkout. */
    customerId?: string;
    email?: string;
    /** Amount in minor units (cents/paise/cents-equivalent). */
    amountMinorUnits: number;
    currency: string;
    productName: string;
    productDescription?: string;
    /** 'payment' for one-off (credit packs, lawyer review), 'subscription' for recurring. */
    mode: 'payment' | 'subscription';
    /** Required for mode='subscription': billing interval. */
    recurringInterval?: 'month' | 'year';
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
    /** Stripe coupon ID to apply at checkout (e.g. first-month intro offer, duration=once). */
    couponId?: string;
  }): Promise<{ id: string; url?: string }> {
    const secretKey = this.getSecretKey();
    if (!secretKey) {
      this.assertDevMockAllowed();
      const mockId = `cs_mock_dyn_${Date.now()}`;
      return {
        id: mockId,
        url: `${resolveAppUrl(this.configService.get<string>('APP_URL'))}/subscription/success?session_id=${mockId}`,
      };
    }

    const params = new URLSearchParams();
    params.append('mode', input.mode);
    params.append('success_url', input.successUrl);
    params.append('cancel_url', input.cancelUrl);

    if (input.customerId) {
      params.append('customer', input.customerId);
    } else if (input.email) {
      params.append('customer_email', input.email);
    }

    // Dynamic price line item — no pre-created Stripe Price ID required
    params.append('line_items[0][quantity]', '1');
    params.append('line_items[0][price_data][currency]', input.currency.toLowerCase());
    params.append('line_items[0][price_data][unit_amount]', String(input.amountMinorUnits));
    params.append('line_items[0][price_data][product_data][name]', input.productName);
    if (input.productDescription) {
      params.append('line_items[0][price_data][product_data][description]', input.productDescription);
    }
    if (input.mode === 'subscription' && input.recurringInterval) {
      params.append('line_items[0][price_data][recurring][interval]', input.recurringInterval);
    }

    if (input.metadata) {
      for (const [key, value] of Object.entries(input.metadata)) {
        params.append(`metadata[${key}]`, value);
        if (input.mode === 'subscription') {
          params.append(`subscription_data[metadata][${key}]`, value);
        } else {
          params.append(`payment_intent_data[metadata][${key}]`, value);
        }
      }
    }

    if (input.couponId) {
      params.append('discounts[0][coupon]', input.couponId);
    }

    this.appendCheckoutPaymentMethods(params, input.currency);
    this.appendCheckoutTaxSettings(params, {
      dynamicPriceData: true,
      hasCustomer: Boolean(input.customerId),
    });

    return this.stripePost<{ id: string; url?: string }>('/checkout/sessions', params);
  }

  async createPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntentResult> {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY', '');

    if (!secretKey) {
      this.assertDevMockAllowed();
      return {
        provider: this.providerName,
        providerPaymentId: `pi_mock_${randomBytes(8).toString('hex')}`,
        clientSecret: `cs_mock_${randomBytes(8).toString('hex')}`,
        status: 'requires_payment_method',
        raw: {
          mock: true,
          amount: input.amount,
          currency: input.currency,
          purpose: input.purpose,
        },
      };
    }

    const params = new URLSearchParams();
    params.append('amount', String(toStripeMinorUnits(input.amount, input.currency)));
    params.append('currency', input.currency.toLowerCase());
    params.append('metadata[purpose]', input.purpose);
    params.append('metadata[countryCode]', input.countryCode);
    appendStripePaymentIntentPaymentMethods(params, input.currency);

    if (input.metadata) {
      for (const [key, value] of Object.entries(input.metadata)) {
        params.append(`metadata[${key}]`, value);
      }
    }

    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stripe payment intent failed: ${errorText}`);
    }

    const payload = (await response.json()) as {
      id: string;
      client_secret?: string;
      status: string;
    };

    return {
      provider: this.providerName,
      providerPaymentId: payload.id,
      clientSecret: payload.client_secret,
      status: payload.status,
      raw: payload,
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET', '');
    if (!webhookSecret || !signature) {
      return false;
    }

    const timestampPart = signature
      .split(',')
      .map((part) => part.trim())
      .find((part) => part.startsWith('t='));
    const v1Part = signature
      .split(',')
      .map((part) => part.trim())
      .find((part) => part.startsWith('v1='));

    if (!timestampPart || !v1Part) {
      return false;
    }

    const timestamp = Number(timestampPart.slice(2));
    if (!Number.isFinite(timestamp)) {
      return false;
    }

    const toleranceSeconds = Number(
      this.configService.get<string>('STRIPE_WEBHOOK_TOLERANCE_SECONDS', '300'),
    );
    const eventAgeSeconds = Math.floor(Date.now() / 1000) - timestamp;
    if (eventAgeSeconds > toleranceSeconds || eventAgeSeconds < -60) {
      return false;
    }

    const expected = createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${payload}`, 'utf8')
      .digest('hex');
    const provided = v1Part.slice(3);

    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(provided, 'hex');
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  async createCustomer(input: { email?: string; metadata?: Record<string, string> }) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY', '');
    if (!secretKey) {
      this.assertDevMockAllowed();
      return { id: `cus_mock_${randomBytes(8).toString('hex')}` };
    }

    const params = new URLSearchParams();
    if (input.email) {
      params.append('email', input.email);
    }
    if (input.metadata) {
      for (const [key, value] of Object.entries(input.metadata)) {
        params.append(`metadata[${key}]`, value);
      }
    }

    const response = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Stripe customer create failed: ${await response.text()}`);
    }

    return (await response.json()) as { id: string };
  }

  async createSetupIntent(customerId: string) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY', '');
    if (!secretKey) {
      this.assertDevMockAllowed();
      return {
        clientSecret: `seti_mock_${randomBytes(8).toString('hex')}`,
        setupIntentId: `seti_mock_${randomBytes(8).toString('hex')}`,
      };
    }

    const params = new URLSearchParams();
    params.append('customer', customerId);
    params.append('payment_method_types[]', 'card');
    params.append('usage', 'off_session');

    const response = await fetch('https://api.stripe.com/v1/setup_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Stripe setup intent failed: ${await response.text()}`);
    }

    const payload = (await response.json()) as { id: string; client_secret?: string };
    return { clientSecret: payload.client_secret, setupIntentId: payload.id };
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY', '');
    if (!secretKey) {
      this.assertDevMockAllowed();
      return { success: true };
    }

    const attachParams = new URLSearchParams();
    attachParams.append('customer', customerId);
    const attachResponse = await fetch(
      `https://api.stripe.com/v1/payment_methods/${paymentMethodId}/attach`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: attachParams.toString(),
      },
    );
    if (!attachResponse.ok) {
      throw new Error(`Stripe attach payment method failed: ${await attachResponse.text()}`);
    }

    const defaultParams = new URLSearchParams();
    defaultParams.append('invoice_settings[default_payment_method]', paymentMethodId);
    await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: defaultParams.toString(),
    });

    return { success: true };
  }

  async detachPaymentMethod(paymentMethodId: string) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY', '');
    if (!secretKey) {
      this.assertDevMockAllowed();
      return { success: true };
    }

    const response = await fetch(
      `https://api.stripe.com/v1/payment_methods/${paymentMethodId}/detach`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Stripe detach payment method failed: ${await response.text()}`);
    }

    return { success: true };
  }

  async getPaymentMethodDetails(paymentMethodId: string): Promise<{
    last4: string;
    brand: string;
  } | null> {
    try {
      const pm = await this.stripeGet<{ card?: { last4?: string; brand?: string } }>(
        `/payment_methods/${paymentMethodId}`,
      );
      if (!pm.card) return null;
      return { last4: pm.card.last4 ?? '', brand: pm.card.brand ?? 'card' };
    } catch {
      return null;
    }
  }

  async chargeOffSession(input: {
    amount: number;
    currency: string;
    customerId: string;
    paymentMethodId: string;
    purpose: string;
    idempotencyKey: string;
    metadata?: Record<string, string>;
  }) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY', '');
    if (!secretKey) {
      this.assertDevMockAllowed();
      return {
        provider: this.providerName,
        providerPaymentId: `pi_mock_${randomBytes(8).toString('hex')}`,
        status: 'succeeded',
      };
    }

    const params = new URLSearchParams();
    params.append('amount', String(toStripeMinorUnits(input.amount, input.currency)));
    params.append('currency', input.currency.toLowerCase());
    params.append('customer', input.customerId);
    params.append('payment_method', input.paymentMethodId);
    params.append('off_session', 'true');
    params.append('confirm', 'true');
    params.append('metadata[purpose]', input.purpose);
    if (input.metadata) {
      for (const [key, value] of Object.entries(input.metadata)) {
        params.append(`metadata[${key}]`, value);
      }
    }

    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Stripe off-session charge failed: ${await response.text()}`);
    }

    const payload = (await response.json()) as { id: string; status: string };
    return {
      provider: this.providerName,
      providerPaymentId: payload.id,
      status: payload.status,
    };
  }

  /**
   * Updates or adds a subscription item for a specific user seat on a Stripe subscription.
   * Uses Stripe's built-in proration so mid-cycle plan changes are billed correctly.
   */
  async updateSubscriptionItemForUser(
    subscriptionId: string,
    userId: string,
    priceId: string,
  ): Promise<void> {
    const secretKey = this.getSecretKey();
    if (!secretKey || !priceId) return;

    // Fetch existing subscription items
    const subResponse = await fetch(
      `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    if (!subResponse.ok) return;

    const sub = (await subResponse.json()) as {
      items: { data: Array<{ id: string; metadata: Record<string, string> }> };
    };

    // Look for an existing item tagged to this user
    const existingItem = sub.items.data.find((item) => item.metadata?.userId === userId);

    if (existingItem) {
      // Update the existing seat item's price
      const params = new URLSearchParams();
      params.append('price', priceId);
      params.append('proration_behavior', 'create_prorations');
      params.append('metadata[userId]', userId);

      await fetch(`https://api.stripe.com/v1/subscription_items/${existingItem.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
    } else {
      // Add a new seat item for this user
      const params = new URLSearchParams();
      params.append('subscription', subscriptionId);
      params.append('price', priceId);
      params.append('proration_behavior', 'create_prorations');
      params.append('metadata[userId]', userId);

      await fetch(`https://api.stripe.com/v1/subscription_items`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
    }
  }
}
