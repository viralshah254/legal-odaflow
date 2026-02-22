"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Bell, User, Menu, LogOut, Settings, UserCircle, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useRole } from "@/lib/contexts/role-context"
import { useUIStore, useAuthStore } from "@/lib/store"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { mockUsers } from "@/lib/mock/users"
import { format } from "date-fns"
import Link from "next/link"
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown"
import { useCopilotContext } from "@/lib/contexts/copilot-context"

export function AppTopbar() {
  const router = useRouter()
  const { currentRole, currentUser } = useRole()
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen)
  const sidebarOpen = useUIStore((state) => state.sidebarOpen)
  const setCopilotDrawerOpen = useUIStore((state) => state.setCopilotDrawerOpen)
  const { canUseCopilot } = useCopilotContext()
  const logout = useAuthStore((state) => state.logout)
  
  const user = currentUser || mockUsers.find((u) => u.role === currentRole) || mockUsers[0]
  
  const roleDisplayNames: Record<string, string> = {
    PARTNER_ADMIN: "Partner (Admin)",
    JUNIOR_PARTNER: "Junior Partner",
    ASSOCIATE: "Associate",
    PARALEGAL: "Paralegal",
    FINANCE: "Finance",
    INTAKE: "Intake",
    OPS_HR: "Ops/HR",
    RECEPTION: "Reception",
    READ_ONLY: "Read-Only",
  }

  const handleSignOut = async () => {
    await logout()
    router.push("/auth/sign-in")
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Global Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search matters, clients, tasks..."
              className="pl-9 w-full"
            />
          </div>
        </div>

        {/* Date Selector */}
        <div className="hidden md:flex items-center gap-2">
          <select className="text-sm border border-border rounded-md px-3 py-1.5 bg-background">
            <option>Today</option>
            <option>This Week</option>
            <option>This Month</option>
          </select>
        </div>

        {/* Copilot */}
        {canUseCopilot && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCopilotDrawerOpen(true)}
            title="Open Copilot (Shift+Cmd+K)"
          >
            <Sparkles className="h-5 w-5 text-primary" />
          </Button>
        )}

        {/* Notifications */}
        <NotificationsDropdown />

        {/* Profile Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">{roleDisplayNames[currentRole]}</div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                <Badge variant="outline" className="mt-2 w-fit text-xs">
                  {roleDisplayNames[currentRole]}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app/profile" className="flex items-center gap-2 cursor-pointer">
                <UserCircle className="h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/app/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
