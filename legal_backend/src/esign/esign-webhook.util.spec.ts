import { createHmac } from 'crypto';
import {
  verifyAdobeSignWebhookClientId,
  verifyDocuSignWebhookSignature,
} from './esign-webhook.util';

describe('verifyDocuSignWebhookSignature', () => {
  const payload = JSON.stringify({ envelopeId: 'env-123', status: 'completed' });
  const secret = 'docusign_webhook_secret';

  it('accepts a valid HMAC signature', () => {
    const signature = createHmac('sha256', secret).update(payload, 'utf8').digest('base64');

    expect(verifyDocuSignWebhookSignature(payload, signature, secret)).toBe(true);
  });

  it('rejects missing or invalid signatures', () => {
    expect(verifyDocuSignWebhookSignature(payload, undefined, secret)).toBe(false);
    expect(verifyDocuSignWebhookSignature(payload, 'bad-signature', secret)).toBe(false);
    expect(verifyDocuSignWebhookSignature(payload, 'bad-signature', '')).toBe(false);
  });
});

describe('verifyAdobeSignWebhookClientId', () => {
  const expectedClientId = 'adobe-integration-key';

  it('accepts a matching client ID', () => {
    expect(verifyAdobeSignWebhookClientId(expectedClientId, expectedClientId)).toBe(true);
  });

  it('rejects missing or mismatched client IDs', () => {
    expect(verifyAdobeSignWebhookClientId(undefined, expectedClientId)).toBe(false);
    expect(verifyAdobeSignWebhookClientId('wrong-id', expectedClientId)).toBe(false);
    expect(verifyAdobeSignWebhookClientId(expectedClientId, '')).toBe(false);
  });
});
