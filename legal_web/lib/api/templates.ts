import { apiFetch } from "./client"

export interface ApiDocumentTemplate {
  id: string
  tenantId: string
  name: string
  category: string
  content: string
  matterType?: string | null
  countryCode?: string | null
  practiceArea?: string | null
  documentKind?: string | null
  jurisdiction?: string | null
  conditionalFields?: string[] | null
  source?: string | null
  systemTemplateId?: string | null
  createdByUserId?: string | null
  clientId?: string | null
  matterId?: string | null
  createdAt: string
  updatedAt: string
}

export interface SystemDocumentTemplate {
  id: string
  countryCode: string
  practiceArea: string
  category: string
  name: string
  content: string
  matterType?: string | null
  documentKind?: string | null
  jurisdiction?: string | null
  conditionalFields?: string[] | null
  sortOrder: number
  provisioned?: boolean
}

export interface PracticeAreaOption {
  slug: string
  label: string
}

export interface ListTemplatesResponse {
  templates: ApiDocumentTemplate[]
  provisionedCount: number
}

export interface CreateTemplateRequest {
  name: string
  category: string
  content: string
  matterType?: string
  countryCode?: string
  practiceArea?: string
  documentKind?: string
  clientId?: string
  matterId?: string
}

export interface UpdateTemplateRequest {
  name?: string
  category?: string
  content?: string
  countryCode?: string
  practiceArea?: string
}

export async function listTemplates(
  tenantId: string,
  params?: {
    category?: string
    practiceArea?: string
    countryCode?: string
    source?: string
  },
): Promise<ListTemplatesResponse> {
  const search = new URLSearchParams()
  if (params?.category) search.set("category", params.category)
  if (params?.practiceArea) search.set("practiceArea", params.practiceArea)
  if (params?.countryCode) search.set("countryCode", params.countryCode)
  if (params?.source) search.set("source", params.source)
  const query = search.toString() ? `?${search.toString()}` : ""
  return apiFetch<ListTemplatesResponse>(`/templates${query}`, { tenantId })
}

export async function listTemplateLibrary(
  tenantId: string,
  params?: {
    countryCode?: string
    practiceArea?: string
    allPracticeAreas?: boolean
  },
): Promise<SystemDocumentTemplate[]> {
  const search = new URLSearchParams()
  if (params?.countryCode) search.set("countryCode", params.countryCode)
  if (params?.practiceArea) search.set("practiceArea", params.practiceArea)
  if (params?.allPracticeAreas) search.set("allPracticeAreas", "true")
  const query = search.toString() ? `?${search.toString()}` : ""
  return apiFetch<SystemDocumentTemplate[]>(`/templates/library${query}`, { tenantId })
}

export async function listPracticeAreas(): Promise<PracticeAreaOption[]> {
  return apiFetch<PracticeAreaOption[]>("/templates/practice-areas")
}

export async function provisionTemplateLibrary(
  tenantId: string,
  body: {
    systemTemplateIds?: string[]
    practiceArea?: string
    countryCode?: string
    limit?: number
  },
): Promise<{ provisionedCount: number; templateIds: string[] }> {
  return apiFetch("/templates/library/provision", {
    method: "POST",
    tenantId,
    body,
  })
}

export async function getTemplate(
  tenantId: string,
  templateId: string,
): Promise<ApiDocumentTemplate> {
  return apiFetch<ApiDocumentTemplate>(`/templates/${templateId}`, { tenantId })
}

export async function createTemplate(
  tenantId: string,
  data: CreateTemplateRequest,
): Promise<ApiDocumentTemplate> {
  return apiFetch<ApiDocumentTemplate>("/templates", {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function updateTemplate(
  tenantId: string,
  templateId: string,
  data: UpdateTemplateRequest,
): Promise<ApiDocumentTemplate> {
  return apiFetch<ApiDocumentTemplate>(`/templates/${templateId}`, {
    method: "PATCH",
    tenantId,
    body: data,
  })
}

export async function deleteTemplate(
  tenantId: string,
  templateId: string,
): Promise<void> {
  await apiFetch<void>(`/templates/${templateId}`, {
    method: "DELETE",
    tenantId,
  })
}

export async function checkTemplateNameExists(
  tenantId: string,
  name: string,
  excludeId?: string,
): Promise<{ exists: boolean }> {
  const params = new URLSearchParams({ name })
  if (excludeId) params.set("excludeId", excludeId)
  return apiFetch<{ exists: boolean }>(
    `/templates/check-name?${params.toString()}`,
    { tenantId },
  )
}
