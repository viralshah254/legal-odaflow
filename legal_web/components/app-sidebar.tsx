"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import { UmbrellaLogo } from "@/components/brand/umbrella-logo"
import {
  LayoutDashboard,
  Home,
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
  Wallet,
  UserCog,
  FileEdit,
  Mic,
  Clock,
  Sparkles,
  Inbox,
  Scale,
  Mail,
  ChevronRight,
  Library,
  Archive,
  FileSearch,
  FileSignature,
  LogOut,
  BookOpen,
  Radio,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
} from "lucide-react"
import { useUIStore } from "@/lib/store"
import {
  readSidebarMinimizedPreference,
} from "@/lib/ui/sidebar-preferences"
import { useRole } from "@/lib/contexts/role-context"
import { useAuth } from "@/lib/contexts/auth-context"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { countryFlag, countryFlagLabel, isSectionFinderCountry } from "@/lib/geo/country-flag"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { FlatRolePermissionKey } from "@/lib/api/governance"
import type { UserRole, RolePermissions } from "@/lib/types/roles"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { ReferralSidebarLink } from "@/components/referrals/referral-sidebar-link"
import { NavBadge } from "@/components/nav-badge"
import { useCounts } from "@/lib/hooks/use-counts"
import { useIsSolo } from "@/lib/hooks/use-is-solo"
import type { MeCounts } from "@/lib/api/counts"
import { ThemeSelector } from "@/components/ui/theme-selector"
import { ThemeToggle } from "@/components/theme-toggle"

type IconType = typeof LayoutDashboard

interface NavItem {
  nameKey: string
  href: string
  icon: IconType
  /** Which roles can see this item. Omit = everyone. */
  roles?: UserRole[]
  /** Tenant governance permission required (in addition to role check). */
  permission?: FlatRolePermissionKey
  /** Key into the aggregate counts used to render a badge. */
  badgeKey?: keyof MeCounts
  badgeVariant?: "default" | "urgent"
  /** Static text label badge (e.g. "New", "Tabular") */
  staticBadge?: string
}

interface NavGroup {
  id: string
  /** Section label key under lawyer.navGroups; omit for core group. */
  labelKey?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
  /** Hide the whole group for solo (1-seat) tenants. */
  hideForSolo?: boolean
  items: NavItem[]
}

const ALL_OPS: UserRole[] = ["PARTNER_ADMIN", "JUNIOR_PARTNER"]

