"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { UmbrellaLogo } from "@/components/brand/umbrella-logo"
import {
  CreditCard,
  FileSearch,
  FileText,
  FolderOpen,
  Home,
  LogOut,
  Settings,
  ShieldCheck,
  Scale,
  Sparkles,
  X,
  CheckSquare,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingBag,
} from "lucide-react"
import { useAuth } from "@/lib/contexts/auth-context"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import {
  countryFlag,
  isSectionFinderCountry,
  sectionFinderCountryParam,
} from "@/lib/geo/country-flag"
import { ThemeToggle } from "@/components/theme-toggle"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { TourHelpTrigger } from "@/components/tutorials/tour-help-trigger"
import { useUIStore } from "@/lib/store"

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  highlight?: "primary" | "violet"
}

function NavLink({ item, pathname, onClick }: { item: NavItem; pathname: string; onClick?: () => void }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

  if (item.highlight === "primary") {
    return (
      <Link
        href={item.href}
        onClick={onClick}
        className={cn(
          "group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 mb-0.5 overflow-hidden",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-primary/8 text-primary hover:bg-primary/12 ring-1 ring-primary/20 hover:ring-primary/30",
        )}
      >
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <item.icon className={cn("h-4 w-4 shrink-0 relative z-10", isActive ? "text-primary-foreground" : "text-primary")} />
        <span className="truncate relative z-10">{item.label}</span>
      </Link>
    )
  }

  if (item.highlight === "violet") {
    return (
      <Link
        href={item.href}
        onClick={onClick}
        className={cn(
          "group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 mb-0.5 overflow-hidden",
          isActive
            ? "bg-violet-600 text-white shadow-sm"
            : "bg-violet-500/8 text-violet-700 dark:text-violet-400 hover:bg-violet-500/12 ring-1 ring-violet-500/20 hover:ring-violet-500/30",
        )}
      >
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <item.icon className={cn("h-4 w-4 shrink-0 relative z-10", isActive ? "text-white" : "text-violet-600 dark:text-violet-400")} />
        <span className="truncate relative z-10">{item.label}</span>
      </Link>
    )
  }

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 overflow-hidden",
        isActive
          ? "bg-primary/10 text-primary font-semibold"
          : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {isActive && <span className="absolute left-0 inset-y-1.5 w-[3px] rounded-r-full bg-primary" />}
      <item.icon className={cn("h-4 w-4 shrink-0 transition-all relative z-10", isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground/80")} />
      <span className="truncate relative z-10">{item.label}</span>
    </Link>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const tConsumer = useTranslations("consumer")
  const tCommon = useTranslations("common")
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { countryCode, isLoading: countryLoading } = useDetectedCountry()
  const draftHref = "/consumer/document-drafting"
  const draftLabel = tConsumer("nav.docuDraft")
  const workspaceFlag = countryLoading ? undefined : countryFlag(countryCode)
  const sectionFinderHref = "/consumer/section-finder"
  const finderCountry = sectionFinderCountryParam(countryCode)
  const showSectionFinder = !countryLoading && isSectionFinderCountry(countryCode)
  const sectionFinderLink = finderCountry
    ? `${sectionFinderHref}?country=${finderCountry}`
    : sectionFinderHref

  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || tConsumer("hello")
  const email = user?.email

  const handleSignOut = async () => {
    await logout()
  }

  const primaryItems: NavItem[] = [
    { href: "/consumer/dashboard", label: tConsumer("nav.home"), icon: Home },
    { href: "/consumer/cases", label: tConsumer("nav.cases"), icon: FolderOpen },
    { href: "/consumer/reports", label: tConsumer("nav.reports"), icon: FileText },
  ]

  const bottomItems: NavItem[] = [
    { href: "/consumer/find-lawyer", label: tConsumer("nav.findLawyer"), icon: Scale },
    { href: "/consumer/lawyer-review", label: tConsumer("nav.lawyerReview"), icon: ShieldCheck },
    { href: "/consumer/subscription", label: tConsumer("nav.subscription"), icon: CreditCard },
    { href: "/consumer/settings", label: tCommon("settings"), icon: Settings },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Logo */}
      <div className="shrink-0 px-4 py-5 border-b border-border/40">
        <UmbrellaLogo height={32} priority href="/consumer/dashboard" />
      </div>

      {/* Nav */}
      <nav className="app-scroll-pane min-h-0 flex-1 px-3 py-4 space-y-5">
        {/* Main */}
        <div className="space-y-0.5">
          {primaryItems.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavigate} />
          ))}
        </div>

        {/* AI Tools */}
        <div>
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            {tConsumer("nav.aiTools")}
          </p>
          <div className="space-y-1.5">
            <Link
              href="/legal-issue-checker"
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 overflow-hidden",
                pathname === "/legal-issue-checker" || pathname.startsWith("/legal-issue-checker/")
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/[0.10] ring-1 ring-emerald-500/20 hover:ring-emerald-500/30",
              )}
            >
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CheckSquare className={cn("h-4 w-4 shrink-0 relative z-10", pathname.startsWith("/legal-issue-checker") ? "text-white" : "text-emerald-600 dark:text-emerald-400")} />
              <span className="truncate relative z-10">{tConsumer("nav.issueChecker")}</span>
            </Link>
            <Link
              href="/consumer/research"
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 overflow-hidden",
                pathname === "/consumer/research" || pathname.startsWith("/consumer/research/")
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-primary/[0.06] text-primary hover:bg-primary/[0.10] ring-1 ring-primary/20 hover:ring-primary/30",
              )}
            >
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Sparkles className={cn("h-4 w-4 shrink-0 relative z-10", pathname.startsWith("/consumer/research") ? "text-primary-foreground" : "text-primary")} />
              <span className="truncate relative z-10">{tConsumer("nav.research")}</span>
            </Link>
            <Link
              href="/consumer/document-review"
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 overflow-hidden",
                pathname === "/consumer/document-review" || pathname.startsWith("/consumer/document-review/")
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-violet-500/[0.06] text-violet-700 dark:text-violet-400 hover:bg-violet-500/[0.10] ring-1 ring-violet-500/20 hover:ring-violet-500/30",
              )}
            >
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <FileSearch className={cn("h-4 w-4 shrink-0 relative z-10", pathname.startsWith("/consumer/document-review") ? "text-white" : "text-violet-600 dark:text-violet-400")} />
              <span className="truncate relative z-10">{tConsumer("nav.documentReview")}</span>
            </Link>
            <Link
              href={draftHref}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 overflow-hidden",
                pathname === draftHref ||
                pathname.startsWith(`${draftHref}/`) ||
                pathname.startsWith("/consumer/india-drafting")
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-violet-500/[0.06] text-violet-700 dark:text-violet-400 hover:bg-violet-500/[0.10] ring-1 ring-violet-500/20 hover:ring-violet-500/30",
              )}
            >
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <FileText className={cn("h-4 w-4 shrink-0 relative z-10", pathname.startsWith(draftHref) ? "text-white" : "text-violet-600 dark:text-violet-400")} />
              <span className="truncate relative z-10">{draftLabel}</span>
              {workspaceFlag && (
                <span className="ml-auto shrink-0 text-[10px] font-bold bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 rounded px-1 py-0.5">{workspaceFlag}</span>
              )}
            </Link>
            {showSectionFinder && (
              <Link
                href={sectionFinderLink}
                onClick={onNavigate}
                className={cn(
                  "group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 overflow-hidden",
                  pathname === sectionFinderHref || pathname.startsWith(`${sectionFinderHref}/`)
                    ? "bg-orange-600 text-white shadow-sm"
                    : "bg-orange-500/[0.06] text-orange-700 dark:text-orange-400 hover:bg-orange-500/[0.10] ring-1 ring-orange-500/20 hover:ring-orange-500/30",
                )}
              >
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <BookOpen className={cn("h-4 w-4 shrink-0 relative z-10", pathname.startsWith(sectionFinderHref) ? "text-white" : "text-orange-600 dark:text-orange-400")} />
                <span className="truncate relative z-10">{tConsumer("nav.sectionFinder")}</span>
                {workspaceFlag && (
                  <span className="ml-auto shrink-0 text-[10px] font-bold bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded px-1 py-0.5">{workspaceFlag}</span>
                )}
              </Link>
            )}
            <NavLink key="/consumer/rights-checker" item={{ href: "/consumer/rights-checker", label: "Rights Checker", icon: CheckSquare }} pathname={pathname} onClick={onNavigate} />
            <NavLink key="/consumer/marketplace" item={{ href: "/consumer/marketplace", label: "Legal Marketplace", icon: ShoppingBag }} pathname={pathname} onClick={onNavigate} />
          </div>
        </div>

        {/* Account */}
        <div>
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            {tConsumer("nav.account")}
          </p>
          <div className="space-y-0.5">
            {bottomItems.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavigate} />
            ))}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-border/40 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{displayName}</p>
            {email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <TourHelpTrigger />
            <ThemeToggle />
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>{tCommon("signOut") as string}</span>
        </button>
      </div>
    </div>
  )
}

