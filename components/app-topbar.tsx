"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, Plus, Bell, User, Menu, X, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuthStore, useUIStore } from "@/lib/store"
import { CommandPalette } from "./command-palette"

export function AppTopbar() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const { sidebarOpen, toggleSidebar, commandPaletteOpen, setCommandPaletteOpen } = useUIStore()
  const [searchQuery, setSearchQuery] = useState("")

  const handleNewClick = (type: string) => {
    const routes: Record<string, string> = {
      client: "/app/clients/new",
      matter: "/app/matters/new",
      task: "/app/tasks/new",
      invoice: "/app/accounting/invoices/new",
      trust: "/app/trust/new",
      document: "/app/documents/new",
    }
    router.push(routes[type] || "/app")
  }

  const handleLogout = async () => {
    await logout()
    router.push("/auth/sign-in")
  }

  return (
    <>
      <div className="h-16 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center justify-between h-full px-4 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="lg:hidden"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="relative w-64 hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients, matters, tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setCommandPaletteOpen(true)}
                className="pl-9 border-2 focus:border-primary/50 transition-colors"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCommandPaletteOpen(true)}
              className="md:hidden"
            >
              <Search className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleNewClick("client")}>
                  Client
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNewClick("matter")}>
                  Matter
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNewClick("task")}>
                  Task
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNewClick("invoice")}>
                  Invoice
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNewClick("trust")}>
                  Trust Transaction
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNewClick("document")}>
                  Document
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-destructive rounded-full ring-2 ring-background" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-semibold">{user?.name}</span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/app/settings")}>
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <CommandPalette />
    </>
  )
}

