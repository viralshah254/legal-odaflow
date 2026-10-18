import { apiFetch } from "./client"
import type { AiDraftListItem } from "./document-automation"
import type { DraftWithAiResult } from "./document-automation"

export interface DraftingClauseOutline {
  title: string
  summary: string
}

export interface DraftingMissingField {
  field: string
  question: string
  options?: string[]
}

export interface DraftingSmartStep {
  type: string
  label: string
  detail?: string
  fieldId?: string
}

export interface ClauseEntry {
  title: string
  mandatory: boolean
  description?: string
}

export interface MatterDraftWorkspace {
  documentType?: string
  documentTitle?: string
  situation?: string
  clauseOutline?: DraftingClauseOutline[]
  missingFields?: DraftingMissingField[]
  smartNextSteps?: DraftingSmartStep[]
  sourcesCited?: string[]
  draftMarkdown?: string
  selectedClauses?: string[]
}

export interface DraftingWorkspaceResponse {
  matterId: string
  matterTitle: string
  matterType: string
  practiceArea: string
  countryCode?: string
  draftWorkspace: MatterDraftWorkspace
  planningAnswers: Record<string, string | string[]>
  confirmedFields: Record<string, string | string[]>
  pendingMissingFields: DraftingMissingField[]
  answeredCount: number
  totalRequired: number
  completionScore: number
  drafts: AiDraftListItem[]
  primaryDraft: (AiDraftListItem & { htmlContent?: string | null }) | null
  clauseCatalog?: ClauseEntry[]
}

export async function getDraftingWorkspace(
  tenantId: string,
  matterId: string,
): Promise<DraftingWorkspaceResponse> {
  return apiFetch<DraftingWorkspaceResponse>(`/matters/${matterId}/drafting-workspace`, {
    tenantId,
  })
}

export async function patchDraftingFields(
  tenantId: string,
  matterId: string,
  fields: Record<string, string | string[]>,
  regenerateDraft = false,
  selectedClauses?: string[],
  knowledgeSources?: string[],
): Promise<{
  planningAnswers: Record<string, string | string[]>
  draftWorkspace: MatterDraftWorkspace
  pendingMissingFields: DraftingMissingField[]
  answeredCount: number
  totalRequired: number
  completionScore: number
  generateResult?: DraftWithAiResult
}> {
  return apiFetch(`/matters/${matterId}/drafting-workspace/fields`, {
    method: "PATCH",
    tenantId,
    body: {
      fields,
      regenerateDraft,
      ...(selectedClauses !== undefined ? { selectedClauses } : {}),
      ...(knowledgeSources?.length ? { knowledgeSources } : {}),
    },
  })
}

export async function generateDraftingDocument(
  tenantId: string,
  matterId: string,
  sectionHint?: string,
  selectedClauses?: string[],
  knowledgeSources?: string[],
): Promise<DraftWithAiResult> {
  return apiFetch<DraftWithAiResult>(`/matters/${matterId}/drafting-workspace/generate`, {
    method: "POST",
    tenantId,
    body: {
      ...(sectionHint ? { sectionHint } : {}),
      ...(selectedClauses !== undefined ? { selectedClauses } : {}),
      ...(knowledgeSources?.length ? { knowledgeSources } : {}),
    },
  })
}
