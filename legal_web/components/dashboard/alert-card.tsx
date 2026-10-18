"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AlertSeverity, AlertType } from "@/lib/types/alerts"
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
import { useTenant } from "@/lib/contexts/tenant-context"
import { acknowledgeAlert, completeAlert, skipAlert } from "@/lib/api/alerts"

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
  dueAt?: Date | string
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
  const t = useTranslations("dashboard.alerts")
  const router = useRouter()
  const { currentRole, currentUser } = useRole()
  const { activeTenantId } = useTenant()
  const [isProcessing, setIsProcessing] = useState(false)

  const severityColors = {
    Critical: "bg-red-500/8 text-red-700 dark:text-red-400 border-red-500/25",
    High: "bg-orange-500/8 text-orange-700 dark:text-orange-400 border-orange-500/25",
    Normal: "bg-blue-500/8 text-blue-700 dark:text-blue-400 border-blue-500/25",
  }

  const severityCardExtra = {
    Critical: "severity-pulse-critical",
    High: "",
    Normal: "",
  }

  const getDueDateText = () => {
    if (!dueAt) return null
    const due = dueAt instanceof Date ? dueAt : new Date(dueAt)
    const now = new Date()
    const diff = due.getTime() - now.getTime()
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    const hours = Math.floor(diff / (60 * 60 * 1000))

    if (diff < 0) {
      const overdueDays = Math.abs(days)
      return overdueDays === 0 ? t("dueToday") : t("overdueDays", { days: overdueDays })
    }
    if (days === 0) return t("dueInHours", { hours })
    if (days === 1) return t("dueTomorrow")
    return t("dueInDays", { days })
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
      router.push(path)
      onAction?.()
    }
  }

  const handleComplete = async () => {
    if (!activeTenantId) return
    setIsProcessing(true)
    try {
      await completeAlert(activeTenantId, id)
      onAction?.()
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSkip = async () => {
    if (!activeTenantId) return
    setIsProcessing(true)
    try {
      await skipAlert(activeTenantId, id)
      onAction?.()
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAcknowledge = async () => {
    if (!activeTenantId) return
    setIsProcessing(true)
    try {
      await acknowledgeAlert(activeTenantId, id)
      onAction?.()
    } finally {
      setIsProcessing(false)
    }
  }

  const navigationPath = getNavigationPath()
  const isPersistedAlert = !id.startsWith("kyc-") && !id.startsWith("assist-")
  const canInteract =
    isPersistedAlert &&
    !acknowledged &&
    (assignedToName === currentUser?.name || currentRole === "PARTNER_ADMIN")

  const goToLabel = matterId ? t("goToMatter") : clientId ? t("goToClient") : t("goToTask")

  return (
    <Card
      className={cn(
        "border-l-4 hover:shadow-lg transition-all duration-200 cursor-pointer card-glow",
        severityColors[severity],
        severityCardExtra[severity],
        acknowledged && "opacity-50",
        className
      )}
      onClick={navigationPath ? handleNavigate : undefined}
    >
      <CardContent className="p-3 sm:p-4">
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
                          {goToLabel}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAcknowledge(); }}>
                        <Check className="mr-2 h-4 w-4" />
                        {t("acknowledge")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleComplete(); }}>
                        <Check className="mr-2 h-4 w-4" />
                        {t("markComplete")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleSkip(); }} className="text-destructive">
                        <X className="mr-2 h-4 w-4" />
                        {t("skip")}
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
              {assignedToName && <span>{t("assignedTo", { name: assignedToName })}</span>}
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
                  {t("viewDetails")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
