"use client"

import { ReactNode } from "react"
import { UserRole } from "@/lib/types/roles"
import { useRole } from "@/lib/contexts/role-context"

interface RoleGateProps {
  children: ReactNode
  allowedRoles: UserRole[]
  fallback?: ReactNode
}

export function RoleGate({ children, allowedRoles, fallback = null }: RoleGateProps) {
  const { currentRole } = useRole()

  if (!allowedRoles.includes(currentRole)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

