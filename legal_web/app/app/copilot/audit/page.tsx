"use client"
import { useTranslations } from "next-intl"

import { useMemo, useState } from "react"
import { getCopilotAuditLog } from "@/lib/api/copilot"
import { listTenantUsers } from "@/lib/api/users"
import type { CopilotAuditEntry } from "@/lib/types/copilot"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { RoleGate } from "@/components/dashboard/role-gate"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format, isValid } from "date-fns"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  formatToolName,
  formatSessionTimestamp,
  getAuditPayloadSummary,
  isRecord,
  safeJsonStringify,
} from "@/lib/copilot/session-display"

function formatAuditTime(value: Date, pattern: string): string {
  return isValid(value) ? format(value, pattern) : "—"
}

export default function CopilotAuditPage() {
  const t = useTranslations("copilot")
  const { activeTenantId } = useTenant()
  const [selected, setSelected] = useState<CopilotAuditEntry | null>(null)

  const { data: apiEntries, isLoading, error } = useApiData(
    ["copilot-audit", activeTenantId],
    {
      apiFn: () => getCopilotAuditLog(activeTenantId!, 100),
      enabled: !!activeTenantId,
    },
  )

  const { data: tenantUsers = [] } = useApiData(
    ["tenant-users", activeTenantId],
    {
      apiFn: () => listTenantUsers(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const userNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const member of tenantUsers) {
      const label = member.user.name?.trim() || member.user.email
      map.set(member.userId, label)
      map.set(member.user.id, label)
    }
    return map
  }, [tenantUsers])

  const entries = useMemo<CopilotAuditEntry[]>(() => {
    if (!Array.isArray(apiEntries)) return []
    return apiEntries.map((e) => ({
      id: e.id,
      timestamp: new Date(e.timestamp),
      userId: e.userId,
      userRole: e.userRole,
      action: e.action as CopilotAuditEntry["action"],
      toolName: (e.toolName ?? "unknown") as CopilotAuditEntry["toolName"],
      payload: isRecord(e.payload) ? e.payload : {},
      result: e.result,
      error: e.error ?? undefined,
      actionProposalId: e.actionProposalId,
    }))
  }, [apiEntries])

  const resolveUserLabel = (userId: string, userRole?: string) => {
    const name = userNameById.get(userId)
    if (name && userRole) return `${name} · ${userRole.replace(/_/g, " ")}`
    if (name) return name
    return userId
  }

  return (
    <RoleGate
      allowedRoles={["PARTNER_ADMIN"]}
      fallback={
        <div className="p-6 text-center text-muted-foreground">
          {t("noInsightsPermission")}
        </div>
      }
    >
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/app/settings/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">{t("copilot_audit_log")}</h1>
              <p className="text-muted-foreground">{t("auditDescription")}</p>
            </div>
          </div>
        </div>

        <Card data-tour="copilot-audit-list">
          <CardHeader>
            <CardTitle>{t("copilot_audit_log")}</CardTitle>
            <CardDescription>{t("auditCardDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="text-sm text-destructive py-8 text-center">
                {t("failedToLoadAudit")}
              </p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {t("auditEmpty")}
              </p>
            ) : (
              <div className="space-y-2">
                {entries.map((e) => {
                  const summary = getAuditPayloadSummary(e.payload)
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setSelected(e)}
                      className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant={
                                e.action === "executed"
                                  ? "default"
                                  : e.action === "failed"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {e.action}
                            </Badge>
                            <span className="font-medium text-sm">
                              {formatToolName(String(e.toolName))}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {resolveUserLabel(e.userId, e.userRole)}
                          </p>
                          {summary && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{summary}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
                          {formatSessionTimestamp(e.timestamp.toISOString())}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selected
                  ? `${formatToolName(String(selected.toolName))} · ${selected.action}`
                  : t("copilot_audit_log")}
              </DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("user")}</span>{" "}
                  {resolveUserLabel(selected.userId, selected.userRole)}
                </div>
                <div>
                  <span className="text-muted-foreground">{t("time")}</span>{" "}
                  {formatAuditTime(selected.timestamp, "PPpp")}
                </div>
                {Object.keys(selected.payload).length > 0 && (
                  <div>
                    <span className="text-muted-foreground">{t("payload")}</span>
                    <pre className="mt-1 p-2 rounded bg-muted text-xs overflow-auto max-h-40 whitespace-pre-wrap break-words">
                      {safeJsonStringify(selected.payload)}
                    </pre>
                  </div>
                )}
                {selected.result !== undefined && selected.result !== null && (
                  <div>
                    <span className="text-muted-foreground">{t("result")}</span>
                    <pre className="mt-1 p-2 rounded bg-muted text-xs overflow-auto max-h-40 whitespace-pre-wrap break-words">
                      {safeJsonStringify(selected.result)}
                    </pre>
                  </div>
                )}
                {selected.error && (
                  <div className="text-destructive">
                    <span className="text-muted-foreground">{t("error")}</span> {selected.error}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </RoleGate>
  )
}