/**
 * Single source of truth for the lawyer app navigation. Items are filtered by
 * role at render time, so there is one structure instead of nine flat lists.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    id: "core",
    items: [
      { nameKey: "nav.quickActions", href: "/app/home", icon: Home },
      { nameKey: "nav.dashboard", href: "/app/dashboard", icon: LayoutDashboard },
      {
        nameKey: "nav.clients",
        href: "/app/clients",
        icon: Users,
        roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "FINANCE", "INTAKE", "RECEPTION", "READ_ONLY"],
      },
      {
        nameKey: "nav.matters",
        href: "/app/matters",
        icon: FileText,
        roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "PARALEGAL", "FINANCE", "INTAKE", "READ_ONLY"],
      },
      {
        nameKey: "nav.tasks",
        href: "/app/tasks",
        icon: CheckSquare,
        roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "PARALEGAL", "INTAKE", "READ_ONLY"],
        badgeKey: "tasksOverdue",
        badgeVariant: "urgent",
      },
      {
        nameKey: "nav.meetings",
        href: "/app/meetings",
        icon: Mic,
        roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "PARALEGAL", "FINANCE", "INTAKE", "READ_ONLY"],
      },
    ],
  },
  {
    id: "schedule",
    labelKey: "navGroups.scheduleTime",
    collapsible: true,
    items: [
      { nameKey: "nav.calendar", href: "/app/calendar", icon: Calendar },
      {
        nameKey: "nav.time",
        href: "/app/time",
        icon: Clock,
        roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "PARALEGAL"],
      },
    ],
  },
  {
    id: "files-money",
    labelKey: "navGroups.filesMoney",
    collapsible: true,
    items: [
      { nameKey: "nav.documents", href: "/app/documents", icon: Folder, roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE"] },
      { nameKey: "nav.firmKnowledge", href: "/app/firm-knowledge", icon: Library },
      { nameKey: "nav.lawLibrary", href: "/app/law-library", icon: Library, roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "PARALEGAL", "READ_ONLY"] },
      { nameKey: "nav.vault", href: "/app/vault", icon: Archive, roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE"] },
      { nameKey: "nav.esign", href: "/app/esign", icon: FileSignature, roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "PARALEGAL"] },
      { nameKey: "nav.evidence", href: "/app/evidence", icon: FileText, roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE"] },
      { nameKey: "nav.billing", href: "/app/billing", icon: DollarSign, roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "FINANCE"], permission: "canViewFinance" },
      { nameKey: "nav.trustAccounts", href: "/app/trust", icon: Shield, roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "FINANCE"], permission: "canApproveTrust" },
      { nameKey: "nav.finance", href: "/app/finance", icon: Wallet, roles: ["PARTNER_ADMIN", "FINANCE", "READ_ONLY"], permission: "canViewFinance" },
      { nameKey: "nav.expenses", href: "/app/expenses", icon: Receipt, roles: ALL_OPS },
      {
        nameKey: "nav.queues",
        href: "/app/queues",
        icon: ListChecks,
        roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "FINANCE"],
        badgeKey: "queueDepth",
      },
      { nameKey: "nav.automations", href: "/app/automations", icon: Zap, roles: ALL_OPS },
    ],
  },
  {
    id: "pipeline",
    labelKey: "navGroups.pipeline",
    collapsible: true,
    items: [
      {
        nameKey: "nav.leads",
        href: "/app/leads",
        icon: Inbox,
        roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "INTAKE"],
        badgeKey: "openLeads",
      },
      {
        nameKey: "nav.inbox",
        href: "/app/inbox",
        icon: Mail,
        roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "INTAKE"],
        badgeKey: "unreadNotifications",
      },
      {
        nameKey: "nav.alerts",
        href: "/app/alerts",
        icon: Bell,
        roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "PARALEGAL", "INTAKE"],
        badgeKey: "openAlerts",
        badgeVariant: "urgent",
      },
      {
        nameKey: "nav.monitors",
        href: "/app/monitors",
        icon: Radio,
        roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE"],
      },
    ],
  },
  {
    id: "admin",
    labelKey: "navGroups.adminSettings",
    collapsible: true,
    defaultCollapsed: true,
    items: [
      { nameKey: "nav.team", href: "/app/team", icon: UserCog, roles: ["PARTNER_ADMIN", "JUNIOR_PARTNER", "OPS_HR"], permission: "canViewTeam", hideForSolo: true } as NavItem,
      { nameKey: "nav.templates", href: "/app/templates", icon: FileEdit },
      { nameKey: "nav.reports", href: "/app/reports", icon: BarChart3, roles: ["PARTNER_ADMIN", "FINANCE"], permission: "canViewFinance" },
      { nameKey: "nav.settings", href: "/app/settings", icon: Settings, roles: ["PARTNER_ADMIN"], permission: "canManageSettings" },
    ],
  },
]

/** Roles permitted to open the Legal Research surface. */
const AI_SEARCH_ROLES: UserRole[] = [
  "PARTNER_ADMIN",
  "JUNIOR_PARTNER",
  "ASSOCIATE",
  "PARALEGAL",
  "READ_ONLY",
]

/** Roles permitted to start a new client intake. */
const INTAKE_ROLES: UserRole[] = [
  "PARTNER_ADMIN",
  "JUNIOR_PARTNER",
  "ASSOCIATE",
  "INTAKE",
]

function itemVisible(
  item: NavItem,
  role: UserRole,
  isSolo: boolean,
  permissions: RolePermissions,
): boolean {
  if (isSolo && (item as NavItem & { hideForSolo?: boolean }).hideForSolo) return false
  if (item.roles && !item.roles.includes(role)) return false
  if (item.permission && !permissions[item.permission as keyof RolePermissions]) return false
  return true
}

/** Simple CSS-based tooltip that works without a tooltip primitive */
function IconTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tooltip">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 hidden group-hover/tooltip:block">
        <div className="bg-popover text-popover-foreground text-xs font-medium px-2 py-1 rounded-md shadow-md border border-border whitespace-nowrap">
          {label}
        </div>
      </div>
    </div>
  )
}

