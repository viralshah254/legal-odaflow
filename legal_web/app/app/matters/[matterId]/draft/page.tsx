"use client"

import { use } from "react"
import { useSearchParams } from "next/navigation"
import { useTenant } from "@/lib/contexts/tenant-context"
import { DocumentDraftWorkspace } from "@/components/matters/document-draft-workspace"
import { MatterInlineCopilot } from "@/components/matters/matter-inline-copilot"

export default function MatterDraftPage({
  params,
}: {
  params: Promise<{ matterId: string }> | { matterId: string }
}) {
  let matterId: string
  if (params instanceof Promise) {
    matterId = use(params).matterId
  } else {
    matterId = params.matterId
  }
  const searchParams = useSearchParams()
  const { activeTenantId } = useTenant()
  const openSign = searchParams.get("sign") === "1"

  if (!activeTenantId) {
    return (
      <div className="py-20 text-center text-muted-foreground text-sm">
        Loading workspace…
      </div>
    )
  }

  return (
    <div className="pb-24">
      <DocumentDraftWorkspace
        matterId={matterId}
        tenantId={activeTenantId}
        openSignOnMount={openSign}
      />
      <MatterInlineCopilot matterId={matterId} />
    </div>
  )
}
