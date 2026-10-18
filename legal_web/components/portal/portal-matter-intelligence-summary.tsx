"use client"

import { MatterIntelligencePanel } from "@/components/matter-intelligence/matter-intelligence-panel"
import type {
  MatterGraph,
  MatterProfile,
  MatterTaskGraph,
} from "@/lib/matter-intelligence"

/** Read-only portal summary of issues, actions, and document checklist (P19-04). */
export function PortalMatterIntelligenceSummary({
  matterProfile,
  taskGraph,
}: {
  matterProfile?: MatterProfile
  taskGraph?: MatterTaskGraph
  matterGraph?: MatterGraph
}) {
  if (!matterProfile) return null

  return (
    <MatterIntelligencePanel
      matterProfile={matterProfile}
      taskGraph={taskGraph}
      recommendedActions={taskGraph?.recommendedActions}
      issues={matterProfile.issues}
      nextBestAction={taskGraph?.nextBestAction}
      className="mb-6"
    />
  )
}
