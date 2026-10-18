"use client"

import { useState } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/components/ui/page-header"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"
import { CreateMonitorDialog } from "@/components/monitors/create-monitor-dialog"
import { useApiData } from "@/lib/hooks/use-api-data"
import { listMonitors, updateMonitor, deleteMonitor, MONITOR_TOPICS, MONITOR_JURISDICTIONS, type Monitor } from "@/lib/api/monitors"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Bell, BellOff, ChevronRight, Clock, Plus, Radio, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-destructive/10 text-destructive border-destructive/20",
  WARNING: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400",
  INFO: "bg-muted text-muted-foreground",
}

function topicLabel(id: string) {
  return MONITOR_TOPICS.find((t) => t.id === id)?.label ?? id
}

function jurisdictionLabel(code: string) {
  return MONITOR_JURISDICTIONS.find((j) => j.code === code)?.label ?? code
}

export default function MonitorsPage() {
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const { data: monitors = [], isLoading } = useApiData(
    ["monitors", activeTenantId],
    {
      apiFn: () => listMonitors(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["monitors", activeTenantId] })

  const handleToggle = async (monitor: Monitor) => {
    if (!activeTenantId) return
    setTogglingId(monitor.id)
    try {
      await updateMonitor(activeTenantId, monitor.id, { isActive: !monitor.isActive })
      await invalidate()
    } catch {
      toast({ title: "Failed to update monitor", variant: "destructive" })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (monitor: Monitor) => {
    if (!activeTenantId) return
    if (!confirm(`Delete monitor "${monitor.name}"? This cannot be undone.`)) return
    try {
      await deleteMonitor(activeTenantId, monitor.id)
      await invalidate()
      toast({ title: "Monitor deleted" })
    } catch {
      toast({ title: "Failed to delete monitor", variant: "destructive" })
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <PageSkeleton rows={5} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Monitors"
        description="Always-on regulatory intelligence. Get AI-summarised alerts when laws change in your practice areas."
        actions={
          <div className="flex items-center gap-2" data-tour="monitors-create">
            <OpenCopilotButton />
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New monitor
            </Button>
          </div>
        }
      />

      {monitors.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No monitors yet"
          description="Create your first regulatory monitor to start tracking legal changes in your jurisdictions."
          onAction={() => setCreateOpen(true)}
          actionLabel="Create monitor"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-tour="monitors-list">
          {monitors.map((monitor) => (
            <Card
              key={monitor.id}
              className={cn(
                "relative transition-all",
                !monitor.isActive && "opacity-60",
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Radio className={cn("h-4 w-4 shrink-0", monitor.isActive ? "text-primary" : "text-muted-foreground")} />
                    <CardTitle className="text-base truncate">{monitor.name}</CardTitle>
                  </div>
                  <Switch
                    checked={monitor.isActive}
                    disabled={togglingId === monitor.id}
                    onCheckedChange={() => handleToggle(monitor)}
                  />
                </div>
                <CardDescription className="text-xs">
                  {jurisdictionLabel(monitor.jurisdiction)} · {monitor.frequency.toLowerCase()}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Topics */}
                <div className="flex flex-wrap gap-1">
                  {monitor.topics.slice(0, 4).map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {topicLabel(t)}
                    </Badge>
                  ))}
                  {monitor.topics.length > 4 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      +{monitor.topics.length - 4}
                    </Badge>
                  )}
                </div>

                {/* Hit counts */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {(monitor.newHitCount ?? 0) > 0 ? (
                      <Bell className="h-3 w-3 text-primary" />
                    ) : (
                      <BellOff className="h-3 w-3" />
                    )}
                    {monitor.newHitCount ?? 0} new · {monitor.totalHitCount ?? 0} total
                  </span>
                  {monitor.lastRunAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(monitor.lastRunAt), { addSuffix: true })}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Link href={`/app/monitors/${monitor.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1 text-xs">
                      View hits
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(monitor)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateMonitorDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={invalidate}
      />
    </div>
  )
}