function AiSearchLink({
  pathname,
  onNavigate,
  minimized,
}: {
  pathname: string
  onNavigate?: () => void
  minimized?: boolean
}) {
  const t = useTranslations("lawyer")
  const isActive = pathname === "/app/research" || pathname.startsWith("/app/research/")
  const inner = (
    <Link
      href="/app/research"
      onClick={onNavigate}
      title={minimized ? t("nav.aiLegalSearch") : undefined}
      className={cn(
        "group relative flex items-center rounded-lg text-sm font-semibold transition-all duration-150 mb-1 overflow-hidden",
        minimized ? "justify-center p-2.5" : "gap-2.5 px-3 py-2.5",
        isActive
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-primary/8 text-primary hover:bg-primary/12 ring-1 ring-primary/20 hover:ring-primary/30",
      )}
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <Sparkles className={cn("h-4 w-4 shrink-0 relative z-10", isActive ? "text-primary-foreground" : "text-primary")} />
      {!minimized && <span className="truncate relative z-10">{t("nav.aiLegalSearch")}</span>}
    </Link>
  )
  if (minimized) return <IconTooltip label={t("nav.aiLegalSearch")}>{inner}</IconTooltip>
  return inner
}

function DocumentReviewLink({
  pathname,
  onNavigate,
  minimized,
}: {
  pathname: string
  onNavigate?: () => void
  minimized?: boolean
}) {
  const isActive = pathname === "/app/document-review" || pathname.startsWith("/app/document-review/")
  const inner = (
    <Link
      href="/app/document-review"
      onClick={onNavigate}
      title={minimized ? "Document Review" : undefined}
      className={cn(
        "group relative flex items-center rounded-lg text-sm font-semibold transition-all duration-150 mb-1 overflow-hidden",
        minimized ? "justify-center p-2.5" : "gap-2.5 px-3 py-2.5",
        isActive
          ? "bg-violet-600 text-white shadow-sm"
          : "bg-violet-500/8 text-violet-700 dark:text-violet-400 hover:bg-violet-500/12 ring-1 ring-violet-500/20 hover:ring-violet-500/30",
      )}
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <FileSearch className={cn("h-4 w-4 shrink-0 relative z-10", isActive ? "text-white" : "text-violet-600 dark:text-violet-400")} />
      {!minimized && (
        <>
          <span className="truncate relative z-10 flex-1">Document Review</span>
          <span className={cn(
            "relative z-10 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
            isActive ? "bg-white/20 text-white" : "bg-violet-500/15 text-violet-700 dark:text-violet-300",
          )}>
            Tabular
          </span>
        </>
      )}
    </Link>
  )
  if (minimized) return <IconTooltip label="Document Review">{inner}</IconTooltip>
  return inner
}

function SectionFinderLink({
  pathname,
  onNavigate,
  minimized,
}: {
  pathname: string
  onNavigate?: () => void
  minimized?: boolean
}) {
  const { countryCode, isLoading: countryLoading } = useDetectedCountry()
  if (countryLoading || !isSectionFinderCountry(countryCode)) return null
  const flag = countryFlag(countryCode)
  const flagLabel = countryFlagLabel(countryCode)
  const href =
    countryCode === "US" || countryCode === "GB" || countryCode === "KE"
      ? `/app/section-finder?country=${countryCode}`
      : "/app/section-finder"
  const isActive = pathname === "/app/section-finder" || pathname.startsWith("/app/section-finder/")
  const inner = (
    <Link
      href={href}
      onClick={onNavigate}
      title={minimized ? "Section Finder" : undefined}
      className={cn(
        "group relative flex items-center rounded-lg text-sm font-semibold transition-all duration-150 mb-1 overflow-hidden",
        minimized ? "justify-center p-2.5" : "gap-2.5 px-3 py-2.5",
        isActive
          ? "bg-orange-600 text-white shadow-sm"
          : "bg-orange-500/[0.06] text-orange-700 dark:text-orange-400 hover:bg-orange-500/[0.10] ring-1 ring-orange-500/20 hover:ring-orange-500/30",
      )}
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <BookOpen className={cn("h-4 w-4 shrink-0 relative z-10", isActive ? "text-white" : "text-orange-600 dark:text-orange-400")} />
      {!minimized && (
        <>
          <span className="truncate relative z-10">Section Finder</span>
          {flag && (
            <span className="ml-auto shrink-0 text-[10px] font-bold bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded px-1 py-0.5">
              {flag}
            </span>
          )}
        </>
      )}
    </Link>
  )
  if (minimized) {
    return <IconTooltip label={flagLabel ? `Section Finder (${flagLabel})` : "Section Finder"}>{inner}</IconTooltip>
  }
  return inner
}

