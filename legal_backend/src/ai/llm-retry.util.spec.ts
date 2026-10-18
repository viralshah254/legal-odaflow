import { isRateLimitError, parseRetryAfterMs } from './llm-retry.util';

describe('llm-retry.util', () => {
  it('detects OpenAI TPM rate limit payloads', () => {
    const body =
      'Rate limit reached for gpt-4.1 ... Please try again in 2.484s. code: rate_limit_exceeded';
    expect(isRateLimitError(429, body)).toBe(true);
    expect(parseRetryAfterMs(body)).toBeGreaterThanOrEqual(2700);
  });

  it('returns default backoff when no hint present', () => {
    expect(parseRetryAfterMs('unknown error', 5000)).toBe(5000);
  });
});
