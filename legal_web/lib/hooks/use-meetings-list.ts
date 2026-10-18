"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"
import { listMeetingsPage } from "@/lib/api/meetings"
import { apiMeetingToMeeting } from "@/lib/meetings/api-meeting-to-meeting"
import type { Meeting } from "@/lib/types/meetings"

export type MeetingDateFilter = "all" | "today" | "week" | "month" | "custom"

export type CustomDateRange = { from: Date; to: Date }

export const MEETINGS_PAGE_SIZE = 20

function formatDateParam(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function dateRangeFromFilter(
  filter: MeetingDateFilter,
  customRange?: CustomDateRange | null,
): { dateFrom: string | null; dateTo: string | null } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (filter) {
    case "today": {
      const d = formatDateParam(today)
      return { dateFrom: d, dateTo: d }
    }
    case "week":
      return {
        dateFrom: formatDateParam(new Date(today.getTime() - 7 * 86_400_000)),
        dateTo: formatDateParam(today),
      }
    case "month":
      return {
        dateFrom: formatDateParam(new Date(today.getTime() - 30 * 86_400_000)),
        dateTo: formatDateParam(today),
      }
    case "custom":
      if (!customRange) return { dateFrom: null, dateTo: null }
      return {
        dateFrom: formatDateParam(customRange.from),
        dateTo: formatDateParam(customRange.to),
      }
    default:
      return { dateFrom: null, dateTo: null }
  }
}

export function useMeetingsList(options: {
  tenantId: string | null | undefined
  clientId?: string
  matterId?: string
  enabled?: boolean
}) {
  const { tenantId, clientId, matterId, enabled = true } = options

  const [searchInput, setSearchInput] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<MeetingDateFilter>("all")
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange | null>(null)
  const [page, setPage] = useState(1)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(searchInput.trim()), 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const { dateFrom, dateTo } = useMemo(
    () => dateRangeFromFilter(dateFilter, customDateRange),
    [dateFilter, customDateRange],
  )

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, statusFilter, dateFrom, dateTo, clientId, matterId])

  const queryKey = useMemo(
    () => [
      "meetings",
      tenantId,
      clientId ?? null,
      matterId ?? null,
      debouncedQ,
      statusFilter,
      dateFrom,
      dateTo,
      page,
    ],
    [tenantId, clientId, matterId, debouncedQ, statusFilter, dateFrom, dateTo, page],
  )

  const {
    data,
    isFetching,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: [...queryKey, "page"],
    queryFn: () =>
      listMeetingsPage(tenantId!, {
        clientId,
        matterId,
        q: debouncedQ || undefined,
        status: statusFilter ?? undefined,
        dateFrom: dateFrom ?? undefined,
        dateTo: dateTo ?? undefined,
        page,
        limit: MEETINGS_PAGE_SIZE,
      }),
    enabled: !!tenantId && enabled,
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    if (data?.items.length != null) {
      setHasLoadedOnce(true)
    }
  }, [data])

  const meetings: Meeting[] = useMemo(
    () => (data?.items ?? []).map((m) => apiMeetingToMeeting(m)),
    [data],
  )

  const total = data?.total ?? 0
  const totalPages = total > 0 ? Math.ceil(total / MEETINGS_PAGE_SIZE) : 1
  const rangeFrom = total === 0 ? 0 : (page - 1) * MEETINGS_PAGE_SIZE + 1
  const rangeTo = total === 0 ? 0 : Math.min(page * MEETINGS_PAGE_SIZE, total)
  const hasNextPage = data?.hasMore ?? page < totalPages
  const hasPrevPage = page > 1

  const hasActiveFilters =
    debouncedQ.length > 0 || statusFilter != null || dateFilter !== "all"

  const isSearchPending = searchInput.trim() !== debouncedQ

  const clearFilters = useCallback(() => {
    setSearchInput("")
    setDebouncedQ("")
    setStatusFilter(null)
    setDateFilter("all")
    setCustomDateRange(null)
    setPage(1)
  }, [])

  const goToNextPage = useCallback(() => {
    if (hasNextPage) setPage((p) => p + 1)
  }, [hasNextPage])

  const goToPrevPage = useCallback(() => {
    if (hasPrevPage) setPage((p) => Math.max(1, p - 1))
  }, [hasPrevPage])

  return {
    meetings,
    total,
    page,
    totalPages,
    pageSize: MEETINGS_PAGE_SIZE,
    rangeFrom,
    rangeTo,
    hasNextPage,
    hasPrevPage,
    goToNextPage,
    goToPrevPage,
    setPage,
    isInitialLoading: !hasLoadedOnce && isLoading,
    isRefreshing: hasLoadedOnce && isFetching && !isLoading,
    isError,
    error,
    refetch,
    searchInput,
    setSearchInput,
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
    customDateRange,
    setCustomDateRange,
    hasActiveFilters,
    isSearchPending,
    clearFilters,
  }
}
