"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from "react"
import type { CopilotContextSnapshot, CopilotTabId } from "@/lib/types/copilot"
import { useRole } from "@/lib/contexts/role-context"
import { hasCopilotPermission } from "@/lib/types/roles"
import type { CopilotPermission } from "@/lib/types/copilot"

const COPILOT_STORAGE_KEY = "odaflow-copilot-context"

interface CopilotContextValue {
  /** Current context sent with each request */
  context: CopilotContextSnapshot
  /** Set context from current page (e.g. matter detail sets matterId) */
  setClientId: (id: string | undefined) => void
  setMatterId: (id: string | undefined) => void
  setTaskId: (id: string | undefined) => void
  setInvoiceId: (id: string | undefined) => void
  /** Replace full context (e.g. when opening from a deep link) */
  setContext: (ctx: Partial<CopilotContextSnapshot>) => void
  /** Whether the current role can use Copilot at all */
  canUseCopilot: boolean
  /** Check a specific Copilot permission */
  hasPermission: (p: CopilotPermission) => boolean
  /** Active tab in the drawer */
  activeTab: CopilotTabId
  setActiveTab: (tab: CopilotTabId) => void
}

const defaultContext: CopilotContextSnapshot = {}

const CopilotContext = createContext<CopilotContextValue | undefined>(undefined)

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const { currentRole } = useRole()
  const [context, setContextState] = useState<CopilotContextSnapshot>(defaultContext)
  const [activeTab, setActiveTab] = useState<CopilotTabId>("ask")

  const canUseCopilot = hasCopilotPermission(currentRole, "canUseCopilotChat")
  const hasPermission = useCallback(
    (p: CopilotPermission) => hasCopilotPermission(currentRole, p),
    [currentRole]
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COPILOT_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as CopilotContextSnapshot
        if (parsed && typeof parsed === "object") {
          setContextState((prev) => ({
            ...prev,
            selectedClientId: parsed.selectedClientId ?? prev.selectedClientId,
            selectedMatterId: parsed.selectedMatterId ?? prev.selectedMatterId,
            selectedTaskId: parsed.selectedTaskId ?? prev.selectedTaskId,
            selectedInvoiceId: parsed.selectedInvoiceId ?? prev.selectedInvoiceId,
          }))
        }
      }
    } catch {
      // ignore
    }
  }, [])

  const persist = useCallback((next: CopilotContextSnapshot) => {
    try {
      localStorage.setItem(COPILOT_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }, [])

  const setContext = useCallback(
    (partial: Partial<CopilotContextSnapshot>) => {
      setContextState((prev) => {
        const next = { ...prev, ...partial }
        persist(next)
        return next
      })
    },
    [persist]
  )

  const setClientId = useCallback(
    (id: string | undefined) => setContext({ selectedClientId: id }),
    [setContext]
  )
  const setMatterId = useCallback(
    (id: string | undefined) => setContext({ selectedMatterId: id }),
    [setContext]
  )
  const setTaskId = useCallback(
    (id: string | undefined) => setContext({ selectedTaskId: id }),
    [setContext]
  )
  const setInvoiceId = useCallback(
    (id: string | undefined) => setContext({ selectedInvoiceId: id }),
    [setContext]
  )

  const value: CopilotContextValue = {
    context,
    setClientId,
    setMatterId,
    setTaskId,
    setInvoiceId,
    setContext,
    canUseCopilot,
    hasPermission,
    activeTab,
    setActiveTab,
  }

  return (
    <CopilotContext.Provider value={value}>
      {children}
    </CopilotContext.Provider>
  )
}

export function useCopilotContext() {
  const ctx = useContext(CopilotContext)
  if (ctx === undefined) {
    throw new Error("useCopilotContext must be used within CopilotProvider")
  }
  return ctx
}
