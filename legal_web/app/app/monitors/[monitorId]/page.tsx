"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { useApiData } from "@/lib/hooks/use-api-data"
import {
  getMonitor,
  listMonitorHits,
  updateMonitorHit,
  MONITOR_JURISDICTIONS,
  MONITOR_TOPICS,
  type MonitorHit,
} from "@/lib/api/monitors"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import {
  AlertTriangle,
  ArrowLeft,
  BookmarkCheck,
  CheckCheck,
  ExternalLink,
  Info,
  Radio,
} from "lucide-react"

const SEVERITY_CONFIG: Record<string, { icon: React.FC<{ className?: string }>; badge: string; label: string }> = {
  CRITICAL: { icon: AlertTriangle, badge: "destructive", label: "Critical" },
  WARNING: { icon: AlertTriangle, badge: "warning", label: "Warning" },
  INFO: { icon: Info, badge: "secondary", label: "Info" },
}

function topicLabel(id: string) {
  return MONITOR_TOPICS.find((t) => t.id === id)?.label ?? id
}

function jurisdictionLabel(code: string) {
  return MONITOR_JURISDICTIONS.find((j) => j.code === code)?.label ?? code
}

type HitFilter = "all" | "NEW" | "SAVED" | "DISMISSED"

export default function MonitorDetailPage() {
  const { monitorId } = useParams<{ monitorId: string }>()
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [filter, setFilter] = useState<HitFilter>("all")
  const [loadingHitId, setLoadingHitId] = useState<string | null>(null)

  const { data: monitor, isLoading: monitorLoading } = useApiData(
    ["monitor", activeTenantId, monitorId],
    {
      apiFn: () => getMonitor(activeTenantId!, monitorId),
      enabled: !!activeTenantId && !!monitorId,
    },
  )

  const { data: hits = [], isLoading: hitsLoading } = useApiData(
    ["monitor-hits", activeTenantId, monitorId, filter],
    {
      apiFn: () => listMonitorHits(activeTenantId!, monitorId, filter === "all" ? undefined : filter),
      enabled: !!activeTenantId && !!monitorId,
    },
  )

  const invalidateHits = () =>
    queryClient.invalidateQueries({ queryKey: ["monitor-hits", activeTenantId, monitorId] })

  const handleHitAction = async (hit: MonitorHit, status: MonitorHit["status"]) => {
    if (!activeTenantId) return
    setLoadingHitId(hit.id)
    try {
      await updateMonitorHit(activeTenantId, monitorId, hit.id, status)
      await invalidateHits()
    } catch {
      toast({ title: "Failed to update hit", variant: "destructive" })
    } finally {
      setLoadingHitId(null)
    }
  }

  if (monitorLoading) {
    return (
      <div className="p-6">
        <PageSkeleton rows={4} />
      </div>
    )
  }

  if (!monitor) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Monitor not found.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-0.5 shrink-0" asChild>
          <Link href="/app/monitors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Radio className="h-5 w-5 text-primary shrink-0" />
            <h1 className="text-2xl font-bold truncate">{monitor.name}</h1>
            <Badge variant={monitor.isActive ? "default" : "secondary"}>
              {monitor.isActive ? "Active" : "Paused"}
            </Badge>
          </div>
          {monitor.description && (
            <p className="text-muted-foreground text-sm">{monitor.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline">{jurisdictionLabel(monitor.jurisdiction)}</Badge>
            <Badge variant="outline">{monitor.frequency}</Badge>
            {monitor.topics.map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">{topicLabel(t)}</Badge>
            ))}
          </div>
          {monitor.lastRunAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Last scanned {formatDistanceToNow(new Date(monitor.lastRunAt), { addSuffix: true })}
            </p>
          )}
        </div>
      </div>

      <Separator />

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as HitFilter)}>
        <TabsList>
          <TabsTrigger value="all">All hits</TabsTrigger>
          <TabsTrigger value="NEW">New</TabsTrigger>
          <TabsTrigger value="SAVED">Saved</TabsTrigger>
          <TabsTrigger value="DISMISSED">Dismissed</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Hits list */}
      {hitsLoading ? (
        <PageSkeleton rows={4} />
      ) : hits.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Radio className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hits yet</p>
          <p className="text-sm">New regulatory changes will appear here after the next scan.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {hits.map((hit) => {
            const { icon: Icon, label: severityLabel } = SEVERITY_CONFIG[hit.severity] ?? SEVERITY_CONFIG.INFO
            return (
              <Card
                key={hit.id}
                className={cn(
                  "transition-all",
                  hit.status === "DISMISSED" && "opacity-50",
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <Icon
                      className={cn(
                        "h-4 w-4 mt-0.5 shrink-0",
                        hit.severity === "CRITICAL" && "text-destructive",
                        hit.severity === "WARNING" && "text-amber-600 dark:text-amber-400",
                        hit.severity === "INFO" && "text-muted-foreground",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-semibold leading-snug">
                          {hit.title}
                        </CardTitle>
                        <Badge
                          variant={
                            hit.severity === "CRITICAL"
                              ? "destructive"
                              : hit.severity === "WARNING"
                              ? "outline"
                              : "secondary"
                          }
                          className="shrink-0 text-xs"
                        >
                          {severityLabel}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs mt-0.5">
                        {hit.sourceName && `${hit.sourceName} · `}
                        {formatDistanceToNow(new Date(hit.createdAt), { addSuffix: true })}
                        {" · "}
                        relevance {Math.round(hit.relevanceScore * 100)}%
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                {hit.aiSummary && (
                  <CardContent className="pb-3 pt-0">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {hit.aiSummary}
                    </p>
                  </CardContent>
                )}

                <CardContent className="pt-0 pb-3">
                  <div className="flex items-center gap-2">
                    {hit.sourceUrl && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
                        <a href={hit.sourceUrl} target="_blank" rel="noopener noreferrer">
                          Source <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                    {hit.status !== "SAVED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        disabled={loadingHitId === hit.id}
                        onClick={() => handleHitAction(hit, "SAVED")}
                      >
                        <BookmarkCheck className="h-3 w-3" />
                        Save
                      </Button>
                    )}
                    {hit.status !== "DISMISSED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-muted-foreground"
                        disabled={loadingHitId === hit.id}
                        onClick={() => handleHitAction(hit, "DISMISSED")}
                      >
                        <CheckCheck className="h-3 w-3" />
                        Dismiss
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
