import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { StripeService } from './stripe.service';

describe('StripeService.verifyWebhookSignature', () => {
  const configService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test_secret';
      if (key === 'STRIPE_WEBHOOK_TOLERANCE_SECONDS') return '300';
      return defaultValue;
    }),
  };

  const service = new StripeService(configService as unknown as ConfigService);

  function sign(payload: string, timestamp: number): string {
    const digest = createHmac('sha256', 'whsec_test_secret')
      .update(`${timestamp}.${payload}`, 'utf8')
      .digest('hex');
    return `t=${timestamp},v1=${digest}`;
  }

  it('accepts recent webhook signatures', () => {
    const payload = '{"id":"evt_123"}';
    const timestamp = Math.floor(Date.now() / 1000);
    expect(service.verifyWebhookSignature(payload, sign(payload, timestamp))).toBe(true);
  });

  it('rejects webhook signatures older than the tolerance window', () => {
    const payload = '{"id":"evt_old"}';
    const timestamp = Math.floor(Date.now() / 1000) - 600;
    expect(service.verifyWebhookSignature(payload, sign(payload, timestamp))).toBe(false);
  });
});
