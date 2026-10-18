"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  CreditCard,
  Loader2,
  UserPlus,
  ExternalLink,
  TrendingUp,
  Users,
  CalendarDays,
  Zap,
  Bot,
  Sparkles,
  ArrowUpRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RoleGate } from "@/components/dashboard/role-gate"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useAuth } from "@/lib/contexts/auth-context"
import { listTenantUsers, type ApiTenantUser, type SeatPlan } from "@/lib/api/users"
import { getCurrentBilling, openBillingPortal } from "@/lib/api/billing"
import { ChangeSeatPlanDialog, SEAT_PLANS } from "@/components/settings/change-seat-plan-dialog"
import { mapTenantRoleToUserRole } from "@/lib/auth/role-mapper"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const PLAN_MONTHLY_USD: Record<string, number> = {
  STARTER: 25,
  PROFESSIONAL: 100,
  PRO_PLUS: 500,
}

const PLAN_BADGE: Record<string, string> = {
  STARTER: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  PROFESSIONAL: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  PRO_PLUS: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  STARTER: <Zap className="h-3 w-3" />,
  PROFESSIONAL: <Bot className="h-3 w-3" />,
  PRO_PLUS: <Sparkles className="h-3 w-3" />,
}

const ROLE_DISPLAY: Record<string, string> = {
  FIRM_ADMIN: "Partner (Admin)",
  PARTNER: "Junior Partner",
  ASSOCIATE: "Associate",
  FINANCE: "Finance",
  INTAKE: "Intake",
}

