"use client"
import { useTranslations } from "next-intl"

import { cn } from "@/lib/utils"

interface WinProbabilityBarProps {
  winProbability: { low: number; mid: number; high: number }
  className?: string
}

function toPercent(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100)
}

export function WinProbabilityBar({ winProbability, className }: WinProbabilityBarProps) {
  const t = useTranslations("issueChecker")
  const low = toPercent(winProbability.low)
  const high = toPercent(winProbability.high)
  const mid = toPercent(winProbability.mid)

  const fillLeft = low
  const fillWidth = high - low

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{t("estimated_outcome_strength")}</span>
        <span className="font-bold text-primary">
          {low}–{high}%
          <span className="ml-1 text-xs text-muted-foreground font-normal">
            ({t("midLabel", { value: mid })})
          </span>
        </span>
      </div>

      <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-amber-400 to-emerald-500 opacity-20 rounded-full" />
        <div
          className="absolute top-0 h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all"
          style={{
            left: `${fillLeft}%`,
            width: `${Math.max(fillWidth, 4)}%`,
          }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-white/80 shadow-sm"
          style={{ left: `${mid}%` }}
        />
      </div>

      <p className="text-xs text-muted-foreground">{t("outcomeEstimateDisclaimer")}</p>
    </div>
  )
}
