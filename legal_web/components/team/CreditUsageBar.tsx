"use client"

import { cn } from "@/lib/utils"
import type { CreditUsageStatus } from "@/lib/api/users"

interface CreditUsageBarProps {
  used: number
  limit: number | null
  status: CreditUsageStatus
  cycleEnd?: string
  className?: string
  showLabel?: boolean
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" })
}

export function CreditUsageBar({
  used,
  limit,
  status,
  cycleEnd,
  className,
  showLabel = true,
}: CreditUsageBarProps) {
  if (status === "AI_BLOCKED") {
    return (
      <div className={cn("space-y-1", className)}>
        {showLabel && (
          <p className="text-xs text-destructive font-medium">AI access blocked</p>
        )}
        <div className="h-1.5 rounded-full bg-destructive/20" />
      </div>
    )
  }

  if (status === "TENANT_BALANCE_EXHAUSTED") {
    return (
      <div className={cn("space-y-1", className)}>
        {showLabel && (
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Firm wallet exhausted</p>
        )}
        <div className="h-1.5 rounded-full bg-amber-200 dark:bg-amber-900/40" />
      </div>
    )
  }

  if (limit === null) {
    return (
      <div className={cn("space-y-1", className)}>
        {showLabel && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{used}</span> used · Unlimited
          </p>
        )}
        <div className="h-1.5 rounded-full bg-primary/20">
          <div className="h-full w-0 rounded-full bg-primary/40" />
        </div>
      </div>
    )
  }

  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 100
  const barColor =
    status === "USER_LIMIT_REACHED"
      ? "bg-destructive"
      : status === "NEAR_LIMIT"
        ? "bg-amber-500"
        : "bg-primary"

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            <span className={cn("font-medium", status === "USER_LIMIT_REACHED" ? "text-destructive" : "text-foreground")}>
              {used}
            </span>
            {" / "}
            {limit} credits
          </p>
          {cycleEnd && (
            <p className="text-[10px] text-muted-foreground">resets {formatDate(cycleEnd)}</p>
          )}
        </div>
      )}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