const CONSUMER_MINIMIZE_KEY = "consumer-sidebar-minimized"

export function ConsumerSidebar() {
  const mobileOpen = useUIStore((s) => s.consumerSidebarOpen)
  const setMobileOpen = useUIStore((s) => s.setConsumerSidebarOpen)
  const [minimized, setMinimized] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSUMER_MINIMIZE_KEY)
      if (stored !== null) setMinimized(stored === "true")
    } catch {
      // ignore
    }
  }, [])

  const toggleMinimized = () => {
    const next = !minimized
    setMinimized(next)
    try {
      localStorage.setItem(CONSUMER_MINIMIZE_KEY, String(next))
    } catch {
      // ignore
    }
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={cn(
        "sidebar-panel hidden h-full min-h-0 shrink-0 overflow-hidden border-r border-border/50 bg-background transition-[width] duration-200 ease-in-out lg:flex lg:flex-col",
        minimized ? "w-14" : "w-56 xl:w-60",
      )}>
        <SidebarContent />
        {/* Minimize toggle */}
        <button
          type="button"
          onClick={toggleMinimized}
          title={minimized ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute bottom-3 right-2 flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/60 transition-all"
        >
          {minimized ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* Mobile drawer — opened from ConsumerTopbar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(100vw-2rem,16rem)] p-0 flex flex-col pb-safe-bottom">
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted transition-colors"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
