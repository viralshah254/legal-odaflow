"use client"
import { useTranslations } from "next-intl"

import { useParams, useRouter } from "next/navigation"
import { useMemo } from "react"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getMatter } from "@/lib/api/matters"
import { listInvoices } from "@/lib/api/billing"
import type { ApiInvoice } from "@/lib/api/types"
import { MatterWorkspaceShell } from "@/components/matters/matter-workspace-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { Receipt, Plus, ExternalLink } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

function getStatusColor(status: string) {
  if (status === "PAID") return "text-green-600"
  if (status === "OVERDUE") return "text-red-600"
  if (status === "CANCELLED") return "text-muted-foreground line-through"
  return "text-foreground"
}

function formatCurrency(amount: string | number, currency: string) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (isNaN(num)) return `${currency} 0.00`
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(num)
}

export default function MatterBillingPage() {
  const t = useTranslations("matters")
  const tBilling = useTranslations("billing")
  const params = useParams()
  const router = useRouter()
  const matterId = params.matterId as string
  const { activeTenantId } = useTenant()

  const { data: matter, isLoading: matterLoading } = useApiData(
    ["matter-billing-shell", activeTenantId, matterId],
    {
      apiFn: () => getMatter(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  const { data: allInvoices = [], isLoading: invoicesLoading } = useApiData<ApiInvoice[]>(
    ["invoices-all-for-matter", activeTenantId],
    {
      apiFn: () => listInvoices(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const invoices = useMemo(
    () => allInvoices.filter((inv) => inv.metadata?.matterId === matterId),
    [allInvoices, matterId],
  )

  if (matterLoading) return <PageSkeleton />
  if (!matter || !activeTenantId) return null

  return (
    <MatterWorkspaceShell matter={matter} tenantId={activeTenantId} showIntelligenceSidebar={false}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{t("billing")}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("invoices")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/app/accounting/invoices/new?matterId=${matterId}`}>
              <Button size="sm">
                <Plus className="mr-2 h-3.5 w-3.5" />
                {t("createInvoice")}
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push(`/app/accounting/invoices?matterId=${matterId}`)}
            >
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              {t("allInvoices")}
            </Button>
          </div>
        </div>

        {invoicesLoading ? (
          <PageSkeleton />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={t("noInvoicesForMatter")}
            description={t("billing")}
            actionLabel={t("createInvoice")}
            actionHref={`/app/accounting/invoices/new?matterId=${matterId}`}
          />
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <Link key={inv.id} href={`/app/accounting/invoices/${inv.id}`}>
                <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <Receipt className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                          <Badge variant="outline" className="text-xs capitalize">
                            {inv.status.toLowerCase()}
                          </Badge>
                        </div>
                        <p className={cn("text-sm font-semibold mt-0.5", getStatusColor(inv.status))}>
                          {formatCurrency(inv.amount, inv.currency)}
                        </p>
                        {inv.metadata?.description && (
                          <p className="text-xs text-muted-foreground truncate">{inv.metadata.description}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MatterWorkspaceShell>
  )
}
