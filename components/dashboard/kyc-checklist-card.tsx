"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { KycChecklist, KycDocument, KycDocStatus, getKycDocTypeLabel } from "@/lib/types/kyc"
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface KycChecklistCardProps {
  checklist: KycChecklist
  clientName?: string
  className?: string
}

export function KycChecklistCard({ checklist, clientName, className }: KycChecklistCardProps) {
  const getStatusIcon = (status: KycDocStatus) => {
    switch (status) {
      case "VERIFIED":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "RECEIVED":
        return <Clock className="h-4 w-4 text-blue-600" />
      case "EXPIRED":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />
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

  const completedCount = checklist.documents.filter((d) => d.status === "VERIFIED" || d.status === "RECEIVED").length
  const totalCount = checklist.documents.length

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>KYC Checklist</CardTitle>
            {clientName && <CardDescription>{clientName}</CardDescription>}
          </div>
          <Badge variant={checklist.completed ? "default" : "destructive"}>
            {completedCount}/{totalCount} Complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {checklist.documents.map((doc) => {
            const statusBadge = getStatusBadge(doc.status)
            return (
              <div
                key={doc.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  doc.status === "MISSING" ? "border-red-500/20 bg-red-500/5" :
                  doc.status === "EXPIRED" ? "border-orange-500/20 bg-orange-500/5" :
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
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Expires: {new Date(doc.expiryDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant={statusBadge.variant} className={cn("text-xs", statusBadge.className)}>
                  {doc.status}
                </Badge>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

