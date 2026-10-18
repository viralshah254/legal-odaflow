import { apiFetch } from "./client"

export interface AutomationAction {
  type: string
  title?: string
  body?: string
  priority?: string
  userIdField?: string
  notifyRole?: string
  toolName?: string
  outputAction?: string
  matterIdField?: string
}

export interface AutomationRule {
  id: string
  tenantId: string
  name: string
  trigger: string
  conditions: Record<string, unknown> | null
  actions: AutomationAction[] | null
  isEnabled: boolean
  createdAt: string
  updatedAt: string
  runs?: AutomationRun[]
}

export interface AutomationRun {
  id: string
  status: string
  startedAt: string
  completedAt?: string | null
  error?: string | null
}

export interface BuiltInRecipe {
  recipeKey: string
  name: string
  description: string
  trigger: string
  conditions: Record<string, unknown>
  actions: AutomationAction[]
}

export interface UpsertAutomationRuleInput {
  name: string
  trigger: string
  conditions?: Record<string, unknown>
  actions?: AutomationAction[]
  isEnabled?: boolean
}

export async function listBuiltInRecipes(tenantId: string): Promise<BuiltInRecipe[]> {
  return apiFetch<BuiltInRecipe[]>("/automations/recipes", { tenantId })
}

export async function listAutomationRules(
  tenantId: string,
): Promise<AutomationRule[]> {
  return apiFetch<AutomationRule[]>(`/automations/rules`, { tenantId })
}

export async function createAutomationRule(
  tenantId: string,
  data: UpsertAutomationRuleInput,
): Promise<AutomationRule> {
  return apiFetch<AutomationRule>(`/automations/rules`, {
    method: "POST",
    tenantId,
    body: data,
  })
}

export async function updateAutomationRule(
  tenantId: string,
  ruleId: string,
  data: Partial<UpsertAutomationRuleInput>,
): Promise<AutomationRule> {
  return apiFetch<AutomationRule>(`/automations/rules/${ruleId}`, {
    method: "PATCH",
    tenantId,
    body: data,
  })
}

export async function deleteAutomationRule(
  tenantId: string,
  ruleId: string,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/automations/rules/${ruleId}`, {
    method: "DELETE",
    tenantId,
  })
}

export async function seedAutomationRecipes(
  tenantId: string,
): Promise<{ installed: number; skipped: number; total: number }> {
  return apiFetch<{ installed: number; skipped: number; total: number }>(
    "/automations/rules/seed",
    {
      method: "POST",
      tenantId,
    },
  )
}

export async function resetAutomationDefaults(
  tenantId: string,
): Promise<{ reset: number; installed: number; total: number }> {
  return apiFetch<{ reset: number; installed: number; total: number }>(
    "/automations/rules/reset-defaults",
    {
      method: "POST",
      tenantId,
    },
  )
}

export async function listAutomationRuns(
  tenantId: string,
  ruleId?: string,
): Promise<Array<AutomationRun & { rule?: AutomationRule }>> {
  const query = ruleId ? `?ruleId=${encodeURIComponent(ruleId)}` : ""
  return apiFetch(`/automations/runs${query}`, { tenantId })
}
