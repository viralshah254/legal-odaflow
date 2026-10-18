import { apiFetch } from "./client"

export interface GenerateUsDraftRequest {
  kind: string
  caseDetails: string
  clientName?: string
  courtName?: string
  opposingParty?: string
  stateCode?: string
  formNumber?: string
  formTitle?: string
  language?: "en"
  knowledgeSources?: string[]
}

export type UsDraftEnrichMode = "case_laws" | "sections" | "both"

export interface EnrichUsDraftRequest {
  draftText: string
  documentKind: string
  rawFacts?: string
  mode?: UsDraftEnrichMode
  stateCode?: string
}

export interface EnrichUsDraftResponse {
  enrichedDraft: string
  citationAppendix: Array<Record<string, unknown>>
  caseLawAreas: Array<Record<string, unknown>>
  creditsCharged: number
  providerCostUsd: number
  mode?: UsDraftEnrichMode
  sectionsAdded?: string[]
}

import type { DraftVerificationAudit } from "@/lib/api/draft-verification"

export interface GenerateUsDraftResponse {
  draft: string
  creditsUsed: number
  verification?: DraftVerificationAudit
}

export interface FillUsDraftBlanksRequest {
  documentKind: string
  context?: Record<string, string>
  emptyFields: string[]
  stateCode?: string
}

export interface FillUsDraftBlanksResponse {
  suggestions: Record<string, string>
  creditsUsed: number
}

export async function generateUsDraft(
  payload: GenerateUsDraftRequest,
  tenantId?: string,
): Promise<GenerateUsDraftResponse> {
  return apiFetch<GenerateUsDraftResponse>("/ai/us-draft/generate", {
    method: "POST",
    tenantId,
    body: payload,
  })
}

export async function enrichUsDraft(
  payload: EnrichUsDraftRequest,
  tenantId?: string,
): Promise<EnrichUsDraftResponse> {
  return apiFetch<EnrichUsDraftResponse>("/ai/us-draft/enrich", {
    method: "POST",
    tenantId,
    body: payload,
  })
}

export async function fillUsDraftBlanks(
  payload: FillUsDraftBlanksRequest,
  tenantId?: string,
): Promise<FillUsDraftBlanksResponse> {
  return apiFetch<FillUsDraftBlanksResponse>("/ai/us-draft/fill-blanks", {
    method: "POST",
    tenantId,
    body: payload,
  })
}
