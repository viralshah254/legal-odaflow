import { ApiClientError } from "@/lib/api/client"

export const DRAFT_JOB_POLL_INTERVAL_MS = 1500
export const DRAFT_JOB_MAX_POLL_BACKOFF_MS = 5000
export const DRAFT_JOB_STATUS_FETCH_TIMEOUT_MS = 15_000
/** Unified draft jobs can run several minutes; keep polling through transient API/DB hiccups. */
export const DRAFT_JOB_MAX_POLL_DURATION_MS = 10 * 60 * 1000

function readRetryableFlag(body: unknown): boolean | undefined {
  if (!body || typeof body !== "object") return undefined
  const nested = (body as Record<string, unknown>).error
  if (!nested || typeof nested !== "object") return undefined
  const retryable = (nested as Record<string, unknown>).retryable
  return typeof retryable === "boolean" ? retryable : undefined
}

/** Whether a status/result poll failure should be retried instead of failing the draft UX. */
export function isRetryableDraftPollError(err: unknown): boolean {
  if (err instanceof ApiClientError) {
    if (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 404) return false
    if (err.statusCode === 429 || err.statusCode >= 500) return true

    const retryable = readRetryableFlag(err.body)
    if (retryable === true) return true
    return false
  }

  if (err instanceof Error) {
    if (err.name === "AbortError") return true
    if (/network error|failed to fetch|timeout|status check failed:\s*5/i.test(err.message)) {
      return true
    }
  }

  // Unknown errors during long-running jobs are usually transient infra noise.
  return true
}

export function nextDraftJobPollDelayMs(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return DRAFT_JOB_POLL_INTERVAL_MS
  const scaled = DRAFT_JOB_POLL_INTERVAL_MS * 1.5 ** Math.min(consecutiveFailures, 6)
  return Math.min(Math.round(scaled), DRAFT_JOB_MAX_POLL_BACKOFF_MS)
}
