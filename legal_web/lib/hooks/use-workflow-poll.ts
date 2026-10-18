"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'error'])

interface WorkflowPollOptions {
  pollIntervalMs?: number
  onComplete?: (workflow: unknown) => void
  onError?: (error: unknown) => void
}

interface WorkflowPollResult {
  workflow: unknown
  isPolling: boolean
  error: unknown
}

export function useWorkflowPoll(
  workflowId: string | undefined,
  options: WorkflowPollOptions = {},
): WorkflowPollResult {
  const { pollIntervalMs = 3000, onComplete, onError } = options

  const { data, error, isFetching } = useQuery({
    queryKey: ['workflows', workflowId],
    queryFn: async () => apiFetch<{ status?: string }>(`/workflows/${workflowId!}`),
    enabled: !!workflowId,
    refetchInterval: (query) => {
      const status = (query.state.data as { status?: string } | undefined)?.status
      if (!status || TERMINAL_STATUSES.has(status)) return false
      return pollIntervalMs
    },
    refetchIntervalInBackground: false,
  })

  // Fire callbacks on status changes
  const status = (data as { status?: string } | undefined)?.status
  if (status && TERMINAL_STATUSES.has(status)) {
    if (status === 'completed' && onComplete) {
      onComplete(data)
    }
    if ((status === 'failed' || status === 'error' || status === 'cancelled') && onError) {
      onError(data)
    }
  }

  const isTerminal = !!status && TERMINAL_STATUSES.has(status)

  return {
    workflow: data ?? null,
    isPolling: !!workflowId && isFetching && !isTerminal,
    error,
  }
}
