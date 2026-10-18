"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useCopilotContext } from "@/lib/contexts/copilot-context"

const ENTITY_ROUTE_RULES: Array<{
  pattern: RegExp
  apply: (match: RegExpMatchArray) => {
    selectedMatterId?: string
    selectedClientId?: string
    selectedTaskId?: string
    selectedInvoiceId?: string
  }
}> = [
  {
    pattern: /^\/app\/matters\/([^/]+)(?:\/|$)/,
    apply: (m) => {
      const id = m[1]
      if (!id || id === "new") return {}
      return {
        selectedMatterId: id,
        selectedClientId: undefined,
        selectedTaskId: undefined,
        selectedInvoiceId: undefined,
      }
    },
  },
  {
    pattern: /^\/app\/clients\/([^/]+)(?:\/|$)/,
    apply: (m) => {
      const id = m[1]
      if (!id || id === "new") return {}
      return {
        selectedClientId: id,
        selectedMatterId: undefined,
        selectedTaskId: undefined,
        selectedInvoiceId: undefined,
      }
    },
  },
  {
    pattern: /^\/app\/tasks\/([^/]+)(?:\/|$)/,
    apply: (m) => {
      const id = m[1]
      if (!id || id === "new") return {}
      return {
        selectedTaskId: id,
        selectedMatterId: undefined,
        selectedClientId: undefined,
        selectedInvoiceId: undefined,
      }
    },
  },
  {
    pattern: /^\/app\/accounting\/invoices\/([^/]+)(?:\/|$)/,
    apply: (m) => {
      const id = m[1]
      if (!id || id === "new") return {}
      return {
        selectedInvoiceId: id,
        selectedMatterId: undefined,
        selectedClientId: undefined,
        selectedTaskId: undefined,
      }
    },
  },
  {
    pattern: /^\/app\/meetings\/([^/]+)(?:\/|$)/,
    apply: (m) => {
      const id = m[1]
      if (!id || id === "new") return {}
      return {
        selectedTaskId: id,
        selectedMatterId: undefined,
        selectedClientId: undefined,
        selectedInvoiceId: undefined,
      }
    },
  },
  {
    pattern: /^\/app\/leads\/([^/]+)(?:\/|$)/,
    apply: (m) => {
      const id = m[1]
      if (!id || id === "new") return {}
      return {
        selectedClientId: id,
        selectedMatterId: undefined,
        selectedTaskId: undefined,
        selectedInvoiceId: undefined,
      }
    },
  },
]

/**
 * Syncs Copilot context from the current URL so Copilot knows which
 * client/matter/task the user is viewing. Always scoped to the active tenant.
 */
export function CopilotContextSyncer() {
  const pathname = usePathname()
  const { setContext } = useCopilotContext()

  useEffect(() => {
    if (!pathname || !pathname.startsWith("/app")) return

    for (const rule of ENTITY_ROUTE_RULES) {
      const match = pathname.match(rule.pattern)
      if (match) {
        const entity = rule.apply(match)
        if (
          entity.selectedMatterId ||
          entity.selectedClientId ||
          entity.selectedTaskId ||
          entity.selectedInvoiceId
        ) {
          setContext({ pagePath: pathname, ...entity })
          return
        }
      }
    }

    // List / hub pages: firm workspace only (no entity IDs)
    const pageContext =
      pathname.startsWith("/app/legal-forms")
        ? { page: "legal-forms" as const, intent: "DOCUMENT_DRAFT" }
        : {}

    setContext({
      pagePath: pathname,
      selectedMatterId: undefined,
      selectedClientId: undefined,
      selectedTaskId: undefined,
      selectedInvoiceId: undefined,
      ...pageContext,
    })
  }, [pathname, setContext])

  return null
}
