import type { LucideIcon } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { SummaryMetricCard } from "@/components/ui/summary-metric-card"

export interface ClientSummaryMetric {
  key: string
  label: string
  value?: string | number
  icon: LucideIcon
  tab: string
  isLoading?: boolean
  hasError?: boolean
}

interface ClientSummaryMetricsProps {
  metrics: ClientSummaryMetric[]
  unavailableLabel: string
  loadingLabel: string
  openSectionLabel: (label: string) => string
  onSelectTab: (tab: string) => void
}

export function ClientSummaryMetrics({
  metrics,
  unavailableLabel,
  loadingLabel,
  openSectionLabel,
  onSelectTab,
}: ClientSummaryMetricsProps) {
  return (
    <section
      aria-label="Client summary"
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
    >
      {metrics.map((metric) =>
        metric.isLoading ? (
          <div
            key={metric.key}
            className="flex min-h-24 items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4"
            role="status"
            aria-label={`${metric.label}: ${loadingLabel}`}
          >
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-12" />
            </div>
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>
        ) : (
          <SummaryMetricCard
            key={metric.key}
            label={metric.label}
            value={metric.hasError ? unavailableLabel : (metric.value ?? unavailableLabel)}
            icon={metric.icon}
            onClick={() => onSelectTab(metric.tab)}
            aria-label={
              metric.hasError
                ? `${metric.label}: ${unavailableLabel}`
                : `${metric.label}: ${metric.value}. ${openSectionLabel(metric.label)}`
            }
          />
        ),
      )}
    </section>
  )
}
