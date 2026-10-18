"use client"

import { MatterIntelligencePanel } from "@/components/matter-intelligence/matter-intelligence-panel"
import type {
  MatterGraph,
  MatterProfile,
  MatterTaskGraph,
} from "@/lib/matter-intelligence"

export interface MatterIntelligenceSidebarProps {
  matterProfile?: MatterProfile
  matterGraph?: MatterGraph
  taskGraph?: MatterTaskGraph
  className?: string
}

/** Matter workspace sidebar — graph summary, task checklist, missing docs (P9-04). */
export function MatterIntelligenceSidebar({
  matterProfile,
  matterGraph,
  taskGraph,
  className,
}: MatterIntelligenceSidebarProps) {
  if (!matterProfile) return null

  return (
    <aside className={className} aria-label="Matter intelligence">
      <MatterIntelligencePanel
        matterProfile={matterProfile}
        taskGraph={taskGraph}
        recommendedActions={taskGraph?.recommendedActions}
        issues={matterProfile.issues}
        nextBestAction={taskGraph?.nextBestAction}
      />

      {taskGraph?.missingDocuments && taskGraph.missingDocuments.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Missing documents
          </p>
          <ul className="text-sm space-y-1">
            {taskGraph.missingDocuments.map((doc) => (
              <li key={doc} className="text-muted-foreground">
                • {doc}
              </li>
            ))}
          </ul>
        </div>
      )}

      {matterGraph?.parties && matterGraph.parties.length > 0 && (
        <div className="mt-4 rounded-lg border p-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Parties
          </p>
          <ul className="text-sm space-y-1">
            {matterGraph.parties.slice(0, 5).map((party, i) => (
              <li key={`${party.name}-${i}`}>
                {party.name}
                {party.role ? ` (${party.role})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {matterGraph?.evidence && matterGraph.evidence.length > 0 && (
        <div className="mt-4 rounded-lg border p-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Extracted evidence
          </p>
          <ul className="text-sm space-y-2">
            {matterGraph.evidence.slice(0, 6).map((item, i) => (
              <li key={item.id ?? `${item.description.slice(0, 24)}-${i}`} className="space-y-1">
                <p className="text-foreground">{item.description}</p>
                <div className="flex flex-wrap gap-1">
                  {item.docType && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {item.docType}
                    </span>
                  )}
                  {item.flags?.contradiction && (
                    <span className="text-[10px] font-medium text-amber-600">Contradiction</span>
                  )}
                  {item.flags?.paymentProof && (
                    <span className="text-[10px] font-medium text-emerald-600">Payment proof</span>
                  )}
                  {item.flags?.threat && (
                    <span className="text-[10px] font-medium text-red-600">Threat</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}
