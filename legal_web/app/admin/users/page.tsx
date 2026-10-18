"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Search, Users } from "lucide-react"
import { listAdminUsers, type AdminUser } from "@/lib/api/admin"
import { AdminUserDetailSheet } from "@/components/admin/admin-user-detail-sheet"

function tenantPlanBadge(billingPlan: string | undefined) {
  if (!billingPlan || billingPlan === "TRIAL_PENDING_PAYMENT" || billingPlan === "STARTER") {
    return <span className="text-muted-foreground text-xs">Free</span>
  }
  const labelMap: Record<string, string> = {
    SOLO: "Solo",
    PROFESSIONAL: "Professional",
    PRO_PLUS: "Pro Plus",
    ENTERPRISE: "Enterprise",
  }
  const label = labelMap[billingPlan] ?? billingPlan
  const colorMap: Record<string, string> = {
    SOLO: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    PROFESSIONAL: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    PRO_PLUS: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
    ENTERPRISE: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[billingPlan] ?? "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  )
}

function subscriptionStatusBadge(status: string | undefined, cancelAtPeriodEnd?: boolean) {
  if (!status) return null
  if (cancelAtPeriodEnd && status === "ACTIVE") {
    return (
      <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0">
        Cancel pending
      </Badge>
    )
  }
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    TRIALING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    PAST_DUE: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    CANCELED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    CHECKOUT_PENDING: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
    FREE: "bg-muted text-muted-foreground",
  }
  return (
    <Badge className={`text-xs border-0 ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  )
}

function consumerSubBadge(status: string | undefined) {
  if (!status || status === "FREE")
    return <span className="text-muted-foreground text-xs">Free</span>
  return subscriptionStatusBadge(status) ?? (
    <span className="text-muted-foreground text-xs">{status}</span>
  )
}

function userTypeBadge(t: string) {
  const map: Record<string, string> = {
    SUPER_ADMIN: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    LAWYER: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    CONSUMER: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    TENANT_ADMIN: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[t] ?? "bg-muted text-muted-foreground"}`}>
      {t}
    </span>
  )
}

function hasActiveSubscription(user: AdminUser): boolean {
  if (user.userType === "CONSUMER") {
    return user.consumerProfile?.subscriptionStatus === "ACTIVE"
  }
  const firmSub = user.tenantUsers?.[0]?.tenant?.subscription
  return firmSub?.status === "ACTIVE"
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [subscribedOnly, setSubscribedOnly] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const loadUsers = () => {
    setLoading(true)
    setError("")
    listAdminUsers()
      .then(setUsers)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const filtered = users.filter((u) => {
    if (subscribedOnly && !hasActiveSubscription(u)) return false
    if (!query) return true
    const q = query.toLowerCase()
    const firmNames = u.tenantUsers?.map((tu) => tu.tenant?.name ?? "").join(" ") ?? ""
    return (
      u.email.toLowerCase().includes(q) ||
      (u.name ?? "").toLowerCase().includes(q) ||
      (u.phone ?? "").toLowerCase().includes(q) ||
      (u.countryCode ?? "").toLowerCase().includes(q) ||
      (u.jurisdiction ?? "").toLowerCase().includes(q) ||
      firmNames.toLowerCase().includes(q)
    )
  })

  const openUser = (user: AdminUser) => {
    setSelectedUser(user)
    setSheetOpen(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All platform users ({users.length}) — click a row for signup details
          </p>
        </div>
        <Users className="h-6 w-6 text-muted-foreground" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, email, phone, firm, country..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant={subscribedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setSubscribedOnly((v) => !v)}
        >
          Subscribed only
        </Button>
      </div>

      {error && (
        <Card className="mb-4 border-destructive/50">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Country</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Region</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Phone</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Firm / tenant</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden xl:table-cell">Subscription</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden xl:table-cell">Credits</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Joined</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((u) => {
                const firm = u.tenantUsers?.[0]?.tenant
                const firmSub = firm?.subscription
                return (
                  <tr
                    key={u.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => openUser(u)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.name ?? u.email}</div>
                      <div className="text-xs text-muted-foreground">{u.name ? u.email : ""}</div>
                    </td>
                    <td className="px-4 py-3">{userTypeBadge(u.userType)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.countryCode ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell max-w-[140px] truncate">
                      {u.jurisdiction ?? u.consumerProfile?.stateOrCounty ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {u.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell max-w-[160px] truncate">
                      {u.tenantUsers?.map((tu) => tu.tenant?.name ?? tu.tenantId).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {u.userType === "CONSUMER" ? (
                        <div className="flex flex-col gap-1 items-start">
                          {consumerSubBadge(u.consumerProfile?.subscriptionStatus)}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 items-start">
                          {tenantPlanBadge(firm?.billingPlan ?? undefined)}
                          {firmSub?.status === "ACTIVE" &&
                            subscriptionStatusBadge(firmSub.status, firmSub.cancelAtPeriodEnd)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden xl:table-cell tabular-nums">
                      {u.userType === "CONSUMER" && u.consumerProfile?.aiCreditsRemaining != null
                        ? u.consumerProfile.aiCreditsRemaining.toLocaleString()
                        : firm?.aiCreditsRemaining != null
                          ? firm.aiCreditsRemaining.toLocaleString()
                          : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.isActive ? "default" : "secondary"} className="text-xs">
                        {u.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground text-sm">No users found.</div>
          )}
        </div>
      )}

      <AdminUserDetailSheet
        user={selectedUser}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUserUpdated={() => {
          loadUsers()
          setSelectedUser(null)
        }}
      />
    </div>
  )
}
