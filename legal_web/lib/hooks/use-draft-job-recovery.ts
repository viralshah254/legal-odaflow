"use client";

/**
 * useDraftJobRecovery — persists the active draft jobId in sessionStorage
 * so that if the user navigates away and returns, the job can be
 * re-attached without losing progress.
 *
 * C13: recovery spec requirement —
 *   "client/file journey, review tasks and filing release" must survive
 *   page refreshes and tab restores.
 *
 * Usage:
 *   const { jobId, setJobId, clearJob } = useDraftJobRecovery(matterId)
 *   // Pass jobId to useDraftJob; call clearJob() when job completes or errors.
 */

import { useCallback, useEffect, useState } from "react";

const SESSION_KEY_PREFIX = "draft_recovery_job";

function makeKey(matterId: string | null | undefined): string {
  return `${SESSION_KEY_PREFIX}:${matterId ?? "unassigned"}`;
}

export interface UseDraftJobRecoveryResult {
  /** The recovered or newly set jobId (null if none) */
  jobId: string | null;
  /** Persist a new jobId for recovery */
  setJobId: (id: string) => void;
  /** Clear the persisted jobId (call on terminal state: ready/failed/cancelled) */
  clearJob: () => void;
  /** True while sessionStorage has not yet been read (SSR guard) */
  hydrating: boolean;
}

/**
 * @param matterId  Used to namespace the sessionStorage key so concurrent
 *                  browser tabs on different matters don't collide.
 */
export function useDraftJobRecovery(
  matterId?: string | null,
): UseDraftJobRecoveryResult {
  const [jobId, setJobIdState] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(true);

  // On mount, read any persisted jobId from sessionStorage
  useEffect(() => {
    try {
      const key = makeKey(matterId);
      const stored = sessionStorage.getItem(key);
      if (stored) setJobIdState(stored);
    } catch {
      // sessionStorage unavailable (SSR, private mode, cross-origin iframe)
    } finally {
      setHydrating(false);
    }
  }, [matterId]);

  const setJobId = useCallback(
    (id: string) => {
      setJobIdState(id);
      try {
        sessionStorage.setItem(makeKey(matterId), id);
      } catch {
        // Best-effort
      }
    },
    [matterId],
  );

  const clearJob = useCallback(() => {
    setJobIdState(null);
    try {
      sessionStorage.removeItem(makeKey(matterId));
    } catch {
      // Best-effort
    }
  }, [matterId]);

  return { jobId, setJobId, clearJob, hydrating };
}
