"use client"

import { useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { useRole } from "@/lib/contexts/role-context"
import { mockUsers } from "@/lib/mock/users"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { currentUser, setCurrentUser, currentRole } = useRole()

  useEffect(() => {
    // Initialize mock user based on current role if not set
    if (!currentUser) {
      const user = mockUsers.find((u) => u.role === currentRole) || mockUsers[0]
      setCurrentUser(user)
    }
  }, [currentUser, currentRole, setCurrentUser])

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppTopbar />
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}

