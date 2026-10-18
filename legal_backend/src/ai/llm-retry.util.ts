export function isRateLimitError(status: number, errorText: string): boolean {
  if (status === 429) return true;
  const normalized = errorText.toLowerCase();
  return (
    normalized.includes('rate_limit') ||
    normalized.includes('rate limit') ||
    normalized.includes('tokens per min') ||
    normalized.includes('requests per min')
  );
}

/** Parse OpenAI/Anthropic "try again in Xs" hints; default 3s buffer. */
export function parseRetryAfterMs(errorText: string, fallbackMs = 3000): number {
  const secondsMatch = errorText.match(/try again in ([\d.]+)\s*s/i);
  if (secondsMatch) {
    return Math.ceil(parseFloat(secondsMatch[1]) * 1000) + 250;
  }
  const msMatch = errorText.match(/retry-after[":\s]+(\d+)/i);
  if (msMatch) {
    const value = parseInt(msMatch[1], 10);
    return value > 1000 ? value : value * 1000;
  }
  return fallbackMs;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason ?? new Error('The operation was aborted'));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error('The operation was aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof Error && (err.name === 'AbortError' || /aborted/i.test(err.message))) ||
    (typeof DOMException !== 'undefined' &&
      err instanceof DOMException &&
      err.name === 'AbortError')
  );
}

export const LLM_DEADLINE_MESSAGE =
  'Research drafting exceeded the mode deadline; returning a first-pass note.';

export interface RateLimitRetryOptions {
  maxAttempts?: number;
  onRateLimitExhausted?: (errorText: string) => never;
}

export async function postWithRateLimitRetry(
  url: string,
  init: RequestInit,
  providerLabel: string,
  options: RateLimitRetryOptions = {},
): Promise<Response> {
  // More patient retry strategy: up to 12 attempts with exponential + jitter backoff,
  // so transient provider rate limits are handled silently rather than surfaced to users.
  const maxAttempts = options.maxAttempts ?? 12;
  let lastErrorText = '';

  const signal = init.signal;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      throw signal.reason instanceof Error
        ? signal.reason
        : new Error(LLM_DEADLINE_MESSAGE);
    }
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      if (isAbortError(err) || signal?.aborted) {
        throw new Error(LLM_DEADLINE_MESSAGE);
      }
      throw err;
    }

    if (response.ok) {
      return response;
    }

    lastErrorText = await response.text();

    if (isRateLimitError(response.status, lastErrorText) && attempt < maxAttempts - 1) {
      // Exponential backoff: respect provider hint + per-attempt increase + jitter
      const hint = parseRetryAfterMs(lastErrorText);
      const backoff = Math.min(hint + attempt * 1000 + Math.random() * 500, 30000);
      await sleep(backoff, signal ?? undefined);
      continue;
    }

    if (isRateLimitError(response.status, lastErrorText)) {
      if (options.onRateLimitExhausted) {
        options.onRateLimitExhausted(lastErrorText);
      }
      throw new Error(`${providerLabel} rate limit reached: ${lastErrorText}`);
    }

    throw new Error(`${providerLabel} request failed: ${lastErrorText}`);
  }

  if (isRateLimitError(429, lastErrorText)) {
    if (options.onRateLimitExhausted) {
      options.onRateLimitExhausted(lastErrorText);
    }
    throw new Error(`${providerLabel} rate limit reached: ${lastErrorText}`);
  }
  throw new Error(`${providerLabel} request failed: ${lastErrorText}`);
}
