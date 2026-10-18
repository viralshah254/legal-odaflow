"use client"

import { useTenantOptional as useTenant } from "@/lib/contexts/tenant-context"
import { ContractsDashboard } from "@/components/contracts/contracts-dashboard"

export default function ContractsPage() {
  const { activeTenantId } = useTenant()

  if (!activeTenantId) {
    return (
      <div className="py-20 text-center text-muted-foreground text-sm">
        Loading…
      </div>
    )
  }

  return <ContractsDashboard tenantId={activeTenantId} />
}
