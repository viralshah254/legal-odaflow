import { apiFetch } from "./client"
import type { AgentJob, AutomationRecipe, InternalAgent } from "./types"

export async function listAgents(tenantId: string): Promise<InternalAgent[]> {
  return apiFetch<InternalAgent[]>("/agents", { tenantId })
}

export async function listRecipes(tenantId: string): Promise<AutomationRecipe[]> {
  return apiFetch<AutomationRecipe[]>("/agents/recipes", { tenantId })
}

export async function listAgentJobs(tenantId: string, limit = 25): Promise<AgentJob[]> {
  return apiFetch<AgentJob[]>(`/agents/jobs?limit=${limit}`, { tenantId })
}

export async function getAgentJob(tenantId: string, jobId: string, signal?: AbortSignal): Promise<AgentJob> {
  return apiFetch<AgentJob>(`/agents/jobs/${jobId}`, { tenantId, signal })
}
