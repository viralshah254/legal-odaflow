"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/contexts/auth-context"

export function AdminUserBridge({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isLoading, isAuthenticated } = useAuth()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace("/auth?redirect=/admin/home")
      return
    }
    if (user?.mustChangePassword) {
      router.replace("/auth/change-password")
      return
    }
    if (user?.userType !== "SUPER_ADMIN") {
      router.replace(user?.userType === "CONSUMER" ? "/consumer/dashboard" : "/app/home")
    }
  }, [isLoading, isAuthenticated, user?.userType, user?.mustChangePassword, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAuthenticated || user?.mustChangePassword || user?.userType !== "SUPER_ADMIN") {
    return null
  }

  return <>{children}</>
}
