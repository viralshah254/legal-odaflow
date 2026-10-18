"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Users,
  Building2,
  TrendingUp,
  MessageCircle,
  CreditCard,
  ShieldCheck,
  Gift,
  Contact,
  BarChart2,
  ExternalLink,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminIdentityBanner } from "@/components/admin/admin-identity-banner"
import { AdminDailyTodos } from "@/components/admin/admin-daily-todos"
import { AdminLiveSnapshot } from "@/components/admin/admin-live-snapshot"
import { getAdminMe, listSuperAdmins, type AdminMe, type SuperAdminUser } from "@/lib/api/admin"

const QUICK_ACTIONS = [
  {
    href: "/admin/users",
    icon: Users,
    title: "Users",
    desc: "Manage platform users",
    accent: "bg-blue-500/10 text-blue-600",
  },
  {
    href: "/admin/tenants",
    icon: Building2,
    title: "Law Firms",
    desc: "View firm tenants",
    accent: "bg-teal-500/10 text-teal-600",
  },
  {
    href: "/admin/marketing",
    icon: TrendingUp,
    title: "Marketing",
    desc: "Site traffic & UTM",
    accent: "bg-purple-500/10 text-purple-600",
  },
  {
    href: "/admin/subscriptions",
    icon: CreditCard,
    title: "Subscriptions",
    desc: "Active plans",
    accent: "bg-amber-500/10 text-amber-600",
  },
  {
    href: "/admin/lawyer-prospects",
    icon: Contact,
    title: "Prospects",
    desc: "Lawyer outreach",
    accent: "bg-rose-500/10 text-rose-600",
  },
  {
    href: "/admin/whatsapp-campaigns",
    icon: MessageCircle,
    title: "WA Campaigns",
    desc: "WhatsApp outreach",
    accent: "bg-green-500/10 text-green-600",
  },
  {
    href: "/admin/referrals",
    icon: Gift,
    title: "Referrals",
    desc: "Attribution & rewards",
    accent: "bg-indigo-500/10 text-indigo-600",
  },
  {
    href: "/admin/compliance",
    icon: ShieldCheck,
    title: "Compliance",
    desc: "Audit & policies",
    accent: "bg-slate-500/10 text-slate-600",
  },
  {
    href: "/admin/costs",
    icon: BarChart2,
    title: "AI Costs",
    desc: "Platform spend",
    accent: "bg-orange-500/10 text-orange-600",
  },
]

export default function AdminHomePage() {
  const [me, setMe] = useState<AdminMe | null>(null)
  const [peers, setPeers] = useState<SuperAdminUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      getAdminMe().then(setMe),
      listSuperAdmins().then(setPeers),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Home</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Identity banner */}
      {me && <AdminIdentityBanner me={me} peers={peers} />}

      {/* Todos + Live snapshot */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminDailyTodos />
        <AdminLiveSnapshot />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {QUICK_ACTIONS.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer group">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className={`inline-flex rounded-md p-1.5 w-fit ${item.accent}`}>
                    <item.icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <CardTitle className="text-sm flex items-center gap-1">
                    {item.title}
                    <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-40 transition-opacity" />
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">{item.desc}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Analytics link */}
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium">Full Platform Analytics</p>
            <p className="text-xs text-muted-foreground">KPIs, charts, user growth, AI profitability</p>
          </div>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Open Analytics
            <ExternalLink className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
