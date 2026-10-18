import { createHmac, timingSafeEqual } from 'crypto';

export function verifyDocuSignWebhookSignature(
  payload: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!secret || !signature) {
    return false;
  }

  const expected = createHmac('sha256', secret).update(payload, 'utf8').digest('base64');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');

  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

export function verifyAdobeSignWebhookClientId(
  clientId: string | undefined,
  expectedClientId: string,
): boolean {
  if (!clientId || !expectedClientId) {
    return false;
  }

  const clientBuffer = Buffer.from(clientId, 'utf8');
  const expectedBuffer = Buffer.from(expectedClientId, 'utf8');

  return (
    clientBuffer.length === expectedBuffer.length &&
    timingSafeEqual(clientBuffer, expectedBuffer)
  );
}

export function getHeaderValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
