import { setTimeout as delay } from 'node:timers/promises';
import { assertResearchBudgetActive, researchRequestSignal } from '@/common/utils/research-execution-budget';
/** Shared polite pacing for Kenya Law HTTP requests (catalog, acts, search). */
const DEFAULT_DELAY_MS = 200;
const DEFAULT_MAX_CONCURRENT = 2;
const THROTTLE_BACKOFF_MS = [5_000, 15_000, 45_000] as const;

let configuredDelayMs = DEFAULT_DELAY_MS;

/** Sliding-window timestamps of recently started requests. */
const recentStarts: number[] = [];

export function configureKenyaLawRateLimit(delayMs: number): void {
  configuredDelayMs = Math.max(0, delayMs);
}

export function kenyaLawRequestDelayMs(): number {
  return configuredDelayMs;
}

/**
 * Wait until a Kenya Law request slot is available.
 * Allows up to DEFAULT_MAX_CONCURRENT requests to start within any
 * configuredDelayMs window — much faster than the old global serial chain.
 */
export async function kenyaLawRateLimit(maxConcurrent = DEFAULT_MAX_CONCURRENT): Promise<void> {
  while (true) {
    assertResearchBudgetActive();
    const now = Date.now();
    const windowStart = now - configuredDelayMs;
    // Remove timestamps that have aged out of the window.
    while (recentStarts.length > 0 && recentStarts[0] <= windowStart) {
      recentStarts.shift();
    }
    if (recentStarts.length < maxConcurrent) {
      recentStarts.push(now);
      return;
    }
    // Wait until the oldest slot clears the window.
    const waitMs = recentStarts[0] + configuredDelayMs - now;
    await sleep(Math.max(1, waitMs));
  }
}

/** Exponential backoff after 429/503 before retrying. */
export async function kenyaLawThrottleBackoff(status: number, attempt: number): Promise<void> {
  if (status !== 429 && status !== 503) return;
  const idx = Math.min(Math.max(attempt - 1, 0), THROTTLE_BACKOFF_MS.length - 1);
  await sleep(THROTTLE_BACKOFF_MS[idx]);
}

export function isKenyaLawRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status >= 500;
}

export function kenyaLawFetchHeaders(
  accept = 'text/html,application/xhtml+xml',
): Record<string, string> {
  return {
    Accept: accept,
    'User-Agent': 'UmbrellaLegal/1.0 (+https://okaylegal.ai)',
  };
}

function sleep(ms: number): Promise<void> {
  return delay(ms, undefined, { signal: researchRequestSignal() });
}
