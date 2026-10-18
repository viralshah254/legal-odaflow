"use client"

import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle, Minus, Circle, Loader2 } from "lucide-react"

type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

interface Stage {
  id: string
  label: string
  status: StageStatus
}

interface WorkflowProgressProps {
  stages: Stage[]
  currentStage?: string
  progress?: number
  className?: string
}

const statusIcon: Record<StageStatus, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  failed: <XCircle className="h-4 w-4 text-destructive" />,
  skipped: <Minus className="h-4 w-4 text-muted-foreground" />,
}

const statusLabel: Record<StageStatus, string> = {
  pending: 'text-muted-foreground',
  running: 'text-foreground font-medium',
  completed: 'text-foreground',
  failed: 'text-destructive',
  skipped: 'text-muted-foreground line-through',
}

export function WorkflowProgress({ stages, currentStage: _currentStage, progress, className }: WorkflowProgressProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {stages.map((stage, idx) => (
          <div key={stage.id} className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-1.5">
              {statusIcon[stage.status]}
              <span className={cn("text-xs whitespace-nowrap", statusLabel[stage.status])}>
                {stage.label}
              </span>
            </div>
            {idx < stages.length - 1 && (
              <div className={cn(
                "h-px w-6 mx-1 rounded",
                stage.status === 'completed' ? 'bg-emerald-500' : 'bg-border'
              )} />
            )}
          </div>
        ))}
      </div>
      {progress !== undefined && (
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  )
}
