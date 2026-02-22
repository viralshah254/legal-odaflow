"use client"

import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import { getMatterById } from "@/lib/mock/matters"
import { getClientById } from "@/lib/mock/clients"
import { cn } from "@/lib/utils"

export function ContextPills({ className }: { className?: string }) {
  const { context, setClientId, setMatterId, setTaskId, setInvoiceId } = useCopilotContext()
  const matter = context.selectedMatterId ? getMatterById(context.selectedMatterId) : null
  const client = context.selectedClientId ? getClientById(context.selectedClientId) : null

  const hasAny =
    context.selectedClientId ||
    context.selectedMatterId ||
    context.selectedTaskId ||
    context.selectedInvoiceId

  if (!hasAny) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        No context selected. Open a client or matter to add context.
      </p>
    )
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {context.selectedClientId && (
        <Badge
          variant="secondary"
          className="gap-1 pr-1 text-xs font-normal"
        >
          Client: {client?.name ?? context.selectedClientId}
          <button
            type="button"
            aria-label="Clear client"
            className="rounded p-0.5 hover:bg-muted"
            onClick={() => setClientId(undefined)}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {context.selectedMatterId && (
        <Badge
          variant="secondary"
          className="gap-1 pr-1 text-xs font-normal"
        >
          Matter: {matter?.title ?? context.selectedMatterId}
          <button
            type="button"
            aria-label="Clear matter"
            className="rounded p-0.5 hover:bg-muted"
            onClick={() => setMatterId(undefined)}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {context.selectedTaskId && (
        <Badge
          variant="secondary"
          className="gap-1 pr-1 text-xs font-normal"
        >
          Task
          <button
            type="button"
            aria-label="Clear task"
            className="rounded p-0.5 hover:bg-muted"
            onClick={() => setTaskId(undefined)}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {context.selectedInvoiceId && (
        <Badge
          variant="secondary"
          className="gap-1 pr-1 text-xs font-normal"
        >
          Invoice
          <button
            type="button"
            aria-label="Clear invoice"
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
