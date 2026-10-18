"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  KycChecklist,
  KycDocStatus,
  getKycDocStatusLabel,
  getKycDocTypeLabel,
} from "@/lib/types/kyc"
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const KYC_STATUS_PRIORITY: Record<KycDocStatus, number> = {
  EXPIRED: 0,
  MISSING: 1,
  RECEIVED: 2,
  VERIFIED: 3,
}

interface KycChecklistCardProps {
  checklist: KycChecklist
  clientName?: string
  className?: string
  onManageKyc?: () => void
  manageKycHref?: string
  manageKycLabel?: string
}

export function KycChecklistCard({
  checklist,
  clientName,
  className,
  onManageKyc,
  manageKycHref,
  manageKycLabel,
}: KycChecklistCardProps) {
  const t = useTranslations("dashboard.kyc")
  const translateOr = (key: string, fallback: string, values?: Record<string, string | number>) => {
    try {
      return t.has(key) ? t(key, values) : fallback
    } catch {
      return fallback
    }
  }

  const getStatusIcon = (status: KycDocStatus) => {
    switch (status) {
      case "VERIFIED":
        return <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-green-600" />
      case "RECEIVED":
        return <Clock aria-hidden="true" className="h-4 w-4 text-blue-600" />
      case "EXPIRED":
        return <AlertCircle aria-hidden="true" className="h-4 w-4 text-red-600" />
      default:
        return <XCircle aria-hidden="true" className="h-4 w-4 text-red-600" />
    }
  }

  const getStatusBadge = (status: KycDocStatus) => {
    const variants: Record<KycDocStatus, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
      VERIFIED: { variant: "default", className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" },
      RECEIVED: { variant: "secondary", className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" },
      EXPIRED: { variant: "destructive", className: "" },
      MISSING: { variant: "outline", className: "" },
    }
    return variants[status]
  }

  const completedCount = checklist.documents.filter((d) => d.status === "VERIFIED").length
  const totalCount = checklist.documents.length
  const isComplete = totalCount > 0 && completedCount === totalCount
  const manageLabel =
    manageKycLabel ?? translateOr("manageKyc", "Manage KYC")

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{translateOr("checklist", "KYC checklist")}</CardTitle>
            {clientName && <CardDescription>{clientName}</CardDescription>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge
              variant={isComplete ? "default" : "destructive"}
              aria-label={translateOr(
                "completionProgressAccessible",
                `${completedCount} of ${totalCount} KYC documents verified`,
                { completed: completedCount, total: totalCount },
              )}
            >
              {translateOr(
                "completionProgress",
                `${completedCount} of ${totalCount} verified`,
                { completed: completedCount, total: totalCount },
              )}
            </Badge>
            {onManageKyc ? (
              <Button size="sm" variant="outline" onClick={onManageKyc}>
                {manageLabel}
              </Button>
            ) : manageKycHref ? (
              <Button size="sm" variant="outline" asChild>
                <a href={manageKycHref}>{manageLabel}</a>
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...checklist.documents]
            .sort(
              (left, right) =>
                KYC_STATUS_PRIORITY[left.status] - KYC_STATUS_PRIORITY[right.status],
            )
            .map((doc) => {
            const statusBadge = getStatusBadge(doc.status)
            return (
              <div
                key={doc.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  doc.status === "MISSING" ? "border-red-500/50 bg-red-500/10" :
                  doc.status === "EXPIRED" ? "border-orange-500/50 bg-orange-500/10" :
                  doc.status === "VERIFIED" ? "border-green-500/20 bg-green-500/5" :
                  "border-border/50 bg-muted/30"
                )}
              >
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIcon(doc.status)}
                  <div className="flex-1">
                    <div className="font-medium text-sm">{getKycDocTypeLabel(doc.docType)}</div>
                    {doc.fileName && (
                      <div className="text-xs text-muted-foreground mt-0.5">{doc.fileName}</div>
                    )}
                    {doc.expiryDate && (
                      <div
                        className={cn(
                          "mt-0.5 text-xs text-muted-foreground",
                          doc.status === "EXPIRED" && "font-medium text-orange-700 dark:text-orange-400",
                        )}
                      >
                        {translateOr(
                          doc.status === "EXPIRED" ? "expiredOn" : "expires",
                          `${doc.status === "EXPIRED" ? "Expired" : "Expires"}: ${new Date(doc.expiryDate).toLocaleDateString()}`,
                          { date: new Date(doc.expiryDate).toLocaleDateString() },
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <Badge
                  variant={statusBadge.variant}
                  className={cn("text-xs", statusBadge.className)}
                  aria-label={translateOr(
                    "documentStatus",
                    `KYC status: ${getKycDocStatusLabel(doc.status)}`,
                    { status: getKycDocStatusLabel(doc.status) },
                  )}
                >
                  {translateOr(
                    `status${getKycDocStatusLabel(doc.status)}`,
                    getKycDocStatusLabel(doc.status),
                  )}
                </Badge>
              </div>
            )
            })}
        </div>
      </CardContent>
    </Card>
  )
}
