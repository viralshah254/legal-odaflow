"use client"

import { cn } from "@/lib/utils"

interface ConfidenceBadgeProps {
  confidence: number
  showLabel?: boolean
  size?: 'sm' | 'md'
}

function getColorClasses(confidence: number): string {
  if (confidence >= 0.9) return 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
  if (confidence >= 0.75) return 'bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400'
  if (confidence >= 0.5) return 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
  return 'bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-red-400'
}

export function ConfidenceBadge({ confidence, showLabel = true, size = 'sm' }: ConfidenceBadgeProps) {
  const pct = Math.round(confidence * 100)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium tabular-nums",
        getColorClasses(confidence),
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm',
      )}
      title={`Confidence: ${pct}%`}
    >
      {showLabel ? `${pct}%` : pct}
    </span>
  )
}
