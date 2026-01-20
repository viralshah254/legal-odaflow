"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  FileText,
  CheckSquare,
  Calendar,
  Folder,
  Receipt,
  Shield,
  BarChart3,
  Zap,
  Settings,
  ListChecks,
  Bell,
  DollarSign,
  UserCog,
} from "lucide-react"
import { useUIStore } from "@/lib/store"
import { useRole } from "@/lib/contexts/role-context"
import { RoleGate } from "@/components/dashboard/role-gate"

const baseNavigation = [
  { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { name: "Clients", href: "/app/clients", icon: Users },
  { name: "Matters", href: "/app/matters", icon: FileText },
  { name: "Tasks", href: "/app/tasks", icon: CheckSquare },
  { name: "Calendar", href: "/app/calendar", icon: Calendar },
  { name: "Alerts", href: "/app/alerts", icon: Bell },
]

const conditionalNavigation = [
  { name: "Finance", href: "/app/finance", icon: DollarSign, roles: ["PARTNER_ADMIN", "FINANCE"] as const },
  { name: "Team", href: "/app/team", icon: UserCog, roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER"] as const },
  { name: "Settings", href: "/app/settings", icon: Settings, roles: ["PARTNER_ADMIN"] as const },
]

export function AppSidebar() {
  const pathname = usePathname()
  const sidebarOpen = useUIStore((state) => state.sidebarOpen)
  const { currentRole } = useRole()

  if (!sidebarOpen) return null

  const getNavigation = () => {
    const nav = [...baseNavigation]
    
    conditionalNavigation.forEach((item) => {
      if (item.roles.includes(currentRole as any)) {
        nav.push(item)
      }
    })
    
    return nav
  }

  const navigation = getNavigation()

  return (
    <div className="w-64 border-r bg-background/95 backdrop-blur-sm h-screen sticky top-0 overflow-y-auto">
      <div className="p-6">
        <Link href="/app/dashboard" className="flex items-center gap-2.5 mb-8 group">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Legal by OdaFlow
          </span>
        </Link>
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:translate-x-0.5"
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 transition-transform",
                  isActive ? "" : "group-hover:scale-110"
                )} />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

