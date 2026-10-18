import { apiFetch, ApiClientError } from "./client"
import type {
  CapabilitySnapshot,
  ResearchAuditMetadata,
  ResearchConfidenceSummary,
  ResearchConflict,
  ResearchFactSummary,
  ResearchPlan,
  ResearchPropositionSummary,
  ResearchPublicationAssessment,
  ResearchPublicationDecision,
  ResearchSourceIntegrity,
  ResearchSourceProvenance,
  ResearchTaskProfile,
} from "./types"

export type ResearchWorkspaceMode = "quick" | "deep" | "matter_aware" | "update"
export type ResearchWorkspaceStatus =
  | "pending"
  | "planning"
  | "retrieving"
  | "synthesizing"
  | "verifying"
  | "completed"
  | "failed"
export type ResearchContextKind =
  | "fact"
  | "evidence"
  | "correction"
  | "objective"
  | "authority"

export interface ResearchContextProvenance {
  sourceType: string
  sourceId?: string
  sourceUri?: string
  capturedAt?: string
  metadata?: Record<string, unknown>
}

export interface ResearchWorkspaceContextItem {
  id: string
  workspaceId: string
  kind: string
  label?: string | null
  content: Record<string, unknown>
  provenance: ResearchContextProvenance
  affectedIssueIds?: string[] | null
  ordinal: number
  createdAt: string
  updatedAt: string
}

export interface ResearchWorkspace {
  id: string
  tenantId: string
  userId: string
  matterId?: string | null
  title?: string | null
  objective: string
  jurisdiction?: string | null
  region?: string | null
  mode: ResearchWorkspaceMode
  status: ResearchWorkspaceStatus
  revision: number
  contextItems: ResearchWorkspaceContextItem[]
  createdAt: string
  updatedAt: string
}

export interface ResearchWorkspaceRevision {
  id: string
  workspaceId: string
  aiOutputId: string
  revision: number
  affectedIssueIds?: string[] | null
  provenance?: Record<string, unknown> | null
  createdAt: string
  aiOutput: {
    id: string
    mode?: string | null
    taskType: string
    outputMarkdown: string
    citations?: unknown
    citationAudit?: unknown
    verified: boolean
    confidenceScore?: number | null
    createdAt: string
    taskProfile?: ResearchTaskProfile
    researchPlan?: ResearchPlan
    capabilitySnapshot?: CapabilitySnapshot
    sourceProvenance?: ResearchSourceProvenance[]
    sourceIntegrity?: ResearchSourceIntegrity
    conflicts?: Array<string | ResearchConflict>
    confidenceAssessment?: ResearchConfidenceSummary
    publicationDecision?: ResearchPublicationDecision | ResearchPublicationAssessment
    factSummaries?: ResearchFactSummary[]
    propositionSummaries?: ResearchPropositionSummary[]
    auditMetadata?: ResearchAuditMetadata
  }
}

export interface CreateResearchWorkspaceInput {
  objective: string
  title?: string
  jurisdiction?: string
  region?: string
  matterId?: string
  mode?: ResearchWorkspaceMode
}

export interface ResearchWorkspaceRevisionInput {
  aiOutputId: string
  affectedIssueIds?: string[]
  provenance?: Record<string, unknown>
}

export interface UpdateResearchWorkspaceInput {
  expectedRevision: number
  title?: string
  objective?: string
  jurisdiction?: string
  region?: string
  matterId?: string
  mode?: ResearchWorkspaceMode
  status?: ResearchWorkspaceStatus
  revision?: ResearchWorkspaceRevisionInput
}

export interface AppendResearchContextInput {
  expectedRevision: number
  id?: string
  kind: ResearchContextKind
  label?: string
  content: Record<string, unknown>
  provenance: ResearchContextProvenance
  affectedIssueIds?: string[]
}

/** Workspace APIs return 404 when RESEARCH_WORKSPACE_FOLLOW_ON is disabled. */
export function isResearchWorkspaceFeatureUnavailable(error: unknown): boolean {
  if (!(error instanceof ApiClientError) || error.statusCode !== 404) return false
  const body = error.body as { code?: string; feature?: string } | undefined
  return (
    body?.code === "FEATURE_UNAVAILABLE" ||
    body?.feature === "RESEARCH_WORKSPACE_FOLLOW_ON"
  )
}

let workspaceFeatureDisabled = false

export function isResearchWorkspaceFeatureDisabled(): boolean {
  return workspaceFeatureDisabled
}

function markWorkspaceFeatureDisabled(error: unknown): void {
  if (isResearchWorkspaceFeatureUnavailable(error)) {
    workspaceFeatureDisabled = true
  }
}

async function workspaceFetch<T>(
  path: string,
  options: Parameters<typeof apiFetch<T>>[1],
): Promise<T> {
  if (workspaceFeatureDisabled) {
    throw new ApiClientError(
      "Research workspace follow-on is not enabled for this account",
      404,
      { code: "FEATURE_UNAVAILABLE", feature: "RESEARCH_WORKSPACE_FOLLOW_ON" },
    )
  }
  try {
    return await apiFetch<T>(path, options)
  } catch (error) {
    markWorkspaceFeatureDisabled(error)
    throw error
  }
}

export function createResearchWorkspace(
  tenantId: string,
  input: CreateResearchWorkspaceInput,
): Promise<ResearchWorkspace> {
  return workspaceFetch("/research/workspaces", {
    method: "POST",
    tenantId,
    body: input,
  })
}

export function getResearchWorkspace(
  tenantId: string,
  workspaceId: string,
): Promise<ResearchWorkspace> {
  return workspaceFetch(`/research/workspaces/${workspaceId}`, { tenantId })
}

export function updateResearchWorkspace(
  tenantId: string,
  workspaceId: string,
  input: UpdateResearchWorkspaceInput,
): Promise<ResearchWorkspace> {
  return workspaceFetch(`/research/workspaces/${workspaceId}`, {
    method: "PATCH",
    tenantId,
    body: input,
  })
}

export function appendResearchWorkspaceContext(
  tenantId: string,
  workspaceId: string,
  input: AppendResearchContextInput,
): Promise<{ item: ResearchWorkspaceContextItem; workspaceRevision: number }> {
  return workspaceFetch(`/research/workspaces/${workspaceId}/context`, {
    method: "POST",
    tenantId,
    body: input,
  })
}

export function listResearchWorkspaceRevisions(
  tenantId: string,
  workspaceId: string,
): Promise<ResearchWorkspaceRevision[]> {
  return workspaceFetch(`/research/workspaces/${workspaceId}/revisions`, { tenantId })
}
