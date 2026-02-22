"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { getMatterById } from "@/lib/mock/matters"

/**
 * Syncs Copilot context from the current URL so the Copilot always knows
 * which client/matter the user is looking at (e.g. from matter or client detail pages).
 */
export function CopilotContextSyncer() {
  const pathname = usePathname()
  const { setMatterId, setClientId, setTaskId, setInvoiceId } = useCopilotContext()

  useEffect(() => {
    if (!pathname || !pathname.startsWith("/app")) return

    // /app/matters/[matterId]
    const matterMatch = pathname.match(/^\/app\/matters\/([^/]+)(?:\/|$)/)
    if (matterMatch) {
      const matterId = matterMatch[1]
      if (matterId && matterId !== "new") {
        setMatterId(matterId)
        const matter = getMatterById(matterId)
        if (matter) setClientId(matter.clientId)
        setTaskId(undefined)
        setInvoiceId(undefined)
        return
      }
    }

    // /app/clients/[clientId]
    const clientMatch = pathname.match(/^\/app\/clients\/([^/]+)(?:\/|$)/)
    if (clientMatch) {
      const clientId = clientMatch[1]
      if (clientId && clientId !== "new") {
        setClientId(clientId)
        setMatterId(undefined)
        setTaskId(undefined)
        setInvoiceId(undefined)
        return
      }
    }

    // Other app routes: leave context as-is (user may have set it manually or from a previous page)
  }, [pathname, setMatterId, setClientId, setTaskId, setInvoiceId])

  return null
}
