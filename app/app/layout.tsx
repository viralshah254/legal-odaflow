"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { useAuthStore } from "@/lib/store"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, setUser } = useAuthStore()

  useEffect(() => {
    // Initialize mock user if not set
    if (!user) {
      setUser({
        id: "user-1",
        email: "john.doe@lawfirm.com",
        name: "John Doe",
        role: "FIRM_OWNER",
        firmId: "firm-1",
      })
    }
  }, [user, setUser])

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

