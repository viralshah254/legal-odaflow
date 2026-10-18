"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  TrendingUp,
  TrendingDown,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  BarChart3,
  Target,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface OutcomeMetric {
  label: string
  value: number | null
  unit: "%"
  benchmark?: number
  higherIsBetter?: boolean
  description: string
}

interface FirmBenchmarksDashboardProps {
  metrics?: OutcomeMetric[]
  practiceArea?: string
  jurisdiction?: string
  /** If true the dashboard is shown in portal-safe (client-facing) mode — hides internal benchmarks. */
  portalSafe?: boolean
  onPublishToPortal?: () => void
  className?: string
}

const DEFAULT_METRICS: OutcomeMetric[] = [
  {
    label: "Win rate",
    value: null,
    unit: "%",
    benchmark: 68,
    higherIsBetter: true,
    description: "Percentage of matters resolved in client's favour.",
  },
  {
    label: "Settlement rate",
    value: null,
    unit: "%",
    benchmark: 72,
    higherIsBetter: true,
    description: "Matters resolved by settlement vs. trial.",
  },
  {
    label: "Time to resolution",
    value: null,
    unit: "%",
    benchmark: 60,
    higherIsBetter: false,
    description: "Matters closed within target timeline.",
  },
  {
    label: "Client satisfaction",
    value: null,
    unit: "%",
    benchmark: 90,
    higherIsBetter: true,
    description: "Clients rating the outcome as satisfactory.",
  },
]

function MetricBar({
  metric,
  portalSafe,
}: {
  metric: OutcomeMetric
  portalSafe?: boolean
}) {
  const value = metric.value
  const pct = value !== null ? Math.min(Math.max(value, 0), 100) : null
  const isGood =
    pct !== null && metric.benchmark
      ? metric.higherIsBetter !== false
        ? pct >= metric.benchmark
        : pct <= metric.benchmark
      : null

  const barColor =
    isGood === true
      ? "bg-green-500"
      : isGood === false
        ? "bg-amber-500"
        : "bg-muted-foreground/30"

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{metric.label}</span>
          {isGood === true && <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />}
          {isGood === false && <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
        </div>
        <div className="flex items-center gap-2">
          {pct !== null ? (
            <span className={cn("font-mono font-semibold", isGood === true ? "text-green-700 dark:text-green-400" : isGood === false ? "text-amber-700 dark:text-amber-400" : "")}>
              {pct.toFixed(0)}{metric.unit}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs italic">No data yet</span>
          )}
          {!portalSafe && metric.benchmark && (
            <span className="text-xs text-muted-foreground">
              (benchmark: {metric.benchmark}{metric.unit})
            </span>
          )}
        </div>
      </div>
      <Progress value={pct ?? 0} className="h-2" />
      {!portalSafe && (
        <p className="text-[10px] text-muted-foreground">{metric.description}</p>
      )}
    </div>
  )
}

/**
 * Firm benchmarks dashboard surfacing outcome-governed MI.
 * In portal-safe mode it hides internal benchmarks and shows only client-approved summaries.
 */
export function FirmBenchmarksDashboard({
  metrics = DEFAULT_METRICS,
  practiceArea,
  jurisdiction,
  portalSafe = false,
  onPublishToPortal,
  className,
}: FirmBenchmarksDashboardProps) {
  const [publishedToPortal, setPublishedToPortal] = useState(false)

  const handlePublish = () => {
    setPublishedToPortal(true)
    onPublishToPortal?.()
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                Outcome benchmarks
                {portalSafe ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                    <Eye className="h-2.5 w-2.5" />
                    Client view
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                    <Lock className="h-2.5 w-2.5" />
                    Firm internal
                  </Badge>
                )}
              </CardTitle>
              {(practiceArea || jurisdiction) && (
                <CardDescription className="text-xs mt-0.5">
                  {[practiceArea, jurisdiction].filter(Boolean).join(" · ")}
                </CardDescription>
              )}
            </div>
          </div>

          {/* Portal publish button */}
          {!portalSafe && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 shrink-0"
              onClick={handlePublish}
              disabled={publishedToPortal}
            >
              {publishedToPortal ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  Published
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5" />
                  Publish to portal
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map((m) => (
          <MetricBar key={m.label} metric={m} portalSafe={portalSafe} />
        ))}

        {!portalSafe && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-start gap-2 mt-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-primary">AI insight</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Outcome data is only surfaced after lawyer approval. Navigate to any matter's Outcome tab to run analysis and approve results before they appear here.
              </p>
            </div>
          </div>
        )}

        {portalSafe && (
          <p className="text-[10px] text-muted-foreground text-center border-t pt-3">
            Outcome data is lawyer-reviewed and approved before publication.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
