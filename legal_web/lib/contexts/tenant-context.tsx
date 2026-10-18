"use client"
import { useTranslations } from "next-intl"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getActiveTenantId,
  listMyTenants,
  setActiveTenant as persistActiveTenant,
} from "@/lib/api/tenants"
import type { TenantMembership } from "@/lib/api/types"
import { useAuth } from "@/lib/contexts/auth-context"

interface TenantContextValue {
  tenants: TenantMembership[]
  activeTenant: TenantMembership | null
  activeTenantId: string | null
  isLoading: boolean
  isError: boolean
  error: Error | null
  setActiveTenant: (tenantId: string) => void
  refreshTenants: () => Promise<void>
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common")
  const { isAuthenticated, user } = useAuth()
  const queryClient = useQueryClient()
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null)

  const isLawyer = user?.userType === "LAWYER"

  const {
    data: tenants = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["my-tenants", "api"],
    queryFn: () => listMyTenants(),
    enabled: isAuthenticated && isLawyer,
    retry: 1,
  })

  useEffect(() => {
    if (!isAuthenticated || !isLawyer) {
      setActiveTenantIdState(null)
      return
    }

    const stored = getActiveTenantId()
    if (stored && tenants.some((t) => t.tenantId === stored)) {
      setActiveTenantIdState(stored)
      return
    }

    const fromUser = user?.tenantId
    if (fromUser && tenants.some((t) => t.tenantId === fromUser)) {
      persistActiveTenant(fromUser)
      setActiveTenantIdState(fromUser)
      return
    }

    if (tenants.length > 0) {
      persistActiveTenant(tenants[0].tenantId)
      setActiveTenantIdState(tenants[0].tenantId)
    }
  }, [isAuthenticated, isLawyer, tenants, user?.tenantId])

  const setActiveTenant = useCallback((tenantId: string) => {
    persistActiveTenant(tenantId)
    setActiveTenantIdState(tenantId)
  }, [])

  const refreshTenants = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["my-tenants"] })
  }, [queryClient])

  const activeTenant = useMemo(
    () => tenants.find((t) => t.tenantId === activeTenantId) ?? null,
    [tenants, activeTenantId],
  )

  const tenantError = useMemo(
    () => (error instanceof Error ? error : error ? new Error(String(error)) : null),
    [error],
  )

  const value = useMemo<TenantContextValue>(
    () => ({
      tenants,
      activeTenant,
      activeTenantId,
      isLoading,
      isError,
      error: tenantError,
      setActiveTenant,
      refreshTenants,
    }),
    [
      tenants,
      activeTenant,
      activeTenantId,
      isLoading,
      isError,
      tenantError,
      setActiveTenant,
      refreshTenants,
    ],
  )

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  )
}

/** Safe version: returns null activeTenantId outside TenantProvider (e.g. consumer pages) */
export function useTenantOptional(): TenantContextValue {
  const ctx = useContext(TenantContext)
  if (!ctx) {
    return {
      tenants: [],
      activeTenant: null,
      activeTenantId: null,
      isLoading: false,
      isError: false,
      error: null,
      setActiveTenant: () => {},
      refreshTenants: async () => {},
    }
  }
  return ctx
}

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider")
  }
  return context
}
