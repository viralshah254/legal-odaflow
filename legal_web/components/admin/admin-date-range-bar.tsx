"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type DateRangePreset = "7d" | "30d" | "90d" | "365d" | "all" | "custom"

export interface AdminDateRange {
  preset: DateRangePreset
  from?: string
  to?: string
}

const PRESETS: { id: DateRangePreset; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "365d", label: "12 months" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom" },
]

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export function resolveDateRange(range: AdminDateRange): {
  from?: string
  to?: string
  days: number
  label: string
} {
  const now = new Date()
  const endOfToday = new Date(now)
  endOfToday.setUTCHours(23, 59, 59, 999)
  const to = range.to ?? endOfToday.toISOString()

  if (range.preset === "custom") {
    const from = range.from
    if (from && range.to) {
      const days = Math.max(
        1,
        Math.ceil((new Date(range.to).getTime() - new Date(from).getTime()) / 86_400_000),
      )
      return { from, to: range.to, days: Math.min(days, 365), label: "Custom range" }
    }
    return { from, to, days: 30, label: "Custom range" }
  }

  if (range.preset === "all") {
    return { to, days: 365, label: "All time" }
  }

  const daysMap: Record<Exclude<DateRangePreset, "custom" | "all">, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "365d": 365,
  }
  const days = daysMap[range.preset as keyof typeof daysMap] ?? 30
  return {
    from: daysAgoIso(days),
    to,
    days,
    label: PRESETS.find((p) => p.id === range.preset)?.label ?? `${days} days`,
  }
}

interface AdminDateRangeBarProps {
  value: AdminDateRange
  onChange: (next: AdminDateRange) => void
  className?: string
}

export function AdminDateRangeBar({ value, onChange, className }: AdminDateRangeBarProps) {
  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)}>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant={value.preset === preset.id ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() =>
              onChange({
                preset: preset.id,
                from: preset.id === "custom" ? value.from : undefined,
                to: preset.id === "custom" ? value.to : undefined,
              })
            }
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {value.preset === "custom" && (
        <>
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              className="h-8 text-xs mt-1 w-[140px]"
              value={value.from?.slice(0, 10) ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  from: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined,
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              className="h-8 text-xs mt-1 w-[140px]"
              value={value.to?.slice(0, 10) ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  to: e.target.value ? `${e.target.value}T23:59:59.999Z` : undefined,
                })
              }
            />
          </div>
        </>
      )}
    </div>
  )
}
