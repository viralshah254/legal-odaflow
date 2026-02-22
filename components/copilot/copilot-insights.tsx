"use client"

import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { getMissingItems } from "@/lib/mock/copilot"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import Link from "next/link"

export function CopilotInsights() {
  const { context, hasPermission } = useCopilotContext()
  const hasContext = !!(context.selectedMatterId || context.selectedClientId)
  const missing = hasContext ? getMissingItems({ matterId: context.selectedMatterId, clientId: context.selectedClientId }) : null

  if (!hasPermission("canUseCopilotChat")) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        You don&apos;t have permission to view Copilot insights.
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Risk flags & what&apos;s missing
          </CardTitle>
          <CardDescription>
            {hasContext
              ? "Based on current matter/client context."
              : "Open a matter or client page to see insights here."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasContext ? (
            <p className="py-6 text-center text-muted-foreground text-sm">
              No context selected. Open a matter or client so Copilot can show missing KYC, overdue tasks, and overdue invoices.
            </p>
          ) : missing && missing.items.length > 0 ? (
            <ul className="space-y-2">
              {missing.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                  <span>
                    <strong>{item.label}</strong>
                    {item.detail && <span className="text-muted-foreground"> — {item.detail}</span>}
                    {item.path && (
                      <Link href={item.path} className="ml-2 text-primary hover:underline text-xs">
                        View
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2 py-6 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              Nothing critical missing for the current context.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
