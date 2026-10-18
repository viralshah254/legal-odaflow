"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ApiClientError, buildAuthHeaders, apiFetch } from "@/lib/api/client"
import { extractApiErrorMessage, USER_CONNECTION_ERROR } from "@/lib/errors/user-facing-messages"
import {
  DRAFT_JOB_MAX_POLL_DURATION_MS,
  DRAFT_JOB_STATUS_FETCH_TIMEOUT_MS,
  isRetryableDraftPollError,
  nextDraftJobPollDelayMs,
} from "@/lib/drafting/draft-job-polling"
import { fetchDraftJobResult, cancelDraftJob } from "@/lib/api/india-drafting"
import type { GenerateIndiaDraftResponse } from "@/lib/api/india-drafting"

export interface DraftJobProgress {
  jobId: string
  status: string
  stage: string
  percent: number
  message: string
  completedSections?: number
  totalSections?: number
  error?: string
  blockedReason?: string
  failureReason?: string
  timestamp: string
}

export interface UseDraftJobResult {
  progress: DraftJobProgress | null
  result: GenerateIndiaDraftResponse | null
  error: string | null
  cancel: () => void
}

const TERMINAL_STATUSES = new Set(["ready", "failed", "cancelled", "blocked"])
const RETRY_STATUS_MESSAGE = "Still generating — reconnecting to check status…"

/**
 * Tracks an async unified draft job (v3 engine) by polling the status endpoint
 * every 1.5 s. When status reaches "ready", automatically fetches the assembled
 * result and exposes it as `result`. Cleans up on unmount.
 */
export function useDraftJob(
  jobId: string | null,
  tenantId?: string,
): UseDraftJobResult {
  const [progress, setProgress] = useState<DraftJobProgress | null>(null)
  const [result, setResult] = useState<GenerateIndiaDraftResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cancelledRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    stopPolling()
    if (jobId) {
      cancelDraftJob(jobId, tenantId).catch(() => {})
    }
  }, [jobId, tenantId, stopPolling])

  useEffect(() => {
    if (!jobId) return
    const resolvedJobId = jobId

    cancelledRef.current = false
    setProgress(null)
    setResult(null)
    setError(null)

    const directOrigin =
      typeof window !== "undefined"
        ? (process.env.NEXT_PUBLIC_WS_URL ?? "").replace(/\/$/, "")
        : ""
    const useDirectFetch =
      Boolean(directOrigin) && !/localhost|127\.0\.0\.1/.test(directOrigin)

    async function fetchStatus(): Promise<DraftJobProgress & { status: string }> {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), DRAFT_JOB_STATUS_FETCH_TIMEOUT_MS)

      try {
        if (useDirectFetch) {
          const headers = await buildAuthHeaders(true, tenantId)
          const res = await fetch(`${directOrigin}/api/v1/draft-jobs/${resolvedJobId}`, {
            headers,
            signal: controller.signal,
          })
          if (!res.ok) {
            const body = await res.json().catch(() => null)
            const fallback = res.status === 502 ? USER_CONNECTION_ERROR : res.statusText
            throw new ApiClientError(
              extractApiErrorMessage(body, fallback || "Request failed"),
              res.status,
              body,
            )
          }
          return res.json() as Promise<DraftJobProgress & { status: string }>
        }

        return apiFetch<DraftJobProgress & { status: string }>(`/draft-jobs/${resolvedJobId}`, {
          tenantId,
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeoutId)
      }
    }

    async function fetchResultWithRetry(): Promise<GenerateIndiaDraftResponse> {
      let consecutiveFailures = 0

      while (!cancelledRef.current) {
        if (Date.now() - startedAt > DRAFT_JOB_MAX_POLL_DURATION_MS) {
          throw new Error(
            "Draft generation is taking longer than expected. Please try again in a few minutes.",
          )
        }

        try {
          return await fetchDraftJobResult(resolvedJobId, tenantId)
        } catch (err) {
          consecutiveFailures += 1
          if (!isRetryableDraftPollError(err)) {
            throw err instanceof Error ? err : new Error("Failed to load draft result.")
          }
          await new Promise<void>((resolve) => {
            timerRef.current = setTimeout(resolve, nextDraftJobPollDelayMs(consecutiveFailures))
          })
        }
      }

      throw new Error("Draft generation was cancelled.")
    }

    const startedAt = Date.now()
    let consecutiveFailures = 0

    async function poll() {
      if (cancelledRef.current) return

      if (Date.now() - startedAt > DRAFT_JOB_MAX_POLL_DURATION_MS) {
        setError(
          "Draft generation is taking longer than expected. Please try again in a few minutes.",
        )
        return
      }

      try {
        const data = await fetchStatus()
        if (cancelledRef.current) return

        consecutiveFailures = 0
        setProgress(data)

        if (data.status === "ready") {
          const jobResult = await fetchResultWithRetry()
          if (!cancelledRef.current) setResult(jobResult)
          return
        }

        if (data.status === "failed") {
          setError(data.error ?? "Draft generation failed. Please try again.")
          return
        }

        if (data.status === "cancelled") {
          setError("Draft generation was cancelled.")
          return
        }

        if (data.status === "blocked") {
          const reason =
            data.blockedReason ??
            data.error ??
            "Additional information is required to continue drafting."
          setError(reason)
          return
        }

        if (!TERMINAL_STATUSES.has(data.status)) {
          timerRef.current = setTimeout(poll, nextDraftJobPollDelayMs(0))
        }
      } catch (err) {
        if (cancelledRef.current) return

        consecutiveFailures += 1
        if (!isRetryableDraftPollError(err)) {
          setError(err instanceof Error ? err.message : "Failed to check draft status.")
          return
        }

        setProgress((prev) =>
          prev
            ? { ...prev, message: RETRY_STATUS_MESSAGE }
            : {
                jobId: resolvedJobId,
                status: "running",
                stage: "running",
                percent: 0,
                message: RETRY_STATUS_MESSAGE,
                timestamp: new Date().toISOString(),
              },
        )

        timerRef.current = setTimeout(poll, nextDraftJobPollDelayMs(consecutiveFailures))
      }
    }

    poll()

    return () => {
      stopPolling()
    }
  }, [jobId, tenantId, stopPolling])

  return { progress, result, error, cancel }
}
