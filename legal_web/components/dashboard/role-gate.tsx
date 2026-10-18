"use client"

import { ReactNode } from "react"
import type { FlatRolePermissionKey } from "@/lib/api/governance"
import { UserRole } from "@/lib/types/roles"
import { useRole } from "@/lib/contexts/role-context"

interface RoleGateProps {
  children: ReactNode
  allowedRoles: UserRole[]
  requiredPermission?: FlatRolePermissionKey
  fallback?: ReactNode
}

export function RoleGate({
  children,
  allowedRoles,
  requiredPermission,
  fallback = null,
}: RoleGateProps) {
  const { currentRole, permissions } = useRole()

  if (!allowedRoles.includes(currentRole)) {
    return <>{fallback}</>
  }

  if (requiredPermission && !permissions[requiredPermission as keyof typeof permissions]) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
