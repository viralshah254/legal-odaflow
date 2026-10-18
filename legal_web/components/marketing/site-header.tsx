"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { LayoutDashboard, LogOut, Menu, Settings, User, X, Zap } from "lucide-react"
import { UmbrellaLogo } from "@/components/brand/umbrella-logo"
import { TourHelpTrigger } from "@/components/tutorials/tour-help-trigger"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/i18n/language-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/contexts/auth-context"
import { cn } from "@/lib/utils"

interface SiteHeaderProps {
  className?: string
}

export function SiteHeader({ className }: SiteHeaderProps) {
  const t = useTranslations("marketing.header")
  const tConsumerNav = useTranslations("consumer.nav")
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileOpen])

  const handleSignOut = async () => {
    await logout()
    setMobileOpen(false)
  }

  const dashboardHref =
    user?.userType === "LAWYER" ? "/app/dashboard" : "/consumer/dashboard"

  const settingsHref =
    user?.userType === "LAWYER" ? "/app/settings" : "/consumer/settings"

  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || t("account")
  const isConsumerArea = isAuthenticated && pathname.startsWith("/consumer")
  const isOnDashboard = pathname === "/consumer/dashboard"
  const showConsumerHelp = isConsumerArea

  const consumerNavLinks = [
    { href: "/consumer/cases", labelKey: "cases" as const },
    { href: "/consumer/reports", labelKey: "reports" as const },
    { href: "/consumer/document-review", labelKey: "documentReview" as const },
    { href: "/consumer/research", labelKey: "research" as const },
    { href: "/consumer/subscription", labelKey: "subscription" as const },
  ]

  const marketingNavLinks = [
    { href: "/legal-ai", label: t("legalAi") },
    { href: "/solutions", label: t("solutions") },
    { href: "/for-lawyers", label: t("forLawyers") },
    { href: "/pricing", label: t("pricing") },
  ]

  const closeMobile = () => setMobileOpen(false)

  const mobileMenu =
    mobileOpen && mounted ? (
      <div
        className="fixed inset-x-0 top-16 bottom-0 z-[100] md:hidden"
        role="presentation"
      >
        <button
          type="button"
          className="absolute inset-0 bg-background/80"
          aria-label="Close menu"
          onClick={closeMobile}
        />
        <div
          id="marketing-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-labelledby="marketing-mobile-menu-title"
          data-tour="marketing-mobile-menu-panel"
          className="absolute inset-y-0 right-0 z-[101] flex w-full max-w-sm flex-col gap-4 overflow-y-auto border-l bg-background p-6 shadow-lg pb-safe-bottom animate-in slide-in-from-right duration-300"
        >
          <div className="flex items-center justify-between shrink-0">
            <UmbrellaLogo height={32} className="opacity-90" />
            <h2 id="marketing-mobile-menu-title" className="sr-only">
              Menu
            </h2>
          </div>
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {isConsumerArea
              ? consumerNavLinks.map(({ href, labelKey }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={closeMobile}
                    className={cn(
                      "rounded-lg px-3 py-3 min-h-[44px] text-sm font-medium transition-colors",
                      pathname.startsWith(href)
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {tConsumerNav(labelKey)}
                  </Link>
                ))
              : marketingNavLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={closeMobile}
                    className={cn(
                      "rounded-lg px-3 py-3 min-h-[44px] text-sm font-medium transition-colors",
                      pathname.startsWith(href)
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {label}
                  </Link>
                ))}

            <div className="my-3 border-t" />

            {isLoading ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Loading…</p>
            ) : !isAuthenticated ? (
              <>
                <Link
                  href="/demo"
                  onClick={closeMobile}
                  className="inline-flex w-full items-center justify-start gap-2 rounded-md border border-input bg-background h-11 px-4 text-sm font-medium hover:bg-accent"
                >
                  <Zap className="h-4 w-4" />
                  {t("demo")}
                </Link>
                <Link
                  href="/auth"
                  onClick={closeMobile}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-primary text-primary-foreground h-11 px-4 text-sm font-medium"
                >
                  {t("getStarted")}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={dashboardHref}
                  onClick={closeMobile}
                  className="rounded-lg px-3 py-3 min-h-[44px] text-sm font-medium hover:bg-muted flex items-center gap-2"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  {t("dashboard")}
                </Link>
                <Link
                  href={settingsHref}
                  onClick={closeMobile}
                  className="rounded-lg px-3 py-3 min-h-[44px] text-sm font-medium hover:bg-muted flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  {t("settings")}
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="rounded-lg px-3 py-3 min-h-[44px] text-sm font-medium text-destructive hover:bg-muted flex items-center gap-2 text-left"
                >
                  <LogOut className="h-4 w-4" />
                  {t("signOut")}
                </button>
              </>
            )}
          </nav>
        </div>
      </div>
    ) : null

  return (
    <header
      className={cn(
        "border-b border-border/40 dark:border-border/50 bg-background/95 dark:bg-background/95 backdrop-blur-md sticky top-0 z-[60] shadow-sm dark:shadow-primary/5 w-full",
        className,
      )}
    >
      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl w-full">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <UmbrellaLogo height={40} priority className="group-hover:opacity-90 transition-opacity" />
          <nav className="flex items-center gap-2 sm:gap-3">
            {isConsumerArea ? (
              <>
                {consumerNavLinks.map(({ href, labelKey }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "px-3 py-2 text-sm font-medium transition-colors rounded-lg hover:bg-accent/50 hidden md:block",
                      pathname.startsWith(href)
                        ? "text-foreground bg-accent/40"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tConsumerNav(labelKey)}
                  </Link>
                ))}
              </>
            ) : (
              <>
                {marketingNavLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent/50",
                      href === "/solutions" ? "hidden lg:block" : "hidden md:block",
                    )}
                  >
                    {label}
                  </Link>
                ))}
              </>
            )}
            <ThemeToggle />
            {!isLoading && !isAuthenticated && (
              <Link href="/demo">
                <Button variant="outline" className="hidden md:flex h-9 px-4">
                  <Zap className="mr-2 h-4 w-4" />
                  {t("demo")}
                </Button>
              </Link>
            )}

            {!isLoading && isAuthenticated && user ? (
              <>
                {showConsumerHelp ? <TourHelpTrigger variant="ghost" /> : null}
                {!isOnDashboard && (
                  <Link href={dashboardHref} className="hidden sm:block">
                    <Button variant="ghost" className="h-9 px-4">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      {t("dashboard")}
                    </Button>
                  </Link>
                )}
                <LanguageToggle />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-9 gap-2 px-3 sm:px-4">
                      <User className="h-4 w-4" />
                      <span className="hidden sm:inline max-w-[120px] truncate">
                        {displayName}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <p className="text-sm font-medium">{displayName}</p>
                      {user.email && (
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={dashboardHref}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        {t("dashboard")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={settingsHref}>
                        <Settings className="mr-2 h-4 w-4" />
                        {t("settings")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      {t("signOut")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link href="/auth">
                  <Button className="hidden sm:inline-flex h-9 px-4 sm:px-6 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 hover:scale-105 gap-1.5">
                    <span>{t("getStarted")}</span>
                    <span className="hidden sm:inline text-[10px] font-bold bg-primary-foreground/20 rounded px-1 py-0.5 leading-none tracking-wide">
                      {t("free")}
                    </span>
                  </Button>
                </Link>
              </>
            )}

            {/* Mobile menu — custom panel (avoids Radix Dialog open/dismiss race on the same click) */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden h-10 w-10"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="marketing-mobile-menu"
              data-tour="marketing-mobile-menu"
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </nav>
        </div>
      </div>
      {mounted && mobileMenu ? createPortal(mobileMenu, document.body) : null}
    </header>
  )
}
