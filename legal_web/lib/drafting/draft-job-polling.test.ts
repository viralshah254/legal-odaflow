import { describe, expect, it } from "vitest"
import { ApiClientError } from "@/lib/api/client"
import {
  isRetryableDraftPollError,
  nextDraftJobPollDelayMs,
  DRAFT_JOB_POLL_INTERVAL_MS,
  DRAFT_JOB_MAX_POLL_BACKOFF_MS,
} from "./draft-job-polling"

describe("isRetryableDraftPollError", () => {
  it("retries generic 500 database errors", () => {
    expect(
      isRetryableDraftPollError(
        new ApiClientError("An unexpected database error occurred.", 500, {
          error: { code: "DB_ERROR", retryable: false },
        }),
      ),
    ).toBe(true)
  })

  it("retries explicit retryable API errors", () => {
    expect(
      isRetryableDraftPollError(
        new ApiClientError("Database is waking up", 503, {
          error: { retryable: true },
        }),
      ),
    ).toBe(true)
  })

  it("does not retry auth or not-found failures", () => {
    expect(isRetryableDraftPollError(new ApiClientError("Unauthorized", 401))).toBe(false)
    expect(isRetryableDraftPollError(new ApiClientError("Not found", 404))).toBe(false)
  })

  it("retries fetch timeouts", () => {
    const err = new Error("The operation was aborted")
    err.name = "AbortError"
    expect(isRetryableDraftPollError(err)).toBe(true)
  })
})

describe("nextDraftJobPollDelayMs", () => {
  it("uses base interval when healthy", () => {
    expect(nextDraftJobPollDelayMs(0)).toBe(DRAFT_JOB_POLL_INTERVAL_MS)
  })

  it("caps backoff for repeated failures", () => {
    expect(nextDraftJobPollDelayMs(20)).toBeLessThanOrEqual(DRAFT_JOB_MAX_POLL_BACKOFF_MS)
  })
})
