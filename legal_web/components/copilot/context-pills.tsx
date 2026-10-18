"use client"
import { useTranslations } from "next-intl"

import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { getClient } from "@/lib/api/clients"
import { getMatter } from "@/lib/api/matters"
import { useApiData } from "@/lib/hooks/use-api-data"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export function ContextPills({ className }: { className?: string }) {
  const t = useTranslations("copilot")
  const { context, setClientId, setMatterId, setTaskId, setInvoiceId } = useCopilotContext()
  const { activeTenantId } = useTenant()

  const { data: matter } = useApiData(
    ["copilot-context-matter", activeTenantId, context.selectedMatterId],
    {
      apiFn: () => getMatter(activeTenantId!, context.selectedMatterId!),
      enabled: !!activeTenantId && !!context.selectedMatterId,
    },
  )

  const { data: client } = useApiData(
    ["copilot-context-client", activeTenantId, context.selectedClientId],
    {
      apiFn: () => getClient(activeTenantId!, context.selectedClientId!),
      enabled: !!activeTenantId && !!context.selectedClientId,
    },
  )

  const hasAny =
    context.selectedClientId ||
    context.selectedMatterId ||
    context.selectedTaskId ||
    context.selectedInvoiceId

  if (!hasAny) {
    return (
      <Badge variant="outline" className={cn("text-xs font-normal gap-1", className)}>
        {t("firmWorkspace")}
        {activeTenantId && (
          <span className="text-muted-foreground">{t("tenant-scoped")}</span>
        )}
      </Badge>
    )
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {context.selectedClientId && (
        <Badge variant="secondary" className="gap-1 pr-1 text-xs font-normal">
          {t("clientPill")} {client?.name ?? context.selectedClientId}
          <button
            type="button"
            aria-label={t("clear_client")}
            className="rounded p-0.5 hover:bg-muted"
            onClick={() => setClientId(undefined)}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {context.selectedMatterId && (
        <Badge variant="secondary" className="gap-1 pr-1 text-xs font-normal">
          {t("matterPill")} {matter?.title ?? context.selectedMatterId}
          <button
            type="button"
            aria-label={t("clear_matter")}
            className="rounded p-0.5 hover:bg-muted"
            onClick={() => setMatterId(undefined)}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {context.selectedTaskId && (
        <Badge variant="secondary" className="gap-1 pr-1 text-xs font-normal">
          {t("taskPill")}
          <button
            type="button"
            aria-label={t("clear_task")}
            className="rounded p-0.5 hover:bg-muted"
            onClick={() => setTaskId(undefined)}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {context.selectedInvoiceId && (
        <Badge variant="secondary" className="gap-1 pr-1 text-xs font-normal">
          {t("invoicePill")}
          <button
            type="button"
            aria-label={t("clear_invoice")}
            className="rounded p-0.5 hover:bg-muted"
            onClick={() => setInvoiceId(undefined)}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
    </div>
  )
}