function SeatPlanBadge({ plan }: { plan: string }) {
  const label = SEAT_PLANS.find((p) => p.id === plan)?.label ?? plan
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
      PLAN_BADGE[plan] ?? PLAN_BADGE.STARTER
    )}>
      {PLAN_ICONS[plan] ?? <Zap className="h-3 w-3" />}
      {label}
    </span>
  )
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function BillingSettingsPage() {
  const { activeTenantId } = useTenant()
  const { user: authUser } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [changePlanOpen, setChangePlanOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<ApiTenantUser | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const { data: tenantUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["tenant-users", activeTenantId],
    queryFn: () => listTenantUsers(activeTenantId!),
    enabled: !!activeTenantId,
  })

  const { data: billing, isLoading: billingLoading } = useQuery({
    queryKey: ["billing-current", activeTenantId],
    queryFn: () => getCurrentBilling(activeTenantId ?? undefined),
    enabled: !!activeTenantId,
    retry: false,
  })

  const isLoading = usersLoading || billingLoading

  // Compute per-seat cost breakdown
  const totalMonthly = tenantUsers.reduce((sum, u) => {
    const plan = (u.seatPlan ?? "STARTER") as string
    return sum + (PLAN_MONTHLY_USD[plan] ?? 25)
  }, 0)

  const planCounts = tenantUsers.reduce<Record<string, number>>((acc, u) => {
    const plan = u.seatPlan ?? "STARTER"
    acc[plan] = (acc[plan] ?? 0) + 1
    return acc
  }, {})

  const handleOpenPortal = async () => {
    if (!activeTenantId) return
    setPortalLoading(true)
    try {
      const result = await openBillingPortal(activeTenantId)
      if (result?.url) window.location.href = result.url
    } catch {
      toast({ title: "Could not open billing portal", variant: "destructive" })
    } finally {
      setPortalLoading(false)
    }
  }

  if (!activeTenantId) return null

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
      <div className="p-6 space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/app/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CreditCard className="h-8 w-8 text-primary" />
              Billing & Seats
            </h1>
            <p className="text-muted-foreground">
              Per-seat billing — each team member has their own plan
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleOpenPortal}
            disabled={portalLoading || !billing?.canManageInPortal}
          >
            {portalLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            Manage Billing
          </Button>
          <Link href="/app/settings/users">
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Seat
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Total seats</span>
                  </div>
                  <div className="text-3xl font-bold">{tenantUsers.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Monthly total</span>
                  </div>
                  <div className="text-3xl font-bold">${totalMonthly.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Next billing</span>
                  </div>
                  <div className="text-lg font-bold">{formatDate(billing?.currentPeriodEnd ?? null)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Subscription</span>
                  </div>
                  <div className="text-sm font-semibold capitalize">
                    {billing?.subscriptionStatus ?? "—"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Plan distribution */}
            {Object.keys(planCounts).length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Plan distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {SEAT_PLANS.map((plan) => {
                      const count = planCounts[plan.id] ?? 0
                      if (count === 0) return null
                      return (
                        <div key={plan.id} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                          <SeatPlanBadge plan={plan.id} />
                          <span className="font-bold text-gray-900 dark:text-white">{count}</span>
                          <span className="text-sm text-muted-foreground">× ${plan.monthlyUsd}/mo</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">= ${count * plan.monthlyUsd}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Per-seat table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Seat breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y dark:divide-gray-800">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-gray-50 dark:bg-gray-800/50">
                    <span>Member</span>
                    <span>Role</span>
                    <span>Plan</span>
                    <span>Monthly</span>
                    <span></span>
                  </div>
                  {tenantUsers.map((tu) => {
                    const displayName = tu.user.name ?? "User"
                    const role = tu.role
                    const seatPlan = (tu.seatPlan ?? "STARTER") as SeatPlan
                    const monthly = PLAN_MONTHLY_USD[seatPlan] ?? 25
                    const isSelf = authUser?.id === tu.userId

                    return (
                      <div key={tu.userId} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white text-sm truncate">{displayName}</span>
                            {isSelf && <Badge variant="secondary" className="text-[10px] shrink-0">You</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{tu.user.email}</p>
                          {tu.displayTitle && (
                            <p className="text-xs text-muted-foreground">{tu.displayTitle}</p>
                          )}
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">
                            {ROLE_DISPLAY[role] ?? role}
                          </span>
                        </div>
                        <div>
                          <SeatPlanBadge plan={seatPlan} />
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          ${monthly}/mo
                        </div>
                        <div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => {
                              setSelectedUser(tu)
                              setChangePlanOpen(true)
                            }}
                          >
                            <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                            Change
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Total footer */}
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-3.5 border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {tenantUsers.length} seat{tenantUsers.length !== 1 ? "s" : ""} total
                  </div>
                  <div />
                  <div />
                  <div className="text-sm font-bold text-gray-900 dark:text-white">${totalMonthly}/mo</div>
                  <div />
                </div>
              </CardContent>
            </Card>

            {/* Quick links */}
            <div className="flex flex-wrap gap-3">
              <Link href="/app/settings/plan-usage">
                <Button variant="outline" size="sm">
                  <Zap className="mr-2 h-3.5 w-3.5" />
                  AI Credits & Usage
                </Button>
              </Link>
              <Link href="/app/settings/users">
                <Button variant="outline" size="sm">
                  <Users className="mr-2 h-3.5 w-3.5" />
                  Manage Users & Roles
                </Button>
              </Link>
              {billing?.canManageInPortal && (
                <Button variant="outline" size="sm" onClick={handleOpenPortal} disabled={portalLoading}>
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  Stripe Billing Portal
                </Button>
              )}
            </div>
          </>
        )}

        {/* Change plan dialog */}
        {selectedUser && (
          <ChangeSeatPlanDialog
            open={changePlanOpen}
            onOpenChange={(v) => { setChangePlanOpen(v); if (!v) setSelectedUser(null) }}
            tenantId={activeTenantId}
            userId={selectedUser.userId}
            userName={selectedUser.user.name ?? "User"}
            currentPlan={(selectedUser.seatPlan ?? "STARTER") as SeatPlan}
            onSuccess={(newPlan, proRataAmount) => {
              void queryClient.invalidateQueries({ queryKey: ["tenant-users", activeTenantId] })
              toast({
                title: "Seat plan updated",
                description: proRataAmount > 0
                  ? `Pro-rated charge of $${proRataAmount} will be applied for the remainder of this cycle.`
                  : "Plan downgrade takes effect at the next billing cycle.",
              })
            }}
          />
        )}
      </div>
    </RoleGate>
  )
}
