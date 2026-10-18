"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AdminUserBridge } from "@/lib/auth/admin-user-bridge"
import { useAuth } from "@/lib/contexts/auth-context"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Building2,
  Gift,
  Contact,
  Scale,
  DollarSign,
  TrendingUp,
  Zap,
  BarChart2,
  FileText,
  ShieldCheck,
  BookOpen,
  Database,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Brain,
  MessageCircle,
  CreditCard,
  Landmark,
  Receipt,
  Wallet,
  PiggyBank,
  Home,
  ClipboardList,
  SearchX,
  History,
} from "lucide-react"

const NAV_ITEMS = [
  { label: "Home", href: "/admin/home", icon: Home },
  { label: "Analytics", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Marketing", href: "/admin/marketing", icon: TrendingUp },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "User Activity", href: "/admin/user-activity", icon: History },
  { label: "Tenants", href: "/admin/tenants", icon: Building2 },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: CreditCard },
  { label: "Review Requests", href: "/admin/review-requests", icon: Scale },
  { label: "Marketplace Lawyers", href: "/admin/marketplace-lawyers", icon: ShieldCheck },
  { label: "Referrals", href: "/admin/referrals", icon: Gift },
  { label: "Lawyer Prospects", href: "/admin/lawyer-prospects", icon: Contact },
  { label: "WA Campaigns", href: "/admin/whatsapp-campaigns", icon: MessageCircle },
  { label: "Demo Requests", href: "/admin/demo-requests", icon: ClipboardList },
  { label: "Compliance", href: "/admin/compliance", icon: ShieldCheck },
  { divider: true, label: "Accounting" },
  { label: "Overview", href: "/admin/accounting", icon: Landmark },
  { label: "Revenue", href: "/admin/accounting/revenue", icon: Wallet },
  { label: "Expenses", href: "/admin/accounting/expenses", icon: Receipt },
  { label: "Taxes", href: "/admin/accounting/taxes", icon: PiggyBank },
  { divider: true, label: "AI & Costs" },
  { label: "AI Costs", href: "/admin/costs", icon: DollarSign },
  { label: "AI Profitability", href: "/admin/ai-profitability", icon: TrendingUp },
  { label: "AI Logs", href: "/admin/ai-logs", icon: Zap },
  { label: "Credit Rates", href: "/admin/credit-rates", icon: BarChart2 },
  { label: "Model Costs", href: "/admin/ai-model-costs", icon: BarChart2 },
  { divider: true, label: "Data" },
  { label: "Legal Sources", href: "/admin/legal-sources", icon: BookOpen },
  { label: "Training Datasets", href: "/admin/training-datasets", icon: Database },
  { label: "MI Metadata", href: "/admin/mi-metadata", icon: Database },
  { label: "MI Audit", href: "/admin/mi-audit", icon: Brain },
  { label: "Audit Log", href: "/admin/audit", icon: FileText },
  { divider: true, label: "Research Accuracy" },
  { label: "Section Corrections", href: "/admin/research-corrections", icon: ShieldCheck },
  { label: "Unmatched Sections", href: "/admin/unmatched-sections", icon: FileText },
  { label: "Retrieval Gaps", href: "/admin/retrieval-gaps", icon: SearchX },
]

function AdminSidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  return (
    <aside className="flex h-full min-h-0 w-56 shrink-0 flex-col overflow-hidden border-r border-border bg-card">
      <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
        <Link href="/admin/home" className="flex items-center gap-2 font-semibold text-sm">
          <span className="text-primary text-lg font-bold">U</span>
          <span className="text-foreground">Admin</span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="app-scroll-pane min-h-0 flex-1 space-y-0.5 px-2 py-3">
        {NAV_ITEMS.map((item, idx) => {
          if ("divider" in item && item.divider) {
            return (
              <div key={idx} className="pt-4 pb-1 px-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </p>
              </div>
            )
          }
          if (!item.href) return null
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          const Icon = item.icon!
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
              {isActive && <ChevronRight className="h-3 w-3 ml-auto opacity-50" />}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    await logout()
  }

  useEffect(() => {
    document.documentElement.classList.add("app-shell")
    return () => {
      document.documentElement.classList.remove("app-shell")
    }
  }, [])

  return (
    <div className="fixed inset-0 z-0 flex flex-col overflow-hidden bg-background">
      <header className="z-20 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
        <button
          className="md:hidden text-muted-foreground hover:text-foreground"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-medium text-muted-foreground hidden md:block">
          {user?.name ?? "Platform Admin"}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <span className="text-xs text-muted-foreground hidden sm:block">
            {user?.email ?? "admin"}
          </span>
          <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
            SUPER ADMIN
          </span>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="hidden h-full min-h-0 shrink-0 md:flex">
          <AdminSidebar />
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="relative z-50 flex">
              <AdminSidebar onClose={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <main className="app-scroll-pane min-h-0 flex-1 p-4 sm:p-6 md:p-8">
          <Suspense fallback={null}>{children}</Suspense>
        </main>
      </div>
    </div>
  )
}

export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminUserBridge>
      <AdminShell>{children}</AdminShell>
    </AdminUserBridge>
  )
}
