import { apiFetch } from "./client"

export interface CopilotPlanStep {
  id: string
  planId: string
  sortOrder: number
  title: string
  description?: string | null
  kind: string
  status: string
  agentKey?: string | null
  toolName?: string | null
}

export interface CopilotPlan {
  id: string
  tenantId: string
  userId: string
  title: string
  status: string
  matterId?: string | null
  leadId?: string | null
  steps: CopilotPlanStep[]
  createdAt: string
  updatedAt: string
}

export async function listCopilotPlans(tenantId: string): Promise<CopilotPlan[]> {
  return apiFetch<CopilotPlan[]>("/ai/copilot/plans", { tenantId })
}

export async function createCopilotPlan(
  tenantId: string,
  data: {
    title: string
    sessionId?: string
    matterId?: string
    leadId?: string
    steps: Array<{ title: string; description?: string; kind?: string; agentKey?: string }>
  },
): Promise<CopilotPlan> {
  return apiFetch<CopilotPlan>("/ai/copilot/plans", {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function updateCopilotPlanSteps(
  tenantId: string,
  planId: string,
  steps: Array<{
    id: string
    title?: string
    description?: string
    kind?: string
    status?: string
    sortOrder?: number
  }>,
): Promise<CopilotPlan> {
  return apiFetch<CopilotPlan>(`/ai/copilot/plans/${planId}/steps`, {
    method: "PATCH",
    tenantId,
    body: { steps },
  })
}

export async function executeCopilotPlan(
  tenantId: string,
  planId: string,
): Promise<CopilotPlan> {
  return apiFetch<CopilotPlan>(`/ai/copilot/plans/${planId}/execute`, {
    method: "POST",
    tenantId,
  })
}
