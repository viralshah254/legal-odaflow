"use client"

import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query"

/** Production app always uses real API. Mock data lives only on /demo tour. */
export function isMockDataEnabled(): boolean {
  return false
}

type UseApiDataOptions<T> = {
  apiFn: () => Promise<T>
  /** @deprecated Mock removed from production — kept for gradual migration typing only */
  mockFn?: () => T
  enabled?: boolean
} & Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">

export function useApiData<T>(
  queryKey: readonly unknown[],
  options: UseApiDataOptions<T>,
): UseQueryResult<T, Error> {
  const { apiFn, enabled = true, ...queryOptions } = options

  return useQuery<T, Error>({
    queryKey: [...queryKey, "api"],
    queryFn: apiFn,
    enabled,
    ...queryOptions,
  })
}
