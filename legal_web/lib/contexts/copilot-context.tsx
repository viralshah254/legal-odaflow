"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from "react"
import type { CopilotContextSnapshot, CopilotTabId } from "@/lib/types/copilot"
import { useRole } from "@/lib/contexts/role-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { hasCopilotPermission } from "@/lib/types/roles"
import type { CopilotPermission } from "@/lib/types/copilot"
import { resolvePlanTierForFeatures } from "@/lib/utils/plan-from-tenant"
import { PLAN_FEATURES } from "@/lib/types/plan-features"

const COPILOT_STORAGE_PREFIX = "odaflow-copilot-context"

function storageKey(tenantId: string) {
  return `${COPILOT_STORAGE_PREFIX}:${tenantId}`
}

interface CopilotContextValue {
  context: CopilotContextSnapshot
  setClientId: (id: string | undefined) => void
  setMatterId: (id: string | undefined) => void
  setTaskId: (id: string | undefined) => void
  setInvoiceId: (id: string | undefined) => void
  setPagePath: (path: string | undefined) => void
  setContext: (ctx: Partial<CopilotContextSnapshot>) => void
  clearEntityContext: () => void
  /** Role can open the Copilot drawer / see entry points */
  canOpenCopilot: boolean
  /** Role can send messages — credits/plan enforced by backend */
  canSendCopilotMessages: boolean
  /** @deprecated Use canSendCopilotMessages */
  canUseCopilot: boolean
  hasCopilotFeature: boolean
  hasPermission: (p: CopilotPermission) => boolean
  activeTab: CopilotTabId
  setActiveTab: (tab: CopilotTabId) => void
}

const defaultContext: CopilotContextSnapshot = {}

const CopilotContext = createContext<CopilotContextValue | undefined>(undefined)

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const { currentRole } = useRole()
  const { activeTenant, activeTenantId } = useTenant()
  const [context, setContextState] = useState<CopilotContextSnapshot>(defaultContext)
  const [activeTab, setActiveTab] = useState<CopilotTabId>("ask")

  const plan = resolvePlanTierForFeatures(activeTenant?.tenant.billingPlan)
  const hasCopilotFeature = plan ? PLAN_FEATURES[plan].copilot : false
  const canOpenCopilot = hasCopilotPermission(currentRole, "canUseCopilotChat")
  /** Backend debits credits; allow any role-permitted user to chat for their active tenant */
  const canSendCopilotMessages = canOpenCopilot && !!activeTenantId

  const hasPermission = useCallback(
    (p: CopilotPermission) => hasCopilotPermission(currentRole, p),
    [currentRole],
  )

  useEffect(() => {
    if (!activeTenantId) {
      setContextState(defaultContext)
      return
    }

    try {
      const raw = localStorage.getItem(storageKey(activeTenantId))
      if (raw) {
        const parsed = JSON.parse(raw) as CopilotContextSnapshot
        if (parsed && typeof parsed === "object") {
          setContextState(parsed)
          return
        }
      }
    } catch {
      // ignore
    }

    setContextState(defaultContext)
  }, [activeTenantId])

  const persist = useCallback(
    (tenantId: string, next: CopilotContextSnapshot) => {
      try {
        localStorage.setItem(storageKey(tenantId), JSON.stringify(next))
      } catch {
        // ignore
      }
    },
    [],
  )

  const setContext = useCallback(
    (partial: Partial<CopilotContextSnapshot>) => {
      if (!activeTenantId) return
      setContextState((prev) => {
        const next = { ...prev, ...partial }
        persist(activeTenantId, next)
        return next
      })
    },
    [activeTenantId, persist],
  )

  const setClientId = useCallback(
    (id: string | undefined) => setContext({ selectedClientId: id }),
    [setContext],
  )
  const setMatterId = useCallback(
    (id: string | undefined) => setContext({ selectedMatterId: id }),
    [setContext],
  )
  const setTaskId = useCallback(
    (id: string | undefined) => setContext({ selectedTaskId: id }),
    [setContext],
  )
  const setInvoiceId = useCallback(
    (id: string | undefined) => setContext({ selectedInvoiceId: id }),
    [setContext],
  )
  const setPagePath = useCallback(
    (path: string | undefined) => setContext({ pagePath: path }),
    [setContext],
  )
  const clearEntityContext = useCallback(
    () =>
      setContext({
        selectedClientId: undefined,
        selectedMatterId: undefined,
        selectedTaskId: undefined,
        selectedInvoiceId: undefined,
      }),
    [setContext],
  )

  const value: CopilotContextValue = {
    context,
    setClientId,
    setMatterId,
    setTaskId,
    setInvoiceId,
    setPagePath,
    setContext,
    clearEntityContext,
    canOpenCopilot,
    canSendCopilotMessages,
    canUseCopilot: canSendCopilotMessages,
    hasCopilotFeature,
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
