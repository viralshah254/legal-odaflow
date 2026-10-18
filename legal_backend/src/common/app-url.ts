/** Canonical public web origin for Umbrella (marketing + app). */
export const DEFAULT_APP_URL = 'https://umbrella.okaylegal.ai';

/** Resolve APP_URL for emails, Stripe redirects, referral links, etc. */
export function resolveAppUrl(configured?: string | null): string {
  const raw = configured?.trim();
  if (!raw) {
    return DEFAULT_APP_URL;
  }

  // Never use localhost for customer-facing redirects unless explicitly allowed (local dev).
  const allowLocalhost =
    process.env.ALLOW_LOCALHOST_APP_URL === 'true' &&
    process.env.NODE_ENV !== 'production';
  if (
    !allowLocalhost &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(raw)
  ) {
    return DEFAULT_APP_URL;
  }

  return raw.replace(/\/$/, '');
}

export function buildReferralShareUrl(appUrl: string, code: string): string {
  const params = new URLSearchParams({ ref: code.toUpperCase() });
  return `${appUrl}/?${params.toString()}`;
}
