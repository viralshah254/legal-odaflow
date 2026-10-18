"use client"

import { useParams } from "next/navigation"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getMatter } from "@/lib/api/matters"
import { MatterWorkspaceShell } from "@/components/matters/matter-workspace-shell"
import { MatterFileCenter } from "@/components/matters/matter-file-center"
import { EmptyState } from "@/components/ui/empty-state"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { AlertTriangle } from "lucide-react"
import { queryKeys } from "@/lib/api/query-keys"

export default function MatterDocumentsPage() {
  const params = useParams()
  const matterId = params.matterId as string
  const { activeTenantId } = useTenant()

  const { data: matter, isLoading, isError, refetch } = useApiData(
    queryKeys.matters.detail(activeTenantId, matterId),
    {
      apiFn: () => getMatter(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  if (isLoading || !activeTenantId) return <PageSkeleton />
  if (isError || !matter) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not load this matter"
        description="The matter file center is temporarily unavailable."
        actionLabel="Retry"
        onAction={() => void refetch()}
      />
    )
  }

  return (
    <MatterWorkspaceShell
      matter={matter}
      tenantId={activeTenantId}
      uploadInvalidateKeys={[
        [...queryKeys.matters.documents(activeTenantId, matterId)],
        ["diligence-jobs", activeTenantId, matterId],
      ]}
    >
      <MatterFileCenter
        tenantId={activeTenantId}
        matterId={matterId}
        practiceArea={matter.practiceArea}
        countryCode={matter.countryCode}
        jurisdiction={matter.jurisdiction}
        matterType={matter.matterType}
      />
    </MatterWorkspaceShell>
  )
}
