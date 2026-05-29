import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import {
  CreatePaymentIntentInput,
  PaymentGateway,
  PaymentIntentResult,
} from './payment-gateway.interface';

@Injectable()
export class RazorpayService implements PaymentGateway {
  readonly providerName = 'razorpay';

  constructor(private readonly configService: ConfigService) {}

  async createPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntentResult> {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID', '');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET', '');

    if (!keyId || !keySecret) {
      return {
        provider: this.providerName,
        providerPaymentId: `order_mock_${randomBytes(8).toString('hex')}`,
        checkoutUrl: `https://checkout.razorpay.com/mock/${randomBytes(6).toString('hex')}`,
        status: 'created',
        raw: {
          mock: true,
          amount: input.amount,
          currency: input.currency,
          purpose: input.purpose,
        },
      };
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const amountMinor = input.currency.toUpperCase() === 'INR'
      ? Math.round(input.amount * 100)
      : Math.round(input.amount * 100);

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountMinor,
        currency: input.currency.toUpperCase(),
        notes: {
          purpose: input.purpose,
          countryCode: input.countryCode,
          ...input.metadata,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Razorpay order creation failed: ${errorText}`);
    }

    const payload = (await response.json()) as {
      id: string;
      status: string;
    };

    return {
      provider: this.providerName,
      providerPaymentId: payload.id,
      checkoutUrl: `https://checkout.razorpay.com/v1/checkout.js?order_id=${payload.id}`,
      status: payload.status,
      raw: payload,
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const webhookSecret =
      this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET', '') ||
      this.configService.get<string>('RAZORPAY_KEY_SECRET', '');

    if (!webhookSecret || !signature) {
      return false;
    }

    const expected = createHmac('sha256', webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(signature, 'hex');
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  }
}
