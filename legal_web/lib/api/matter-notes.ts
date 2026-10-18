import { apiFetch } from "./client"

export interface ApiMatterNote {
  id: string
  matterId: string
  body: string
  authorId: string
  authorName?: string
  createdAt: string
  updatedAt: string
}

export async function listMatterNotes(
  tenantId: string,
  matterId: string,
): Promise<ApiMatterNote[]> {
  return apiFetch<ApiMatterNote[]>(`/matters/${matterId}/notes`, { tenantId })
}

export async function addMatterNote(
  tenantId: string,
  matterId: string,
  body: string,
): Promise<ApiMatterNote> {
  return apiFetch<ApiMatterNote>(`/matters/${matterId}/notes`, {
    method: "POST",
    tenantId,
    body: { body },
  })
}
