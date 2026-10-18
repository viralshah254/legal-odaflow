"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { getMeCounts, EMPTY_COUNTS, type MeCounts } from "@/lib/api/counts"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useRealtimeEvent } from "@/lib/contexts/realtime-context"
import { REALTIME_EVENTS } from "@/lib/realtime/events"

const COUNTS_QUERY_KEY = "me-counts"

/**
 * Live aggregate counts for nav badges and the dashboard. Refetches on the
 * realtime events that can change any count, and always resolves to a value
 * (zeros on error) so consumers never have to null-check.
 */
export function useCounts(): MeCounts {
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()

  const { data } = useApiData<MeCounts>(
    [COUNTS_QUERY_KEY, activeTenantId],
    {
      apiFn: () => getMeCounts(activeTenantId!),
      enabled: !!activeTenantId,
      staleTime: 30_000,
      refetchInterval: 60_000,
    },
  )

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [COUNTS_QUERY_KEY, activeTenantId] })
  }, [queryClient, activeTenantId])

  useRealtimeEvent(REALTIME_EVENTS.NOTIFICATION_CREATED, invalidate)
  useRealtimeEvent(REALTIME_EVENTS.TASK_CREATED, invalidate)
  useRealtimeEvent(REALTIME_EVENTS.TASK_UPDATED, invalidate)
  useRealtimeEvent(REALTIME_EVENTS.TASK_DELETED, invalidate)
  useRealtimeEvent(REALTIME_EVENTS.LEAD_CREATED, invalidate)
  useRealtimeEvent(REALTIME_EVENTS.LEAD_UPDATED, invalidate)
  useRealtimeEvent(REALTIME_EVENTS.ALERT_CREATED, invalidate)
  useRealtimeEvent(REALTIME_EVENTS.ALERT_UPDATED, invalidate)

  return data ?? EMPTY_COUNTS
}
