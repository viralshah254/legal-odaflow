"use client"

import { CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface CharCountBadgeProps {
  current: number
  min: number
  max: number
  className?: string
}

/**
 * Compact numeric progress badge that sits at the bottom-right of a textarea
 * wrapper. Shows current/min while below the minimum (amber), then
 * current/max with a green tick once the minimum is met.
 */
export function CharCountBadge({ current, min, max, className }: CharCountBadgeProps) {
  const ready = current >= min
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums transition-colors duration-200",
        ready
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      {ready && <CheckCircle2 className="h-3 w-3 shrink-0" />}
      {ready ? `${current} / ${max}` : `${current} / ${min}`}
    </span>
  )
}
