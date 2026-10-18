"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getWorkQueues } from "@/lib/api/analytics"
import { Loader2 } from "lucide-react"
import { format } from "date-fns"

export default function QueuesPage() {
  const t = useTranslations("lawyer")
  const { activeTenantId, isLoading: tenantLoading } = useTenant()
  const { data: queues, isLoading: queuesLoading, error } = useApiData(
    ["work-queues", activeTenantId],
    {
      apiFn: () => getWorkQueues(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const isLoading = tenantLoading || !activeTenantId || queuesLoading || !queues

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-destructive">
        Failed to load work queues: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("my_work_queues")}</h1>
        <p className="text-muted-foreground">{t("work_that_needs_your_attention")}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4" data-tour="queues-grid">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Intake Queue
              <Badge variant="secondary">{queues.intake.count}</Badge>
            </CardTitle>
            <CardDescription>{t("new_matters_awaiting_intake")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {queues.intake.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("no_items")}</p>
            ) : (
              queues.intake.items.slice(0, 8).map((m) => (
                <Link
                  key={m.id}
                  href={`/app/matters/${m.id}`}
                  className="block p-2 rounded-md border hover:bg-muted/50 text-sm"
                >
                  <span className="font-medium">{m.title}</span>
                  {m.stage && (
                    <span className="text-muted-foreground ml-2">{m.stage}</span>
                  )}
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              KYC Queue
              <Badge variant="secondary">{queues.kyc.count}</Badge>
            </CardTitle>
            <CardDescription>{t("clients_with_missing_or_expired_kyc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {queues.kyc.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("no_items")}</p>
            ) : (
              queues.kyc.items.slice(0, 8).map((k) => (
                <Link
                  key={k.clientId}
                  href={`/app/clients/${k.clientId}`}
                  className="block p-2 rounded-md border hover:bg-muted/50 text-sm"
                >
                  <span className="font-medium">{k.clientName}</span>
                  <span className="text-muted-foreground ml-2">
                    {k.pendingCount} issue{k.pendingCount !== 1 ? "s" : ""}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Billing Queue
              <Badge variant="secondary">{queues.billing.count}</Badge>
            </CardTitle>
            <CardDescription>{t("overdue_invoices")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {queues.billing.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("no_overdue_invoices")}</p>
            ) : (
              queues.billing.items.slice(0, 8).map((inv) => (
                <div key={inv.id} className="p-2 rounded-md border text-sm">
                  <span className="font-medium">{inv.invoiceNumber}</span>
                  <span className="text-muted-foreground ml-2">
                    {inv.amount} · {inv.dueDate ? format(new Date(inv.dueDate), "MMM d") : "No due date"}
                  </span>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/accounting/invoices">{t("view_all_invoices")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Trust Approval Queue
              <Badge variant="secondary">{queues.trustApproval.count}</Badge>
            </CardTitle>
            <CardDescription>{t("pending_trust_disbursement_approvals")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {queues.trustApproval.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("no_pending_approvals")}</p>
            ) : (
              queues.trustApproval.items.slice(0, 8).map((e) => (
                <div key={e.id} className="p-2 rounded-md border text-sm">
                  <span className="font-medium">{e.account.name}</span>
                  <span className="text-muted-foreground ml-2">
                    {e.type} {e.amount}
                  </span>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/trust">{t("go_to_trust")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Overdue Critical Deadlines
              <Badge variant="destructive">{queues.overdueCriticalTasks.count}</Badge>
            </CardTitle>
            <CardDescription>{t("high-priority_tasks_past_due")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {queues.overdueCriticalTasks.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("no_overdue_critical_tasks")}</p>
            ) : (
              queues.overdueCriticalTasks.items.slice(0, 10).map((t) => (
                <Link
                  key={t.id}
                  href="/app/tasks"
                  className="block p-2 rounded-md border hover:bg-muted/50 text-sm"
                >
                  <span className="font-medium">{t.title}</span>
                  <Badge variant="outline" className="ml-2">{t.priority}</Badge>
                  {t.dueDate && (
                    <span className="text-muted-foreground ml-2">
                      Due {format(new Date(t.dueDate), "MMM d")}
                    </span>
                  )}
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
