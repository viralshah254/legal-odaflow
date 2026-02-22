"use client"

import { ReactNode } from "react"
import type { MeetingPermissions } from "@/lib/types/roles"
import { useRole } from "@/lib/contexts/role-context"
import { hasMeetingPermission } from "@/lib/types/roles"

interface MeetingGateProps {
  children: ReactNode
  permission: keyof MeetingPermissions
  fallback?: ReactNode
}

export function MeetingGate({ children, permission, fallback = null }: MeetingGateProps) {
  const { currentRole } = useRole()
  if (!hasMeetingPermission(currentRole, permission)) {
    return <>{fallback}</>
  }
  return <>{children}</>
}