function DraftFormsLink({
  pathname,
  onNavigate,
  minimized,
}: {
  pathname: string
  onNavigate?: () => void
  minimized?: boolean
}) {
  const t = useTranslations("lawyer")
  const label = t("nav.documentDrafting")
  const isActive =
    pathname === "/app/legal-forms" ||
    pathname.startsWith("/app/legal-forms/") ||
    pathname === "/app/india-drafting" ||
    pathname.startsWith("/app/india-drafting/")
  const inner = (
    <Link
      href="/app/legal-forms"
      onClick={onNavigate}
      title={minimized ? label : undefined}
      className={cn(
        "group relative flex items-center rounded-lg text-sm font-semibold transition-all duration-150 mb-1 overflow-hidden",
        minimized ? "justify-center p-2.5" : "gap-2.5 px-3 py-2.5",
        isActive
          ? "bg-violet-600 text-white shadow-sm"
          : "bg-violet-500/[0.06] text-violet-700 dark:text-violet-400 hover:bg-violet-500/[0.10] ring-1 ring-violet-500/20 hover:ring-violet-500/30",
      )}
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <Library className={cn("h-4 w-4 shrink-0 relative z-10", isActive ? "text-white" : "text-violet-600 dark:text-violet-400")} />
      {!minimized && <span className="truncate relative z-10">{label}</span>}
    </Link>
  )
  if (minimized) return <IconTooltip label={label}>{inner}</IconTooltip>
  return inner
}

function UsDraftingLink({
  pathname,
  onNavigate,
  minimized,
}: {
  pathname: string
  onNavigate?: () => void
  minimized?: boolean
}) {
  const { countryCode } = useDetectedCountry()
  if (countryCode !== "US") return null
  const isActive = pathname === "/app/us-drafting" || pathname.startsWith("/app/us-drafting/")
  const inner = (
    <Link
      href="/app/us-drafting"
      onClick={onNavigate}
      title={minimized ? "US Drafting" : undefined}
      className={cn(
        "group relative flex items-center rounded-lg text-sm font-semibold transition-all duration-150 mb-1 overflow-hidden",
        minimized ? "justify-center p-2.5" : "gap-2.5 px-3 py-2.5",
        isActive
          ? "bg-blue-600 text-white shadow-sm"
          : "bg-blue-500/[0.06] text-blue-700 dark:text-blue-400 hover:bg-blue-500/[0.10] ring-1 ring-blue-500/20 hover:ring-blue-500/30",
      )}
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <Scale className={cn("h-4 w-4 shrink-0 relative z-10", isActive ? "text-white" : "text-blue-600 dark:text-blue-400")} />
      {!minimized && (
        <>
          <span className="truncate relative z-10">US Drafting</span>
          <span className="ml-auto shrink-0 text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded px-1 py-0.5">US</span>
        </>
      )}
    </Link>
  )
  if (minimized) return <IconTooltip label="US Drafting">{inner}</IconTooltip>
  return inner
}

function NewIntakeLink({
  pathname,
  onNavigate,
  minimized,
}: {
  pathname: string
  onNavigate?: () => void
  minimized?: boolean
}) {
  const t = useTranslations("lawyer")
  const isActive = pathname === "/app/intake" || pathname.startsWith("/app/intake/")
  const inner = (
    <Link
      href="/app/intake"
      onClick={onNavigate}
      title={minimized ? t("nav.newIntake") : undefined}
      className={cn(
        "group relative flex items-center rounded-lg text-sm font-semibold transition-all duration-150 mb-3 overflow-hidden",
        minimized ? "justify-center p-2.5" : "gap-2.5 px-3 py-2.5",
        isActive
          ? "bg-emerald-600 text-white shadow-sm"
          : "bg-emerald-500/8 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/12 ring-1 ring-emerald-500/20 hover:ring-emerald-500/30",
      )}
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <Scale className={cn("h-4 w-4 shrink-0 relative z-10", isActive ? "text-white" : "text-emerald-600 dark:text-emerald-400")} />
      {!minimized && <span className="truncate relative z-10">{t("nav.newIntake")}</span>}
    </Link>
  )
  if (minimized) return <IconTooltip label={t("nav.newIntake")}>{inner}</IconTooltip>
  return inner
}

