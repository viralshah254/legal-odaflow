"use client"

import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Menu, LogOut, Settings, UserCircle, Sparkles, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"
import { GlobalSearch } from "@/components/global-search"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useRole } from "@/lib/contexts/role-context"
import { useAuth } from "@/lib/contexts/auth-context"
import { useUIStore } from "@/lib/store"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown"
import { CreditUsageMeter } from "@/components/credits/CreditUsageMeter"
import { RealtimeStatusBadge } from "@/components/realtime/realtime-status-badge"
import { useCopilotContext } from "@/lib/contexts/copilot-context"
import { useTenant } from "@/lib/contexts/tenant-context"
import { cn } from "@/lib/utils"
import { TourHelpTrigger } from "@/components/tutorials/tour-help-trigger"

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

export function AppTopbar() {
  const tCommon = useTranslations("common")
  const tDashboard = useTranslations("dashboard")
  const tCopilot = useTranslations("copilot")
  const pathname = usePathname()
  const { currentRole, currentUser } = useRole()
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen)
  const sidebarOpen = useUIStore((state) => state.sidebarOpen)
  const sidebarMinimized = useUIStore((state) => state.sidebarMinimized)
  const toggleSidebarMinimized = useUIStore((state) => state.toggleSidebarMinimized)
  const setCopilotDrawerOpen = useUIStore((state) => state.setCopilotDrawerOpen)
  const dashboardWindow = useUIStore((state) => state.dashboardWindow)
  const setDashboardWindow = useUIStore((state) => state.setDashboardWindow)
  const { canOpenCopilot } = useCopilotContext()
  const { activeTenantId } = useTenant()
  const { logout } = useAuth()

  const userName = currentUser?.name ?? tCommon("user")
  const userEmail = currentUser?.email ?? ""
  const isDashboard = pathname === "/app/dashboard"
  const initials = getInitials(userName)

  const getGreeting = (name: string) => {
    const hour = new Date().getHours()
    const first = name.split(" ")[0]
    if (hour < 12) return tDashboard("greetingMorning", { name: first })
    if (hour < 17) return tDashboard("greetingAfternoon", { name: first })
    return tDashboard("greetingEvening", { name: first })
  }

  const roleLabel = tDashboard(`roles.${currentRole}` as "roles.PARTNER_ADMIN")

  const handleSignOut = async () => {
    await logout()
  }

  return (
    <header className="shrink-0 z-40 border-b border-border/50 bg-background shadow-[0_1px_0_hsl(var(--border)/0.5),0_2px_8px_-4px_rgb(0_0_0/0.04)]">
      <div className="flex h-[3.5rem] items-center gap-2 px-4 sm:px-5 lg:px-6">
        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0 h-10 w-10"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Desktop sidebar collapse */}
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex shrink-0 h-8 w-8"
          onClick={toggleSidebarMinimized}
          aria-label={sidebarMinimized ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarMinimized ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarMinimized ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>

        {/* Greeting (dashboard only) */}
        {isDashboard && (
          <div className="hidden md:flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">
              {getGreeting(userName)}
            </span>
          </div>
        )}

        {/* Search — hide input on very small screens; open command palette instead */}
        <div className={cn("hidden sm:block flex-1 min-w-0", isDashboard ? "md:flex-none md:w-72" : "")} data-tour="global-search">
          <GlobalSearch />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden shrink-0 h-10 w-10"
          onClick={() => useUIStore.getState().setCommandPaletteOpen(true)}
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </Button>

        {/* ⌘K pill */}
        <button
          type="button"
          onClick={() => useUIStore.getState().setCommandPaletteOpen(true)}
          data-tour="command-palette-hint"
          className="hidden lg:inline-flex h-7 select-none items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 font-mono text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border transition-all duration-150 cursor-pointer"
          aria-label="Open command palette"
        >
          <span className="text-[11px]">⌘</span>
          <span className="font-sans font-medium">K</span>
        </button>

        {/* Dashboard window switcher */}
        {isDashboard && (
          <div className="flex items-center gap-0.5 shrink-0 bg-muted/50 rounded-lg p-0.5 border border-border/40">
            {(["today", "week", "month"] as const).map((w) => (
              <button
                key={w}
                onClick={() => setDashboardWindow(w)}
                className={cn(
                  "px-2.5 sm:px-3 py-1.5 min-h-[32px] text-xs font-medium rounded-md transition-all duration-150",
                  dashboardWindow === w
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tDashboard(w)}
              </button>
            ))}
          </div>
        )}

        {/* Copilot button */}
        {canOpenCopilot && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCopilotDrawerOpen(true)}
            title={tCopilot("openShortcut")}
            className="shrink-0 h-10 w-10 sm:h-8 sm:w-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
            data-tour="copilot-topbar"
          >
            <Sparkles className="h-4 w-4 text-primary" />
          </Button>
        )}

        {/* Credits meter */}
        {activeTenantId && (
          <div className="hidden sm:block">
            <CreditUsageMeter tenantId={activeTenantId} compact />
          </div>
        )}

        <div className="hidden md:block">
          <RealtimeStatusBadge />
        </div>
        <NotificationsDropdown />
        <div className="hidden md:block">
          <TourHelpTrigger />
        </div>

        {/* User dropdown with initials avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-2 shrink-0 h-9 rounded-lg hover:bg-muted/60"
              data-tour="user-menu"
            >
              {/* Initials avatar */}
              <div className="relative h-7 w-7 shrink-0">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/55 to-primary/25 flex items-center justify-center text-[11px] font-bold text-primary ring-2 ring-primary/20">
                  {initials}
                </div>
              </div>
              <div className="hidden md:block text-left">
                <div className="text-[13px] font-semibold leading-tight">{userName}</div>
                <div className="text-[11px] text-muted-foreground leading-tight">
                  {roleLabel}
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>
              <div className="flex items-center gap-2.5 py-0.5">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/55 to-primary/25 flex items-center justify-center text-[12px] font-bold text-primary shrink-0">
                  {initials}
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-sm font-medium leading-none truncate">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground truncate">{userEmail}</p>
                  <Badge variant="outline" className="mt-1.5 w-fit text-[10px] h-4 px-1.5">
                    {roleLabel}
                  </Badge>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app/profile" className="flex items-center gap-2 cursor-pointer">
                <UserCircle className="h-4 w-4" />
                {tDashboard("profile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/app/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                {tCommon("settings")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {tCommon("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
