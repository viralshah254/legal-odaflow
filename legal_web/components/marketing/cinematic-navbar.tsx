"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  Briefcase,
  Building2,
  ChevronDown,
  Code2,
  FileText,
  GitCompareArrows,
  HeartHandshake,
  Layers3,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { UmbrellaLogo } from "@/components/brand/umbrella-logo"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/contexts/auth-context"
import { marketingContent, type MarketingNavIcon } from "@/content/marketing"

const NAV_ICONS: Record<MarketingNavIcon, typeof Sparkles> = {
  sparkles: Sparkles,
  search: Search,
  file: FileText,
  shield: ShieldCheck,
  briefcase: Briefcase,
  user: User,
  building: Building2,
  heart: HeartHandshake,
  users: Users,
  book: BookOpen,
  layers: Layers3,
  compare: GitCompareArrows,
  code: Code2,
  lock: LockKeyhole,
}

function isActivePath(pathname: string, href: string) {
  if (pathname === href) return true
  if (href === "/solutions") return false
  return pathname.startsWith(`${href}/`)
}

export function CinematicNavbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const onHome = pathname === "/"
  const { user, isAuthenticated, isLoading, logout } = useAuth()

  useEffect(() => {
    document.body.classList.add("marketing-light")
    const onScroll = () => setScrolled(window.scrollY > 16)
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false)
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.classList.remove("marketing-light")
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("keydown", onKey)
    }
  }, [])

  const dashboardHref = user?.userType === "LAWYER" ? "/app/dashboard" : "/consumer/dashboard"
  const settingsHref = user?.userType === "LAWYER" ? "/app/settings" : "/consumer/settings"
  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "Account"
  const demoHref = pathname === "/demo" ? "#request-demo" : "/demo"

  const handleSignOut = async () => {
    await logout()
    setOpen(false)
  }

  return (
    <header className={`sticky top-0 z-[70] transition-all duration-300 ${scrolled || !onHome ? "border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl" : "bg-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-20 lg:px-8 xl:px-12">
        <Link href="/" aria-label="Umbrella home"><UmbrellaLogo height={38} priority link={false} /></Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
          {marketingContent.navigation.groups.map((group) => {
            const active = isActivePath(pathname, group.href) || group.items.some((item) => isActivePath(pathname, item.href))
            return (
              <DropdownMenu key={group.label}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${
                      active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-white hover:text-slate-950"
                    }`}
                  >
                    {group.label}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={12} className="w-[370px] rounded-2xl border-slate-200 bg-white p-2 text-slate-950 shadow-2xl shadow-slate-900/10">
                  <DropdownMenuLabel className="mb-1 rounded-xl bg-slate-50 px-3 py-2.5 font-normal">
                    <span className="block text-sm font-semibold text-slate-950">{group.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">{group.description}</span>
                  </DropdownMenuLabel>
                  {group.items.map((item) => {
                    const Icon = NAV_ICONS[item.icon]
                    const itemActive = isActivePath(pathname, item.href)
                    return (
                      <DropdownMenuItem key={item.href} asChild className="cursor-pointer rounded-xl p-0 focus:bg-blue-50 focus:text-slate-950">
                        <Link href={item.href} className={`flex items-start gap-3 px-3 py-2.5 ${itemActive ? "bg-blue-50" : ""}`}>
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Icon className="h-4 w-4" /></span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-900">{item.label}</span>
                            <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.description}</span>
                          </span>
                        </Link>
                      </DropdownMenuItem>
                    )
                  })}
                  {!group.items.some((item) => item.href === group.href) && (
                    <DropdownMenuItem asChild className="mt-1 cursor-pointer rounded-xl p-0 focus:bg-blue-50 focus:text-blue-800">
                      <Link href={group.href} className="flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-blue-700">
                        View all {group.label.toLowerCase()}
                        <span aria-hidden>→</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          })}
          {marketingContent.navigation.direct.map((item) => (
            <Link key={item.label} href={item.href ?? "#"} className={`rounded-full px-3 py-2 text-sm font-medium transition ${pathname === item.href ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-white hover:text-slate-950"}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 sm:flex">
          {isLoading ? (
            <div className="flex items-center gap-2" aria-label="Loading account">
              <span className="h-8 w-20 animate-pulse rounded-full bg-slate-100" />
              <span className="h-8 w-28 animate-pulse rounded-full bg-slate-200" />
            </div>
          ) : isAuthenticated && user ? (
            <>
              <Link href={dashboardHref}><Button variant="ghost" size="sm" className="rounded-full text-slate-700 hover:bg-slate-100 hover:text-slate-950"><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</Button></Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 rounded-full border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"><User className="h-4 w-4 shrink-0" /><span className="max-w-[140px] truncate">{displayName}</span></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 border-slate-200 bg-white text-slate-950">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-sm font-medium text-slate-950">{displayName}</p>
                    {user.email && <p className="truncate text-xs text-slate-500">{user.email}</p>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-200" />
                  <DropdownMenuItem asChild className="focus:bg-slate-100 focus:text-slate-950"><Link href={dashboardHref}><LayoutDashboard className="mr-2 h-4 w-4" />Dashboard</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild className="focus:bg-slate-100 focus:text-slate-950"><Link href={settingsHref}><Settings className="mr-2 h-4 w-4" />Settings</Link></DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-200" />
                  <DropdownMenuItem onClick={handleSignOut} className="text-rose-600 focus:bg-rose-50 focus:text-rose-700"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link href="/auth" className="px-3 py-2 text-sm font-medium text-slate-700">Log in</Link>
              <Link href={demoHref}><Button size="sm" className="rounded-full border-transparent bg-slate-900 text-white hover:bg-slate-800">Book a demo</Button></Link>
              <Link href="/auth"><Button size="sm" className="rounded-full">Start free</Button></Link>
            </>
          )}
        </div>
        <Button type="button" variant="ghost" size="icon" className="text-slate-800 hover:bg-slate-100 hover:text-slate-950 sm:hidden" aria-expanded={open} aria-controls="cinematic-mobile-navigation" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen((value) => !value)}>{open ? <X /> : <Menu />}</Button>
      </div>
      <AnimatePresence>
        {open && <motion.nav id="cinematic-mobile-navigation" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="border-t border-slate-200 bg-white px-5 py-5 shadow-xl sm:hidden" aria-label="Mobile navigation">
          <div className="flex flex-col gap-1">
            {marketingContent.navigation.groups.map((group) => (
              <details key={group.label} className="group rounded-xl">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-xl px-3 py-3 text-base font-medium text-slate-800 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                  {group.label}
                  <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mb-2 ml-3 space-y-1 border-l border-slate-200 pl-3">
                  {!group.items.some((item) => item.href === group.href) && (
                    <Link href={group.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50">View all {group.label.toLowerCase()}</Link>
                  )}
                  {group.items.map((item) => {
                    const Icon = NAV_ICONS[item.icon]
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex min-h-12 items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                        <span>
                          <span className="block text-sm font-medium text-slate-800">{item.label}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.description}</span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </details>
            ))}
            {marketingContent.navigation.direct.map((item) => (
              <Link key={item.label} href={item.href ?? "#"} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-base font-medium text-slate-800 hover:bg-slate-50">{item.label}</Link>
            ))}
            {isLoading ? (
              <div className="mt-3 space-y-2 border-t pt-4" aria-label="Loading account">
                <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-11 animate-pulse rounded-xl bg-slate-100" />
              </div>
            ) : isAuthenticated && user ? (
              <div className="mt-3 flex flex-col gap-1 border-t pt-4">
                <div className="mb-2 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white"><User className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{displayName}</p>
                    {user.email && <p className="truncate text-xs text-slate-500">{user.email}</p>}
                  </div>
                </div>
                <Link href={dashboardHref} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"><LayoutDashboard className="h-4 w-4" />Dashboard</Link>
                <Link href={settingsHref} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"><Settings className="h-4 w-4" />Settings</Link>
                <button type="button" onClick={handleSignOut} className="flex items-center gap-2 rounded-xl px-3 py-3 text-left text-base font-medium text-rose-600 hover:bg-rose-50"><LogOut className="h-4 w-4" />Sign out</button>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-4">
                <Link href="/auth" onClick={() => setOpen(false)} className="col-span-2 rounded-lg px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50">Log in</Link>
                <Link href={demoHref} onClick={() => setOpen(false)}><Button className="w-full border-transparent bg-slate-900 text-white hover:bg-slate-800">Book demo</Button></Link>
                <Link href="/auth" onClick={() => setOpen(false)}><Button className="w-full bg-blue-600 text-white hover:bg-blue-700">Start free</Button></Link>
              </div>
            )}
          </div>
        </motion.nav>}
      </AnimatePresence>
    </header>
  )
}
