"use client"

import { useState } from "react"
import { AlertTriangle, Brain, CheckCircle2, FileWarning, Loader2, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  getLatestMatterAnalysis,
  runMatterAnalysis,
  type MatterAnalysisSnapshot,
} from "@/lib/api/matter-analysis-snapshot"
import { useApiData } from "@/lib/hooks/use-api-data"

function InsightList({
  title,
  items,
  icon: Icon,
}: {
  title: string
  items?: string[] | null
  icon: React.ElementType
}) {
  const safeItems = items ?? []
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      {safeItems.length ? (
        <ul className="space-y-1.5 text-sm">
          {safeItems.slice(0, 3).map((item) => <li key={item}>• {item}</li>)}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No items identified.</p>
      )}
    </div>
  )
}

export function MatterBriefCard({
  tenantId,
  matterId,
}: {
  tenantId: string
  matterId: string
}) {
  const { toast } = useToast()
  const [running, setRunning] = useState(false)
  const {
    data: snapshot,
    isLoading,
    refetch,
  } = useApiData<MatterAnalysisSnapshot | null>(
    ["matter-analysis-snapshot", tenantId, matterId],
    {
      apiFn: () => getLatestMatterAnalysis(tenantId, matterId),
      enabled: Boolean(tenantId && matterId),
    },
  )

  async function run() {
    setRunning(true)
    try {
      await runMatterAnalysis(tenantId, matterId)
      await refetch()
      toast({ title: "Matter analysis refreshed" })
    } catch {
      toast({ title: "Matter analysis could not be refreshed", variant: "destructive" })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card id="matter-brief" className="scroll-mt-28 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-primary" /> Matter brief
              {snapshot && <Badge variant="secondary">{snapshot.sourceDocumentCount} sources</Badge>}
            </CardTitle>
            {snapshot && (
              <p className="mt-1 text-xs text-muted-foreground">
                Updated {new Date(snapshot.createdAt).toLocaleString()}
              </p>
            )}
          </div>
          <Button type="button" size="sm" variant={snapshot ? "outline" : "default"} onClick={() => void run()} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {snapshot ? "Refresh analysis" : "Run full analysis"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading matter intelligence…
          </div>
        ) : !snapshot ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <Brain className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Build a reliable “what’s up” view</p>
            <p className="mt-1 text-xs text-muted-foreground">Analyze matter facts, active tasks, documents, risks, and missing information together.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm leading-relaxed">{snapshot.summary}</p>
            <div className="grid gap-5 border-t pt-4 md:grid-cols-3">
              <InsightList title="Top risks" items={snapshot.risks} icon={AlertTriangle} />
              <InsightList title="Next actions" items={snapshot.nextActions} icon={CheckCircle2} />
              <InsightList title="Evidence gaps" items={snapshot.evidenceGaps} icon={FileWarning} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
