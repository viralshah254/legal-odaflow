import { apiFetch } from "./client"

export interface MatterBudgetSummary {
  matterId: string
  budgetAmount?: number | null
  budgetCurrency?: string | null
  actualAmount?: number | null
  remainingAmount?: number | null
  utilizationPercent?: number | null
}

export async function getMatterBudget(
  tenantId: string,
  matterId: string,
): Promise<MatterBudgetSummary> {
  return apiFetch<MatterBudgetSummary>(`/matters/${matterId}/budget`, { tenantId })
}
