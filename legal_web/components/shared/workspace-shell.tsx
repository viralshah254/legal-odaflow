"use client"

import { cn } from "@/lib/utils"
import { WorkflowProgress } from "./workflow-progress"
import { RiskBadge } from "./risk-badge"
import { ResponsiveAside } from "./responsive-aside"
import type { ReactNode } from "react"

type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

interface WorkflowProgressProps {
  stages: Array<{ id: string; label: string; status: StageStatus }>
  currentStage?: string
  progress?: number
  className?: string
}

interface WorkspaceShellProps {
  title: string
  workflowId?: string
  workflowStatus?: string
  stages?: WorkflowProgressProps['stages']
  progress?: number
  costUsd?: number
  riskLevel?: string
  actions?: ReactNode
  sidebar?: ReactNode
  children: ReactNode
  className?: string
}

const workflowStatusBadge: Record<string, string> = {
  running: 'bg-primary/10 text-primary',
  completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  failed: 'bg-destructive/10 text-destructive',
  pending: 'bg-secondary text-secondary-foreground',
  idle: 'bg-secondary text-secondary-foreground',
}

export function WorkspaceShell({
  title,
  workflowId: _workflowId,
  workflowStatus,
  stages,
  progress,
  costUsd,
  riskLevel,
  actions,
  sidebar,
  children,
  className,
}: WorkspaceShellProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base font-semibold leading-none truncate">{title}</h1>
              {workflowStatus && (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                    workflowStatusBadge[workflowStatus] ?? workflowStatusBadge.idle,
                  )}
                >
                  {workflowStatus}
                </span>
              )}
              {riskLevel && (
                <RiskBadge level={riskLevel as 'low' | 'medium' | 'high' | 'critical'} />
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {costUsd !== undefined && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  ${costUsd.toFixed(4)} cost
                </span>
              )}
              {actions}
            </div>
          </div>
          {stages && stages.length > 0 && (
            <div className="mt-3">
              <WorkflowProgress stages={stages} progress={progress} />
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">{children}</main>
        {sidebar && (
          <ResponsiveAside title="Details" className="w-80 xl:w-96">
            {sidebar}
          </ResponsiveAside>
        )}
      </div>
    </div>
  )
}
