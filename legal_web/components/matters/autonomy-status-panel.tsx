"use client"

import { useEffect, useState } from "react"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useRealtime } from "@/lib/contexts/realtime-context"
import { useToast } from "@/hooks/use-toast"
import {
  listSimilarCases,
  listOpponentAnalyses,
  type MatterAnalysisRun,
} from "@/lib/api/matter-analysis"
import { listMatterStrategyMemos } from "@/lib/api/matter-intelligence"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sparkles,
  Scale,
  Users,
  Brain,
  RefreshCw,
  CheckCircle2,
  Clock,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

interface AnalysisSnapshot {
  lastRun: Date | null
  count: number
  hasAuto: boolean
}

interface AutonomyStatusPanelProps {
  matterId: string
  onRerunAll?: () => void
}

function StatusRow({
  icon: Icon,
  label,
  snapshot,
}: {
  icon: React.ElementType
  label: string
  snapshot: AnalysisSnapshot
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {snapshot.count > 0 ? (
          <>
            {snapshot.hasAuto && (
              <Badge variant="secondary" className="text-xs gap-1 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-700">
                <Sparkles className="h-2.5 w-2.5" />
                Auto
              </Badge>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {snapshot.lastRun
                ? formatDistanceToNow(snapshot.lastRun, { addSuffix: true })
                : "—"}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Not yet run
          </span>
        )}
      </div>
    </div>
  )
}

export function AutonomyStatusPanel({ matterId, onRerunAll }: AutonomyStatusPanelProps) {
  const { activeTenantId } = useTenant()
  const { subscribe } = useRealtime()
  const { toast } = useToast()

  const [similar, setSimilar] = useState<AnalysisSnapshot>({ lastRun: null, count: 0, hasAuto: false })
  const [opponent, setOpponent] = useState<AnalysisSnapshot>({ lastRun: null, count: 0, hasAuto: false })
  const [strategy, setStrategy] = useState<AnalysisSnapshot>({ lastRun: null, count: 0, hasAuto: false })
  const [loading, setLoading] = useState(true)

  function toSnapshot(runs: MatterAnalysisRun[]): AnalysisSnapshot {
    if (runs.length === 0) return { lastRun: null, count: 0, hasAuto: false }
    const sorted = [...runs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    return {
      lastRun: new Date(sorted[0].createdAt),
      count: runs.length,
      hasAuto: runs.some((r) => r.trigger === "auto"),
    }
  }

  async function load() {
    if (!activeTenantId) return
    try {
      const [simRuns, oppRuns, stratMemos] = await Promise.all([
        listSimilarCases(activeTenantId, matterId).catch(() => [] as MatterAnalysisRun[]),
        listOpponentAnalyses(activeTenantId, matterId).catch(() => [] as MatterAnalysisRun[]),
        listMatterStrategyMemos(activeTenantId, matterId).catch(() => [] as { createdAt: string; trigger?: string }[]),
      ])

      setSimilar(toSnapshot(simRuns))
      setOpponent(toSnapshot(oppRuns))

      // Strategy memos don't have trigger field exposed yet — treat as plain count
      const stratSnapshot: AnalysisSnapshot =
        stratMemos.length > 0
          ? {
              lastRun: new Date(
                [...stratMemos].sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                )[0].createdAt,
              ),
              count: stratMemos.length,
              hasAuto: false,
            }
          : { lastRun: null, count: 0, hasAuto: false }

      setStrategy(stratSnapshot)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [activeTenantId, matterId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for autonomy completion events from SSE
  useEffect(() => {
    const unsub = subscribe("matter.autonomy.completed" as Parameters<typeof subscribe>[0], (payload) => {
      if (payload.entityId !== matterId) return
      void load()
      toast({
        title: "AI analysis complete",
        description:
          payload.action === "init"
            ? "Matter intelligence has been auto-generated (similar cases, opponent analysis, strategy)."
            : "Matter intelligence refreshed with latest data.",
        duration: 6000,
      })
    })
    return unsub
  }, [matterId, subscribe, toast]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasAnyRun = similar.count > 0 || opponent.count > 0 || strategy.count > 0

  return (
    <Card className="border-violet-200 dark:border-violet-800/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-500" />
            Autonomy Status
          </CardTitle>
          {hasAnyRun && (
            <Badge
              variant="secondary"
              className="text-xs gap-1 bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300 border-violet-200 dark:border-violet-800"
            >
              <Sparkles className="h-2.5 w-2.5" />
              AI Auto-analyzed
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        {loading ? (
          <div className="animate-pulse space-y-2 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-muted rounded w-full" />
            ))}
          </div>
        ) : (
          <>
            <StatusRow icon={Scale} label="Similar Cases" snapshot={similar} />
            <Separator className="my-0.5" />
            <StatusRow icon={Users} label="Opponent Analysis" snapshot={opponent} />
            <Separator className="my-0.5" />
            <StatusRow icon={Brain} label="Strategy Memos" snapshot={strategy} />

            {onRerunAll && (
              <div className="mt-3 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRerunAll}
                  className="text-xs h-7 gap-1.5"
                >
                  <RefreshCw className="h-3 w-3" />
                  Re-run all
                </Button>
              </div>
            )}

            {!hasAnyRun && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Autonomy analysis will run automatically after matter creation and document uploads.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
