"use client"

import { use } from "react"
import { useTenant } from "@/lib/contexts/tenant-context"
import { EvidenceMapView } from "@/components/matters/evidence-map-view"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getMatter } from "@/lib/api/matters"
import { MatterWorkspaceShell } from "@/components/matters/matter-workspace-shell"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { AlertTriangle } from "lucide-react"

export default function EvidenceMapPage({
  params,
}: {
  params: Promise<{ matterId: string }> | { matterId: string }
}) {
  const matterId = params instanceof Promise ? use(params).matterId : params.matterId
  const { activeTenantId } = useTenant()
  const { data: matter, isLoading, isError, refetch } = useApiData(
    ["matter-evidence-map-shell", activeTenantId, matterId],
    {
      apiFn: () => getMatter(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  if (!activeTenantId || isLoading) {
    return <PageSkeleton />
  }

  if (isError || !matter) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not load this matter"
        description="The evidence map is temporarily unavailable."
        actionLabel="Retry"
        onAction={() => void refetch()}
      />
    )
  }

  return (
    <MatterWorkspaceShell matter={matter} tenantId={activeTenantId} showIntelligenceSidebar={false}>
      <EvidenceMapView matterId={matterId} tenantId={activeTenantId} />
    </MatterWorkspaceShell>
  )
}
