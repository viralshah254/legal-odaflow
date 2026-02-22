"use client"

import { useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { CommandPalette } from "@/components/command-palette"
import { CopilotDrawer } from "@/components/copilot/copilot-drawer"
import { CopilotContextSyncer } from "@/components/copilot/copilot-context-syncer"
import { GlobalRecordMeeting } from "@/components/meetings/global-record-meeting"
import { RoleProvider, useRole } from "@/lib/contexts/role-context"
import { CopilotProvider } from "@/lib/contexts/copilot-context"
import { mockUsers } from "@/lib/mock/users"

function AppLayoutContent({ children }: { children: React.ReactNode }) {
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
      <CopilotContextSyncer />
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppTopbar />
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
      <CommandPalette />
      <CopilotDrawer />
      <GlobalRecordMeeting />
    </div>
  )
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // CurrencyProvider is already in root Providers, so we don't need it here
  return (
    <RoleProvider>
      <CopilotProvider>
        <AppLayoutContent>{children}</AppLayoutContent>
      </CopilotProvider>
    </RoleProvider>
  )
}

