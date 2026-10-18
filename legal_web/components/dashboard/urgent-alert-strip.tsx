"use client"

import { useTranslations } from "next-intl"
import type { Alert } from "@/lib/types/alerts"
import { AlertCard } from "./alert-card"
import { BellOff } from "lucide-react"

interface UrgentAlertStripProps {
  alerts: Alert[]
  showAssignee?: boolean
  className?: string
}

export function UrgentAlertStrip({ alerts, showAssignee = false, className }: UrgentAlertStripProps) {
  const t = useTranslations("dashboard.alerts")

  if (alerts.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-border/50 bg-muted/20 flex items-center gap-3 text-sm text-muted-foreground">
        <BellOff className="h-4 w-4 shrink-0 opacity-60" />
        <span>{t("noUrgentAlerts")}</span>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="relative">
        <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none rounded-r-xl" />
        <div className="overflow-x-auto scroll-fade-x pb-2 -mx-1 px-1">
          <div className="flex gap-3 snap-x snap-mandatory">
            {alerts.map((alert) => (
              <div key={alert.id} className="min-w-[280px] max-w-[360px] snap-start shrink-0 w-[85vw] sm:w-auto">
                <AlertCard
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
                  assignedToName={showAssignee ? alert.assignedToName : undefined}
                  acknowledged={alert.acknowledged}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
