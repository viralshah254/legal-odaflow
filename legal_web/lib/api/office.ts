import { apiFetch } from "./client"

export async function generateBillingNarrative(
  tenantId: string,
  matterId: string,
): Promise<{ narrative: string }> {
  return apiFetch<{ narrative: string }>("/ai/office/billing-narrative", {
    method: "POST",
    tenantId,
    body: { matterId },
  })
}