function NavLink({
  item,
  pathname,
  counts,
  onNavigate,
  minimized,
}: {
  item: NavItem
  pathname: string
  counts: MeCounts
  onNavigate?: () => void
  minimized?: boolean
}) {
  const t = useTranslations("lawyer")
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
  const badgeCount = item.badgeKey ? counts[item.badgeKey] : undefined
  const label = t(item.nameKey)

  const inner = (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={minimized ? label : undefined}
      className={cn(
        "group relative flex items-center rounded-lg text-sm transition-all duration-150 overflow-hidden",
        minimized ? "justify-center p-2.5" : "gap-2.5 px-3 py-2",
        isActive
          ? "bg-primary/10 text-primary font-semibold"
          : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {/* Left accent bar for active state */}
      {isActive && !minimized && (
        <span className="absolute left-0 inset-y-1.5 w-[3px] rounded-r-full bg-primary" />
      )}
      <item.icon
        className={cn(
          "h-4 w-4 shrink-0 transition-all relative z-10",
          isActive ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground/80",
        )}
      />
      {!minimized && <span className="truncate relative z-10">{label}</span>}
      {!minimized && <NavBadge count={badgeCount} variant={item.badgeVariant} />}
      {minimized && badgeCount != null && badgeCount > 0 && (
        <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-destructive" />
      )}
    </Link>
  )

  if (minimized) return <IconTooltip label={label}>{inner}</IconTooltip>
  return inner
}

const COLLAPSE_STORAGE_KEY = "sidebar-collapsed-groups"

function SidebarNav({
  pathname,
  role,
  permissions,
  isSolo,
  counts,
  onNavigate,
  minimized,
}: {
  pathname: string
  role: UserRole
  permissions: RolePermissions
  isSolo: boolean
  counts: MeCounts
  onNavigate?: () => void
  minimized?: boolean
}) {
  const t = useTranslations("lawyer")
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY)
      const base: Record<string, boolean> = {}
      for (const group of NAV_GROUPS) {
        if (group.collapsible && group.defaultCollapsed) base[group.id] = true
      }
      if (stored) Object.assign(base, JSON.parse(stored))
      setCollapsed(base)
    } catch {
      // ignore malformed storage
    }
  }, [])

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  return (
    <nav className="space-y-0.5" data-tour="sidebar-nav">
      {AI_SEARCH_ROLES.includes(role) && (
        <AiSearchLink pathname={pathname} onNavigate={onNavigate} minimized={minimized} />
      )}
      {AI_SEARCH_ROLES.includes(role) && (
        <DraftFormsLink pathname={pathname} onNavigate={onNavigate} minimized={minimized} />
      )}
      {AI_SEARCH_ROLES.includes(role) && (
        <DocumentReviewLink pathname={pathname} onNavigate={onNavigate} minimized={minimized} />
      )}
      {AI_SEARCH_ROLES.includes(role) && (
        <SectionFinderLink pathname={pathname} onNavigate={onNavigate} minimized={minimized} />
      )}
      {AI_SEARCH_ROLES.includes(role) && (
        <UsDraftingLink pathname={pathname} onNavigate={onNavigate} minimized={minimized} />
      )}
      {INTAKE_ROLES.includes(role) && (
        <NewIntakeLink pathname={pathname} onNavigate={onNavigate} minimized={minimized} />
      )}

      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) =>
          itemVisible(item, role, isSolo, permissions),
        )
        if (items.length === 0) return null

        const isCollapsed = group.collapsible ? collapsed[group.id] : false

        return (
          <div key={group.id} className="space-y-0.5">
            {/* Group header — hidden in minimized mode */}
            {group.labelKey && !minimized &&
              (group.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggle(group.id)}
                  className="group flex w-full items-center gap-1 px-3 pt-4 pb-1 transition-colors"
                >
                  <span className="flex-1 h-px bg-border/50 mr-1" />
                  <span className="text-[10px] font-semibold tracking-[0.1em] text-muted-foreground/50 uppercase group-hover:text-muted-foreground transition-colors">
                    {t(group.labelKey)}
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-3 w-3 ml-0.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-all duration-200",
                      !isCollapsed && "rotate-90",
                    )}
                  />
                </button>
              ) : (
                <div className="flex items-center gap-1 px-3 pt-4 pb-1">
                  <span className="flex-1 h-px bg-border/50 mr-1" />
                  <span className="text-[10px] font-semibold tracking-[0.1em] text-muted-foreground/50 uppercase">
                    {t(group.labelKey)}
                  </span>
                </div>
              ))}

            {/* In minimized mode show a thin divider between groups */}
            {minimized && group.labelKey && (
              <div className="mx-2 my-2 h-px bg-border/40" />
            )}

            {(!isCollapsed || minimized) &&
              items.map((item) => (
                <NavLink
                  key={item.nameKey}
                  item={item}
                  pathname={pathname}
                  counts={counts}
                  onNavigate={onNavigate}
                  minimized={minimized}
                />
              ))}
          </div>
        )
      })}
    </nav>
  )
}

