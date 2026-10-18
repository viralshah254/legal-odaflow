"use client"
import { useTranslations } from "next-intl"
import Link from "next/link"

import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { listAuditLogs } from "@/lib/api/audit"
import { listAllMonitorHits, updateMonitorHit, type MonitorHitWithMonitor } from "@/lib/api/monitors"
import { useApiData } from "@/lib/hooks/use-api-data"
import type { Alert } from "@/lib/types/alerts"
import { AlertCard } from "@/components/dashboard/alert-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RoleGate } from "@/components/dashboard/role-gate"
import { formatUserDateTimeShort } from "@/lib/datetime/format-in-user-timezone"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { ErrorState } from "@/components/ui/error-state"
import { useQueryClient } from "@tanstack/react-query"
import { useWorkspaceAlerts } from "@/lib/hooks/use-workspace-alerts"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Radio,
  ShieldAlert,
  X,
} from "lucide-react"

// ── MonitorHitCard ─────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { border: string; bg: string; badge: string; dot: string }> = {
  CRITICAL: {
    border: "border-destructive/30",
    bg: "bg-destructive/5",
    badge: "bg-destructive/10 text-destructive border-destructive/20",
    dot: "bg-destructive",
  },
  WARNING: {
    border: "border-amber-400/30",
    bg: "bg-amber-50/60 dark:bg-amber-950/20",
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  INFO: {
    border: "border-border",
    bg: "bg-card",
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
}

function MonitorHitCard({
  hit,
  onDismiss,
}: {
  hit: MonitorHitWithMonitor
  onDismiss: (id: string) => void
}) {
  const style = SEVERITY_STYLES[hit.severity] ?? SEVERITY_STYLES.INFO

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border p-4 transition-all",
        style.border,
        style.bg,
      )}
    >
      {/* Severity stripe */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-0.5 rounded-t-xl",
          hit.severity === "CRITICAL" && "bg-gradient-to-r from-destructive/70 to-destructive/20",
          hit.severity === "WARNING" && "bg-gradient-to-r from-amber-500/70 to-amber-500/20",
          hit.severity === "INFO" && "bg-gradient-to-r from-muted-foreground/30 to-transparent",
        )}
      />

      <div className="flex items-start gap-3 pt-1">
        <span className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", style.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-snug line-clamp-2">{hit.title}</p>
            <div className="flex items-center gap-1 shrink-0">
              <Badge variant="outline" className={cn("text-[10px] font-semibold border", style.badge)}>
                {hit.severity}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => onDismiss(hit.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {hit.monitor && (
            <div className="flex items-center gap-1.5 mt-1">
              <Radio className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {hit.monitor.name} · {hit.monitor.jurisdiction}
              </span>
            </div>
          )}

          {hit.aiSummary && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
              {hit.aiSummary}
            </p>
          )}

          <div className="flex items-center justify-between mt-3">
            <span className="text-[10px] text-muted-foreground">
              {hit.createdAt ? new Date(hit.createdAt).toLocaleDateString() : ""}
            </span>
            <div className="flex items-center gap-2">
              {hit.sourceUrl && (
                <a
                  href={hit.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Source <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
              <Link
                href={`/app/monitors/${hit.monitorId}`}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View monitor <ChevronRight className="h-2.5 w-2.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AlertsPage ─────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const t = useTranslations("lawyer")
  const tCommon = useTranslations("common")
  const { currentRole } = useRole()
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()

  const { alertsToShow, criticalAlerts, highAlerts, isLoading, error, regulatoryHitCount } =
    useWorkspaceAlerts()

  const { data: auditLogs = [] } = useApiData(["alert-audit", activeTenantId], {
    apiFn: () => listAuditLogs(activeTenantId!, { entityType: "alert", limit: 50 }),
    enabled: !!activeTenantId && currentRole === "PARTNER_ADMIN",
  })

  const {
    data: regulatoryHits = [],
    isLoading: hitsLoading,
    refetch: refetchHits,
  } = useApiData(["monitor-hits-new", activeTenantId], {
    apiFn: () => listAllMonitorHits(activeTenantId!, "NEW", 100),
    enabled: !!activeTenantId,
  })

  const invalidateAlerts = () => {
    queryClient.invalidateQueries({ queryKey: ["alerts", activeTenantId] })
    queryClient.invalidateQueries({ queryKey: ["dashboard-kyc-missing", activeTenantId] })
    queryClient.invalidateQueries({ queryKey: ["dashboard-kyc-expired", activeTenantId] })
    queryClient.invalidateQueries({ queryKey: ["dashboard-assistance", activeTenantId] })
    queryClient.invalidateQueries({ queryKey: ["me-counts", activeTenantId] })
  }

  const handleDismissHit = async (hitId: string) => {
    const hit = regulatoryHits.find((h) => h.id === hitId)
    if (!hit || !activeTenantId) return
    try {
      await updateMonitorHit(activeTenantId, hit.monitorId, hitId, "DISMISSED")
      queryClient.invalidateQueries({ queryKey: ["monitor-hits-new", activeTenantId] })
      queryClient.invalidateQueries({ queryKey: ["monitors-dashboard", activeTenantId] })
    } catch {
      // silent
    }
  }

  const totalAllCount = alertsToShow.length + regulatoryHitCount

  const renderAlerts = (alerts: Alert[]) =>
    alerts.length === 0 ? (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">{t("no_alerts")}</p>
        </CardContent>
      </Card>
    ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {alerts.map((alert) => (
          <AlertCard
            key={alert.id}
            id={alert.id}
            title={alert.title}
            description={alert.description}
            severity={alert.severity}
            type={alert.type}
            matterId={alert.matterId}
            matterTitle={alert.matterTitle}
            taskId={alert.taskId}
            taskTitle={alert.taskTitle}
            clientId={alert.clientId}
            clientName={alert.clientName}
            dueAt={alert.dueAt}
            assignedToName={
              currentRole === "PARTNER_ADMIN" ? alert.assignedToName : undefined
            }
            acknowledged={alert.acknowledged}
            onAction={invalidateAlerts}
          />
        ))}
      </div>
    )

  if (!activeTenantId || isLoading) {
    return (
      <div className="p-6">
        <PageSkeleton rows={6} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState message="Failed to load alerts." />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6" data-tour="alerts-list">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Intelligence &amp; Alerts</h1>
          <p className="text-muted-foreground">
            {currentRole === "PARTNER_ADMIN"
              ? "Firm alerts, notifications, and regulatory intelligence"
              : "Your alerts, notifications, and regulatory updates"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {regulatoryHitCount > 0 && (
            <Link href="#" onClick={() => {}}>
              <Badge
                variant="outline"
                className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
              >
                <Radio className="h-3 w-3" />
                {regulatoryHitCount} regulatory
              </Badge>
            </Link>
          )}
          <OpenCopilotButton />
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">
            All
            {totalAllCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                {totalAllCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="critical">
            Critical
            {criticalAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                {criticalAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="high">
            High
            {highAlerts.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                {highAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="regulatory" className="gap-1.5">
            <Radio className="h-3.5 w-3.5" />
            Regulatory
            {regulatoryHitCount > 0 && (
              <Badge
                variant="outline"
                className="ml-0.5 h-4 min-w-4 px-1 text-[10px] border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
              >
                {regulatoryHitCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6 space-y-6">
          {regulatoryHits.slice(0, 2).length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  <Radio className="h-4 w-4" />
                  Recent regulatory updates
                </div>
                <Link href="#regulatory" className="text-xs text-primary flex items-center gap-1 hover:underline">
                  View all {regulatoryHitCount} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {regulatoryHits.slice(0, 2).map((hit) => (
                  <MonitorHitCard key={hit.id} hit={hit} onDismiss={handleDismissHit} />
                ))}
              </div>
            </div>
          )}
          {renderAlerts(alertsToShow)}
        </TabsContent>

        <TabsContent value="critical" className="mt-6">
          {renderAlerts(criticalAlerts)}
        </TabsContent>

        <TabsContent value="high" className="mt-6">
          {renderAlerts(highAlerts)}
        </TabsContent>

        <TabsContent value="regulatory" className="mt-6" id="regulatory">
          {hitsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : regulatoryHits.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-3">
                <ShieldAlert className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="text-muted-foreground">No new regulatory updates</p>
                <p className="text-xs text-muted-foreground/70">
                  Set up monitors to track regulatory changes across jurisdictions
                </p>
                <Link href="/app/monitors">
                  <Button variant="outline" size="sm" className="mt-2 gap-1.5">
                    <Radio className="h-3.5 w-3.5" />
                    Go to Monitors
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {regulatoryHits.map((hit) => (
                <MonitorHitCard key={hit.id} hit={hit} onDismiss={handleDismissHit} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{t("alert_action_history")}</CardTitle>
            <CardDescription>{t("track_alert-related_audit_events")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No alert actions recorded yet
                  </p>
                ) : (
                  auditLogs.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{entry.action}</Badge>
                          <span className="text-sm font-medium">
                            {entry.user?.name ?? entry.userId ?? "System"}
                          </span>
                          {entry.entityId && (
                            <span className="text-xs text-muted-foreground">
                              on alert: {entry.entityId}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatUserDateTimeShort(entry.createdAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </RoleGate>
    </div>
  )
}
