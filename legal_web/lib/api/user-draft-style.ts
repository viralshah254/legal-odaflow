import { apiFetch } from "./client"

export interface DraftStylePreset {
  id: string
  label: string
  description: string
}

export interface UserDraftStyleState {
  status: "none" | "pending" | "processing" | "ready"
  documentCount: number
  styleProfile: string | null
  styleKeywords: string[]
  avoidPatterns: string[]
  styleVersion: number
  creditBalance: number
}

export const MY_STYLE_ID = "my_style"
export const MIN_STYLE_SAMPLES = 5

/** GET /users/me/draft-style */
export async function getUserDraftStyle(): Promise<UserDraftStyleState> {
  return apiFetch<UserDraftStyleState>("/users/me/draft-style")
}

/** GET /users/me/draft-style/presets */
export async function getDraftStylePresets(): Promise<DraftStylePreset[]> {
  return apiFetch<DraftStylePreset[]>("/users/me/draft-style/presets")
}

/** POST /users/me/draft-style/samples — upload one sample document (free) */
export async function uploadDraftStyleSample(
  file: File,
): Promise<{ documentCount: number; message: string }> {
  const formData = new FormData()
  formData.append("file", file)
  return apiFetch<{ documentCount: number; message: string }>(
    "/users/me/draft-style/samples",
    { method: "POST", body: formData },
  )
}

/** DELETE /users/me/draft-style/samples/:index — remove a sample by index */
export async function removeDraftStyleSample(
  index: number,
): Promise<{ documentCount: number }> {
  return apiFetch<{ documentCount: number }>(
    `/users/me/draft-style/samples/${index}`,
    { method: "DELETE" },
  )
}

/** POST /users/me/draft-style/analyze — charges recorded usage */
export async function analyzeMyDraftStyle(): Promise<{
  status: string
  creditsCharged: number
}> {
  return apiFetch<{ status: string; creditsCharged: number }>(
    "/users/me/draft-style/analyze",
    { method: "POST" },
  )
}

/** DELETE /users/me/draft-style — full reset (free) */
export async function resetMyDraftStyle(): Promise<void> {
  await apiFetch<void>("/users/me/draft-style", { method: "DELETE" })
}
