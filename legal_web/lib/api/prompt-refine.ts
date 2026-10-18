import { apiFetch } from "./client"

export type PromptRefinementPurpose = "research" | "drafting"

export type PromptRefinementSkipReason =
  | "too_short"
  | "too_long"
  | "already_clear"
  | "disabled"
  | "llm_failed"

export interface PromptRefinementHints {
  jurisdiction?: string
  documentKind?: string
  parties?: string[]
  statutes?: string[]
}

export interface RefinePromptRequest {
  prompt: string
  purpose: PromptRefinementPurpose
  countryCode?: string
  jurisdiction?: string
  practiceArea?: string
  outputLanguage?: string
  knowledgeSources?: string[]
}

export interface RefinePromptResponse {
  originalPrompt: string
  refinedPrompt: string
  skipped: boolean
  skipReason?: PromptRefinementSkipReason
  hints?: PromptRefinementHints
}

export async function refinePrompt(
  data: RefinePromptRequest,
  tenantId?: string,
): Promise<RefinePromptResponse> {
  // Explicit allowlist — Nest forbidNonWhitelisted rejects matterId / desiredOutput / etc.
  const body: RefinePromptRequest = {
    prompt: data.prompt,
    purpose: data.purpose,
  }
  if (data.countryCode) body.countryCode = data.countryCode
  if (data.jurisdiction) body.jurisdiction = data.jurisdiction
  if (data.practiceArea) body.practiceArea = data.practiceArea
  if (data.outputLanguage) body.outputLanguage = data.outputLanguage
  if (data.knowledgeSources?.length) body.knowledgeSources = data.knowledgeSources

  return apiFetch<RefinePromptResponse>("/ai/prompt/refine", {
    method: "POST",
    body,
    tenantId,
  })
}
