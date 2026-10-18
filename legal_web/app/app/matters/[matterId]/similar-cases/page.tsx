"use client"

import { useParams } from "next/navigation"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getMatter } from "@/lib/api/matters"
import { listSimilarCases } from "@/lib/api/matter-analysis"
import { Loader2 } from "lucide-react"
import { MatterWorkspaceShell } from "@/components/matters/matter-workspace-shell"
import { SimilarCasesPanel } from "@/components/matters/similar-cases-panel"

export default function SimilarCasesPage() {
  const params = useParams()
  const matterId = params.matterId as string
  const { activeTenantId } = useTenant()

  const { data: matter, isLoading: matterLoading } = useApiData(
    ["matter", activeTenantId, matterId],
    {
      apiFn: () => getMatter(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const { data: runs } = useApiData(
    ["similar-cases", activeTenantId, matterId],
    {
      apiFn: () => listSimilarCases(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  if (matterLoading || !matter) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <MatterWorkspaceShell matter={matter} tenantId={activeTenantId!} showIntelligenceSidebar={false}>
      <div className="mx-auto max-w-4xl">
        <SimilarCasesPanel matterId={matterId} initialRuns={runs ?? []} />
      </div>
    </MatterWorkspaceShell>
  )
}