function SidebarBrand({
  minimized,
  onToggleMinimized,
}: {
  minimized?: boolean
  onToggleMinimized: () => void
}) {
  return (
    <div className={cn("pb-4 mb-1 w-full", minimized && "pb-2 mb-0")}>
      <div
        className={cn(
          "flex items-center w-full",
          minimized ? "flex-col gap-2" : "justify-between gap-2",
        )}
      >
        {minimized ? (
          <Link
            href="/app/home"
            className="flex items-center justify-center h-7 w-7 opacity-90 hover:opacity-100 transition-opacity"
          >
            <Building2 className="h-6 w-6 text-primary" />
          </Link>
        ) : (
          <UmbrellaLogo
            href="/app/home"
            height={28}
            priority
            className="opacity-90 hover:opacity-100 transition-opacity min-w-0"
          />
        )}
        <button
          type="button"
          onClick={onToggleMinimized}
          title={minimized ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={minimized ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/60 transition-all duration-150 shrink-0",
            minimized && "mx-auto",
          )}
        >
          {minimized ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>
      <div className="mt-3 h-px bg-gradient-to-r from-transparent via-border/70 to-transparent" />
    </div>
  )
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

function SidebarUserStrip({ minimized }: { minimized?: boolean }) {
  const t = useTranslations("lawyer")
  const tCommon = useTranslations("common")
  const tDashboard = useTranslations("dashboard")
  const { currentRole, currentUser } = useRole()
  const { logout } = useAuth()

  const userName = currentUser?.name ?? tCommon("user")
  const userEmail = currentUser?.email ?? ""
  const roleLabel = tDashboard(`roles.${currentRole}` as "roles.PARTNER_ADMIN")
  const initials = getInitials(userName)

  const handleSignOut = async () => {
    await logout()
  }

  if (minimized) {
    return (
      <div className="pt-3 mt-1 flex flex-col items-center gap-1.5 shrink-0">
        <div className="mb-1 h-px w-full bg-gradient-to-r from-transparent via-border/50 to-transparent" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title={userName}
              className="group h-8 w-8 rounded-full bg-gradient-to-br from-primary/60 to-primary/30 flex items-center justify-center text-[11px] font-bold text-primary ring-2 ring-primary/20 ring-offset-1 hover:ring-primary/40 transition-all"
            >
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-60 ml-1">
            <DropdownMenuLabel>
              <div className="flex items-center gap-2.5 py-0.5">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/60 to-primary/30 flex items-center justify-center text-[12px] font-bold text-primary shrink-0">
                  {initials}
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-sm font-semibold leading-none truncate">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground truncate">{userEmail}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app/profile" className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                {tCommon("settings")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/trust" className="flex items-center gap-2 cursor-pointer">
                <ShieldCheck className="h-4 w-4" />
                Trust Center
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
        <div className="flex flex-col items-center gap-0.5">
          <ThemeToggle className="h-8 w-8 text-muted-foreground/70 hover:text-foreground" />
          <ThemeSelector compact />
        </div>
      </div>
    )
  }

  return (
    <div className="pt-3 mt-1 shrink-0">
      <div className="mb-2 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex w-full min-w-0 items-center gap-2.5 px-1 py-2 rounded-lg text-sm transition-all duration-150 hover:bg-muted/60"
          >
            <div className="relative h-7 w-7 shrink-0">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/60 to-primary/30 flex items-center justify-center text-[11px] font-bold text-primary ring-2 ring-primary/20 ring-offset-1 ring-offset-[hsl(var(--sidebar-bg))]">
                {initials}
              </div>
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-[hsl(var(--sidebar-bg))]" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[13px] font-semibold text-foreground truncate leading-tight">{userName}</div>
              <div className="text-[10px] text-muted-foreground/70 truncate leading-tight">{roleLabel}</div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-60 mb-1">
          <DropdownMenuLabel>
            <div className="flex items-center gap-2.5 py-0.5">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/60 to-primary/30 flex items-center justify-center text-[12px] font-bold text-primary shrink-0">
                {initials}
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-sm font-semibold leading-none truncate">{userName}</p>
                <p className="text-xs leading-none text-muted-foreground truncate">{userEmail}</p>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/app/profile" className="flex items-center gap-2 cursor-pointer">
              <Settings className="h-4 w-4" />
              {tCommon("settings")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/trust" className="flex items-center gap-2 cursor-pointer">
              <ShieldCheck className="h-4 w-4" />
              Trust Center
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
      <div className="mt-1 flex items-center justify-between gap-1 px-1">
        <div className="flex items-center gap-0.5 rounded-lg border border-border/40 bg-muted/20 px-1 py-0.5">
          <ThemeToggle className="h-8 w-8 text-muted-foreground/70 hover:text-foreground" />
          <ThemeSelector compact />
        </div>
        <span className="text-[10px] text-muted-foreground/60 pr-1">Theme</span>
      </div>
    </div>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const sidebarOpen = useUIStore((state) => state.sidebarOpen)
  const setSidebarOpen = useUIStore((state) => state.setSidebarOpen)
  const sidebarMinimized = useUIStore((state) => state.sidebarMinimized)
  const setSidebarMinimized = useUIStore((state) => state.setSidebarMinimized)
  const toggleSidebarMinimized = useUIStore((state) => state.toggleSidebarMinimized)
  const { currentRole, permissions } = useRole()
  const counts = useCounts()
  const isSolo = useIsSolo()
  const isDesktop = useMediaQuery("(min-width: 1024px)")

  useEffect(() => {
    setSidebarMinimized(readSidebarMinimizedPreference())
  }, [setSidebarMinimized])

  useEffect(() => {
    setSidebarOpen(isDesktop)
  }, [isDesktop, setSidebarOpen])

  const closeMobile = () => {
    if (!isDesktop) setSidebarOpen(false)
  }

  const sidebarInner = (minimized: boolean) => (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col pt-5 pb-4",
        minimized ? "px-1.5 items-center" : "px-3",
      )}
    >
      <div className="shrink-0 w-full">
        <SidebarBrand minimized={minimized} onToggleMinimized={toggleSidebarMinimized} />
      </div>
      <div
        className={cn(
          "app-scroll-pane flex-1 mt-2",
          minimized ? "w-full" : "-mx-1 px-1",
        )}
      >
        <SidebarNav
          pathname={pathname}
          role={currentRole}
          permissions={permissions}
          isSolo={isSolo}
          counts={counts}
          onNavigate={closeMobile}
          minimized={minimized}
        />
      </div>
      {!minimized && (
        <div className="shrink-0 w-full">
          <ReferralSidebarLink />
        </div>
      )}
      <div className="shrink-0 mt-auto w-full">
        <SidebarUserStrip minimized={minimized} />
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop: fixed column; main pane scrolls independently */}
      <aside
        className={cn(
          "sidebar-panel hidden h-full min-h-0 shrink-0 overflow-hidden shadow-[1px_0_0_0_hsl(var(--sidebar-border))] transition-[width] duration-200 ease-in-out lg:flex lg:flex-col",
          sidebarMinimized ? "w-14 min-w-14" : "w-[14.5rem] min-w-[14.5rem]",
        )}
      >
        {sidebarInner(sidebarMinimized)}
      </aside>

      {/* Mobile / tablet: slide-out drawer (always full width) */}
      <Sheet open={sidebarOpen && !isDesktop} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="flex h-full max-h-dvh w-[14.5rem] flex-col overflow-hidden p-0 pb-[env(safe-area-inset-bottom)]">
          {sidebarInner(false)}
        </SheetContent>
      </Sheet>
    </>
  )
}
