import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertSeverity } from "@/lib/mock/alerts"
import { AlertCircle, Clock, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface AlertCardProps {
  id: string
  title: string
  description?: string
  severity: AlertSeverity
  matterTitle?: string
  taskTitle?: string
  dueAt?: Date
  assignedToName?: string
  className?: string
}

export function AlertCard({
  id,
  title,
  description,
  severity,
  matterTitle,
  taskTitle,
  dueAt,
  assignedToName,
  className,
}: AlertCardProps) {
  const severityColors = {
    Critical: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    High: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
    Normal: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  }

  const getDueDateText = () => {
    if (!dueAt) return null
    const now = new Date()
    const diff = dueAt.getTime() - now.getTime()
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    const hours = Math.floor(diff / (60 * 60 * 1000))

    if (diff < 0) {
      const overdueDays = Math.abs(days)
      return overdueDays === 0 ? "Due today" : `${overdueDays}d overdue`
    }
    if (days === 0) return `Due in ${hours}h`
    if (days === 1) return "Due tomorrow"
    return `Due in ${days}d`
  }

  return (
    <Card className={cn("border-l-4 hover:shadow-md transition-all", severityColors[severity], className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <AlertCircle className={cn("h-5 w-5", severity === "Critical" ? "text-red-600" : severity === "High" ? "text-orange-600" : "text-blue-600")} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-semibold text-sm text-foreground">{title}</h4>
              <Badge variant="outline" className={cn("text-xs shrink-0", severityColors[severity])}>
                {severity}
              </Badge>
            </div>
            {description && <p className="text-sm text-muted-foreground mb-2">{description}</p>}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {matterTitle && (
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span className="truncate">{matterTitle}</span>
                </div>
              )}
              {taskTitle && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span className="truncate">{taskTitle}</span>
                </div>
              )}
              {dueAt && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span className={cn(dueAt < new Date() ? "text-red-600 dark:text-red-400 font-medium" : "")}>
                    {getDueDateText()}
                  </span>
                </div>
              )}
              {assignedToName && <span>Assigned to {assignedToName}</span>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

