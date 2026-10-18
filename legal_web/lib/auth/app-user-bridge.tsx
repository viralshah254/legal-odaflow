"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useRole } from "@/lib/contexts/role-context"
import type { User } from "@/lib/types/roles"
import { formatPersonName } from "@/lib/format-person-name"
import { mapTenantRoleToUserRole } from "./role-mapper"

export function AppUserBridge({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isLoading, isAuthenticated } = useAuth()
  const { activeTenant } = useTenant()
  const { setCurrentUser, setCurrentRole } = useRole()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace("/")
      return
    }
    if (user?.userType === "CONSUMER") {
      router.replace("/consumer/dashboard")
    }
  }, [isLoading, isAuthenticated, user?.userType, router])

  useEffect(() => {
    if (!user) {
      setCurrentUser(null)
      return
    }

    const mappedRole = mapTenantRoleToUserRole(
      activeTenant?.role ?? user.tenantRole,
    )
    setCurrentRole(mappedRole)

    const bridgedUser: User = {
      id: user.id,
      name: formatPersonName(user.name ?? user.email.split("@")[0]),
      email: user.email,
      role: mappedRole,
    }
    setCurrentUser(bridgedUser)
  }, [user, activeTenant?.role, setCurrentUser, setCurrentRole])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
