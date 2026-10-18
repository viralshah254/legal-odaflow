"use client"

import Link from "next/link"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getMonitorsSummary } from "@/lib/api/monitors"
import { useTenant } from "@/lib/contexts/tenant-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRight, Radio, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"

export function MonitorsWidget() {
  const { activeTenantId } = useTenant()

  const { data: summary, isLoading } = useApiData(
    ["monitors-dashboard", activeTenantId],
    {
      apiFn: () => getMonitorsSummary(activeTenantId!),
      enabled: !!activeTenantId,
      placeholderData: { criticalCount: 0, warningCount: 0, infoCount: 0, totalUnread: 0 },
    },
  )

  const pills = [
    {
      label: "Critical",
      count: summary?.criticalCount ?? 0,
      color: "bg-destructive/10 text-destructive border-destructive/20",
      dot: "bg-destructive",
    },
    {
      label: "Warning",
      count: summary?.warningCount ?? 0,
      color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
      dot: "bg-amber-500",
    },
    {
      label: "Info",
      count: summary?.infoCount ?? 0,
      color: "bg-muted text-muted-foreground border-border",
      dot: "bg-muted-foreground",
    },
  ]

  const totalUnread = summary?.totalUnread ?? 0

  return (
    <Card className="card-glow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Radio className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">Regulatory Intelligence</CardTitle>
            {totalUnread > 0 && (
              <Badge
                variant="destructive"
                className="h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full"
              >
                {totalUnread}
              </Badge>
            )}
          </div>
          <Link href="/app/monitors">
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
              View all
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 flex-1 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : totalUnread === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 gap-2 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No active regulatory alerts</p>
            <Link href="/app/settings/enterprise">
              <Button variant="link" size="sm" className="text-xs h-auto p-0">
                Set up regulatory monitors →
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex gap-3">
            {pills.map((pill) => (
              <Link
                key={pill.label}
                href={`/app/monitors`}
                className="flex-1 group"
              >
                <div
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border px-3 py-3 gap-1 transition-all",
                    "hover:shadow-sm hover:-translate-y-0.5",
                    pill.color,
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={cn("w-2 h-2 rounded-full", pill.dot)} />
                    <span className="text-xs font-medium">{pill.label}</span>
                  </div>
                  <span className="text-2xl font-bold tabular-nums">{pill.count}</span>
                  <span className="text-[10px] opacity-70">new hits</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
