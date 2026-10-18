"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getRolePermissions as fetchTenantRolePermissions } from "@/lib/api/governance"
import {
  mergeTenantRolePermissions,
} from "@/lib/auth/role-permissions"
import {
  clearDevRoleStorage,
  DEV_USER_STORAGE_KEY,
  isDevRoleSwitcherEnabled,
  loadDevRoleFromStorage,
} from "@/lib/dev/dev-role-switcher"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTenantOptional } from "@/lib/contexts/tenant-context"
import {
  type RolePermissions,
  type User,
  type UserRole,
} from "@/lib/types/roles"

interface RoleContextType {
  currentRole: UserRole
  currentUser: User | null
  setCurrentRole: (role: UserRole) => void
  setCurrentUser: (user: User | null) => void
  permissions: RolePermissions
  permissionsLoading: boolean
  refreshRolePermissions: () => Promise<void>
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const { isAuthenticated, user } = useAuth()
  const { activeTenantId } = useTenantOptional()
  const isLawyer = user?.userType === "LAWYER"

  const [currentRole, setCurrentRoleState] = useState<UserRole>("PARTNER_ADMIN")
  const [currentUser, setCurrentUserState] = useState<User | null>(null)

  const {
    data: remotePermissions,
    isLoading: permissionsLoading,
  } = useQuery({
    queryKey: ["role-permissions", activeTenantId],
    queryFn: () => fetchTenantRolePermissions(activeTenantId!),
    enabled: isAuthenticated && isLawyer && !!activeTenantId,
  })

  const rolePermissionsMap = useMemo(
    () => mergeTenantRolePermissions(remotePermissions),
    [remotePermissions],
  )

  const permissions = useMemo(
    () => rolePermissionsMap[currentRole],
    [rolePermissionsMap, currentRole],
  )

  useEffect(() => {
    if (!isDevRoleSwitcherEnabled()) {
      clearDevRoleStorage()
      return
    }

    const savedRole = loadDevRoleFromStorage()
    if (savedRole) {
      setCurrentRoleState(savedRole)
    }

    try {
      const savedUser = localStorage.getItem(DEV_USER_STORAGE_KEY)
      if (savedUser) {
        setCurrentUserState(JSON.parse(savedUser) as User)
      }
    } catch {
      // Invalid JSON — ignore
    }
  }, [])

  const setCurrentRole = useCallback((role: UserRole) => {
    setCurrentRoleState(role)
  }, [])

  const setCurrentUser = useCallback((user: User | null) => {
    setCurrentUserState(user)
  }, [])

  const refreshRolePermissions = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["role-permissions"] })
  }, [queryClient])

  const value = useMemo<RoleContextType>(
    () => ({
      currentRole,
      currentUser,
      setCurrentRole,
      setCurrentUser,
      permissions,
      permissionsLoading,
      refreshRolePermissions,
    }),
    [
      currentRole,
      currentUser,
      setCurrentRole,
      setCurrentUser,
      permissions,
      permissionsLoading,
      refreshRolePermissions,
    ],
  )

  return (
    <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
  )
}

export function useRoleOptional() {
  return useContext(RoleContext)
}

export function useRole() {
  const context = useContext(RoleContext)
  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider")
  }
  return context
}
