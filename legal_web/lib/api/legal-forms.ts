import { apiFetch } from "./client"

export interface JurisdictionForm {
  id: string
  countryCode: string
  jurisdiction: string | null
  practiceArea: string
  formName: string
  formNumber: string | null
  authority: string
  sourceUrl: string
  description: string | null
  category: string | null
  feeInfo: string | null
  lastUpdated: string | null
  isSystem: boolean
  createdAt: string
}

export interface LegalFormsQuery {
  countryCode?: string
  practiceArea?: string
  jurisdiction?: string
  matterType?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface PaginatedLegalForms {
  items: JurisdictionForm[]
  total: number
  page: number
  limit: number
  pages: number
}

export async function fetchLegalForms(
  query: LegalFormsQuery,
): Promise<JurisdictionForm[]> {
  const params = new URLSearchParams()
  if (query.countryCode) params.set("countryCode", query.countryCode)
  if (query.practiceArea) params.set("practiceArea", query.practiceArea)
  if (query.jurisdiction) params.set("jurisdiction", query.jurisdiction)
  if (query.matterType) params.set("matterType", query.matterType)
  if (query.category) params.set("category", query.category)
  if (query.search) params.set("search", query.search)

  const qs = params.toString()
  return apiFetch<JurisdictionForm[]>(`/legal-forms${qs ? `?${qs}` : ""}`)
}

export async function fetchLegalFormsPaginated(
  query: LegalFormsQuery,
): Promise<PaginatedLegalForms> {
  const params = new URLSearchParams()
  if (query.countryCode) params.set("countryCode", query.countryCode)
  if (query.practiceArea) params.set("practiceArea", query.practiceArea)
  if (query.jurisdiction) params.set("jurisdiction", query.jurisdiction)
  if (query.matterType) params.set("matterType", query.matterType)
  if (query.category) params.set("category", query.category)
  if (query.search) params.set("search", query.search)
  params.set("page", String(query.page ?? 1))
  params.set("limit", String(query.limit ?? 48))

  return apiFetch<PaginatedLegalForms>(`/legal-forms?${params.toString()}`)
}

/** Hybrid vector + lexical form search (preferred for NL queries like "stalking"). */
export async function searchLegalFormsByIntent(
  query: string,
  options?: { countryCode?: string; limit?: number },
): Promise<JurisdictionForm[]> {
  const params = new URLSearchParams()
  params.set("query", query)
  if (options?.countryCode) params.set("countryCode", options.countryCode)
  params.set("limit", String(options?.limit ?? 20))
  const res = await apiFetch<{ items: JurisdictionForm[] }>(
    `/legal-forms/intent-search?${params.toString()}`,
  )
  return res.items ?? []
}

export async function fetchLegalFormsByMatter(
  matterId: string,
): Promise<JurisdictionForm[]> {
  return apiFetch<JurisdictionForm[]>(`/legal-forms/by-matter/${matterId}`)
}

export interface MatterFormAttachment {
  id: string
  matterId: string
  formId: string
  createdAt: string
  form: JurisdictionForm
}

export async function listMatterFormAttachments(
  tenantId: string,
  matterId: string,
): Promise<MatterFormAttachment[]> {
  return apiFetch<MatterFormAttachment[]>(`/matters/${matterId}/forms`, { tenantId })
}

export async function attachMatterForms(
  tenantId: string,
  matterId: string,
  formIds: string[],
): Promise<MatterFormAttachment[]> {
  return apiFetch<MatterFormAttachment[]>(`/matters/${matterId}/forms/attach`, {
    method: "POST",
    tenantId,
    body: { formIds },
  })
}

export async function fetchLegalFormsByCountry(
  countryCode: string,
): Promise<Record<string, JurisdictionForm[]>> {
  return apiFetch<Record<string, JurisdictionForm[]>>(
    `/legal-forms/by-country/${countryCode}`,
  )
}
