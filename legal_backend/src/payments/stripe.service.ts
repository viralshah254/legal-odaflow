import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import {
  CreatePaymentIntentInput,
  PaymentGateway,
  PaymentIntentResult,
} from './payment-gateway.interface';

@Injectable()
export class StripeService implements PaymentGateway {
  readonly providerName = 'stripe';

  constructor(private readonly configService: ConfigService) {}

  private assertDevMockAllowed(): void {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      throw new ServiceUnavailableException(
        'STRIPE_SECRET_KEY is required in production',
      );
    }
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
    params.append('amount', String(Math.round(input.amount * 100)));
    params.append('currency', input.currency.toLowerCase());
    params.append('metadata[purpose]', input.purpose);
    params.append('metadata[countryCode]', input.countryCode);

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

    const timestamp = timestampPart.slice(2);
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
    params.append('amount', String(Math.round(input.amount * 100)));
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
}
