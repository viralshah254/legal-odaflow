"use client"
import { useTranslations } from "next-intl"

import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { listAuditLogs, type AuditLogEntry } from "@/lib/api/audit"
import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format, parseISO } from "date-fns"
import { Loader2 } from "lucide-react"
import Link from "next/link"

export default function CompliancePage() {
  const t = useTranslations("settings")
  const { activeTenantId } = useTenant()

  const { data: logs = [], isLoading } = useApiData<AuditLogEntry[]>(
    ["audit-logs", activeTenantId],
    {
      apiFn: () => listAuditLogs(activeTenantId!, { limit: 100 }),
      enabled: !!activeTenantId,
    },
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("compliance_audit")}</h1>
          <p className="text-muted-foreground">
            Immutable audit trail for auth, data access, trust, and payments
          </p>
        </div>
        <OpenCopilotButton />
      </div>

      <div className="text-sm">
        <Link href="/app/settings/governance" className="text-primary hover:underline">
          ← Governance policies
        </Link>
        {" · "}
        <Link href="/app/copilot/audit" className="text-primary hover:underline">
          Copilot audit log
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("audit_log")}</CardTitle>
          <CardDescription>{t("recent_tenant-scoped_events")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No audit entries yet. Activity will appear as your team uses the platform.
            </p>
          ) : (
            <ul className="divide-y">
              {logs.map((entry) => (
                <li key={entry.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
                  <div>
                    <div className="font-medium text-sm">{entry.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.entityType}
                      {entry.entityId ? ` · ${entry.entityId}` : ""}
                      {entry.user?.email ? ` · ${entry.user.email}` : ""}
                    </div>
                  </div>
                  <Badge variant="outline" className="w-fit shrink-0">
                    {format(parseISO(entry.createdAt), "PPp")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
