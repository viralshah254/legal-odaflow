import { apiFetch } from "./client"

export interface PlaybookTaskTemplate {
  title: string
  description?: string
  priority?: string
  dueInDays?: number
}

export interface ApiPlaybook {
  id: string
  tenantId: string
  name: string
  description: string | null
  matterType: string | null
  countryCode: string | null
  jurisdiction: string | null
  practiceArea: string | null
  taskTemplates: PlaybookTaskTemplate[] | Record<string, unknown>[]
  isEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface CreatePlaybookRequest {
  name: string
  description?: string
  matterType?: string
  countryCode?: string
  jurisdiction?: string
  practiceArea?: string
  taskTemplates: Array<Record<string, unknown>>
  isEnabled?: boolean
}

export interface UpdatePlaybookRequest {
  name?: string
  description?: string
  matterType?: string
  countryCode?: string
  jurisdiction?: string
  practiceArea?: string
  taskTemplates?: Array<Record<string, unknown>>
  isEnabled?: boolean
}

export async function listPlaybooks(
  tenantId: string,
  isEnabled?: boolean,
): Promise<ApiPlaybook[]> {
  const query =
    isEnabled !== undefined ? `?isEnabled=${isEnabled}` : ""
  return apiFetch<ApiPlaybook[]>(`/playbooks${query}`, { tenantId })
}

export async function getPlaybook(
  tenantId: string,
  playbookId: string,
): Promise<ApiPlaybook> {
  return apiFetch<ApiPlaybook>(`/playbooks/${playbookId}`, { tenantId })
}

export async function createPlaybook(
  tenantId: string,
  data: CreatePlaybookRequest,
): Promise<ApiPlaybook> {
  return apiFetch<ApiPlaybook>("/playbooks", {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function updatePlaybook(
  tenantId: string,
  playbookId: string,
  data: UpdatePlaybookRequest,
): Promise<ApiPlaybook> {
  return apiFetch<ApiPlaybook>(`/playbooks/${playbookId}`, {
    method: "PATCH",
    tenantId,
    body: data,
  })
}

export async function deletePlaybook(
  tenantId: string,
  playbookId: string,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/playbooks/${playbookId}`, {
    method: "DELETE",
    tenantId,
  })
}
