import { apiFetch } from "./client"

export interface GlobalSearchResult {
  matters: Array<{ id: string; title: string; caseNumber: string | null; status: string }>
  clients: Array<{ id: string; name: string; email: string | null }>
  documents: Array<{ id: string; fileName: string; matterId: string | null }>
  tasks: Array<{ id: string; title: string; status: string; matterId: string | null }>
}

export interface UnifiedSearchResult extends GlobalSearchResult {
  query: string
}

export async function globalSearch(
  tenantId: string,
  q: string,
): Promise<GlobalSearchResult> {
  const params = new URLSearchParams({ q })
  return apiFetch<GlobalSearchResult>(`/search/global?${params.toString()}`, {
    tenantId,
  })
}

export async function unifiedSearch(
  tenantId: string,
  q: string,
): Promise<UnifiedSearchResult> {
  const params = new URLSearchParams({ q })
  return apiFetch<UnifiedSearchResult>(`/search/unified?${params.toString()}`, {
    tenantId,
  })
}
