"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertSeverity, AlertType } from "@/lib/mock/alerts"
import { AlertCircle, Clock, FileText, Check, X, ArrowRight, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useRole } from "@/lib/contexts/role-context"
import { mockUsers } from "@/lib/mock/users"
import { completeAlert, skipAlert } from "@/lib/mock/alerts"
import { logAlertAction } from "@/lib/mock/alert-actions"

interface AlertCardProps {
  id: string
  title: string
  description?: string
  severity: AlertSeverity
  type: AlertType
  matterId?: string
  matterTitle?: string
  taskId?: string
  taskTitle?: string
  clientId?: string
  clientName?: string
  dueAt?: Date
  assignedToName?: string
  acknowledged?: boolean
  className?: string
  onAction?: () => void
}

export function AlertCard({
  id,
  title,
  description,
  severity,
  type,
  matterId,
  matterTitle,
  taskId,
  taskTitle,
  clientId,
  clientName,
  dueAt,
  assignedToName,
  acknowledged = false,
  className,
  onAction,
}: AlertCardProps) {
  const router = useRouter()
  const { currentRole, currentUser } = useRole()
  const user = currentUser || mockUsers.find((u) => u.role === currentRole) || mockUsers[0]
  const [isProcessing, setIsProcessing] = useState(false)

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

  const getNavigationPath = (): string | null => {
    if (type === "TASK" && taskId) {
      return `/app/tasks?task=${taskId}`
    }
    if (type === "DEADLINE" && matterId) {
      return `/app/matters/${matterId}`
    }
    if (type === "KYC_MISSING" || type === "KYC_EXPIRED") {
      if (clientId) return `/app/clients/${clientId}?tab=kyc`
      if (matterId) return `/app/matters/${matterId}`
    }
    if (type === "ASSISTANCE_REQUEST" && matterId) {
      return `/app/matters/${matterId}`
    }
    if (matterId) {
      return `/app/matters/${matterId}`
    }
    if (clientId) {
      return `/app/clients/${clientId}`
    }
    return null
  }

  const handleNavigate = () => {
    const path = getNavigationPath()
    if (path) {
      logAlertAction(id, "NAVIGATED", user.id, user.name, undefined, path)
      router.push(path)
      onAction?.()
    }
  }

  const handleComplete = () => {
    setIsProcessing(true)
    completeAlert(id)
    logAlertAction(id, "COMPLETED", user.id, user.name, "Alert marked as completed")
    setTimeout(() => {
      setIsProcessing(false)
      onAction?.()
    }, 300)
  }

  const handleSkip = () => {
    setIsProcessing(true)
    skipAlert(id)
    logAlertAction(id, "SKIPPED", user.id, user.name, "Alert skipped by user")
    setTimeout(() => {
      setIsProcessing(false)
      onAction?.()
    }, 300)
  }

  const navigationPath = getNavigationPath()
  const canInteract = !acknowledged && (assignedToName === user.name || currentRole === "PARTNER_ADMIN")

  return (
    <Card
      className={cn(
        "border-l-4 hover:shadow-md transition-all cursor-pointer",
        severityColors[severity],
        acknowledged && "opacity-60",
        className
      )}
      onClick={navigationPath ? handleNavigate : undefined}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <AlertCircle
              className={cn(
                "h-5 w-5",
                severity === "Critical" ? "text-red-600" : severity === "High" ? "text-orange-600" : "text-blue-600"
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-semibold text-sm text-foreground">{title}</h4>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("text-xs shrink-0", severityColors[severity])}>
                  {severity}
                </Badge>
                {canInteract && !isProcessing && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {navigationPath && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleNavigate(); }}>
                          <ArrowRight className="mr-2 h-4 w-4" />
                          Go to {matterId ? "Matter" : clientId ? "Client" : "Task"}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleComplete(); }}>
                        <Check className="mr-2 h-4 w-4" />
                        Mark Complete
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleSkip(); }} className="text-destructive">
                        <X className="mr-2 h-4 w-4" />
                        Skip
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
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
            {navigationPath && (
              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleNavigate()
                  }}
                  className="text-xs"
                >
                  <ArrowRight className="mr-1 h-3 w-3" />
                  View Details
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
