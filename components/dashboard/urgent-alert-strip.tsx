"use client"

import { Alert } from "@/lib/mock/alerts"
import { AlertCard } from "./alert-card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertCircle } from "lucide-react"

interface UrgentAlertStripProps {
  alerts: Alert[]
  showAssignee?: boolean
  className?: string
}

export function UrgentAlertStrip({ alerts, showAssignee = false, className }: UrgentAlertStripProps) {
  if (alerts.length === 0) {
    return (
      <div className="p-4 rounded-lg border border-border/50 bg-muted/30 text-center text-sm text-muted-foreground">
        <AlertCircle className="h-5 w-5 mx-auto mb-2 opacity-50" />
        No urgent alerts
      </div>
    )
  }

  return (
    <ScrollArea className={className}>
      <div className="flex gap-4 pb-2">
        {alerts.map((alert) => (
          <div key={alert.id} className="min-w-[320px] max-w-[400px]">
            <AlertCard
              id={alert.id}
              title={alert.title}
              description={alert.description}
              severity={alert.severity}
              matterTitle={alert.matterTitle}
              taskTitle={alert.taskTitle}
              dueAt={alert.dueAt}
              assignedToName={showAssignee ? alert.assignedToName : undefined}
            />
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

