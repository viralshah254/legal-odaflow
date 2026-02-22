"use client"

import { useEffect } from "react"
import { useRole } from "@/lib/contexts/role-context"
import { hasMeetingPermission } from "@/lib/types/roles"
import { useUIStore } from "@/lib/store"
import { mockUsers } from "@/lib/mock/users"
import { getAllUrgentAlerts, getCriticalAlerts, getHighAlerts, mockAlerts } from "@/lib/mock/alerts"
import { getMissingKycDocs, getExpiredKycDocs, initializeKycForClient } from "@/lib/mock/kyc"
import { getPendingAssistanceRequests } from "@/lib/mock/assistance"
import { getClientById, mockClients } from "@/lib/mock/clients"
import { getTasksDueToday, getOverdueTasks, getTasksNext7Days } from "@/lib/mock/tasks"
import { getNext3Events } from "@/lib/mock/calendar"
import { getMattersByOwner, getMattersAtRisk, mockMatters } from "@/lib/mock/matters"
import { getCollectionsThisMonth, getOutstandingInvoices, getOverdueInvoices, getOriginatorStats, getInvoiceAging } from "@/lib/mock/finance"
import { UrgentAlertStrip } from "@/components/dashboard/urgent-alert-strip"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { TasksList } from "@/components/dashboard/tasks-list"
import { CalendarMini } from "@/components/dashboard/calendar-mini"
import { MattersTableMini } from "@/components/dashboard/matters-table-mini"
import { RoleGate } from "@/components/dashboard/role-gate"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Briefcase, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  TrendingUp,
  FileText,
  Plus,
  ArrowRight,
  Mic,
} from "lucide-react"
import Link from "next/link"
import { useCurrency } from "@/lib/contexts/currency-context"
import { formatCurrencyShort, formatCurrencyWithSymbol } from "@/lib/utils"
import { PlanGate } from "@/components/plan/plan-gate"

export default function DashboardPage() {
  const { currentRole, currentUser } = useRole()
  const { currency } = useCurrency()
  const setRecordMeetingOpen = useUIStore((s) => s.setRecordMeetingOpen)
  const user = currentUser || mockUsers.find((u) => u.role === currentRole) || mockUsers[0]

  const canRecordMeetings = hasMeetingPermission(currentRole, "meetingsRecord")
  
  // Initialize KYC for existing clients (one-time)
  useEffect(() => {
    mockClients.forEach((client) => {
      try {
        initializeKycForClient(client.id, client.type)
      } catch (e) {
        // Already initialized
      }
    })
  }, [])
  
  // Get role-scoped data
  const allAlerts = getAllUrgentAlerts()
  const userAlerts = allAlerts.filter((a) => a.assignedToId === user.id)
  
  // Add KYC alerts
  const missingKyc = getMissingKycDocs()
  const expiredKyc = getExpiredKycDocs()
  const kycAlerts = [
    ...missingKyc.map((item) => ({
      id: `kyc-missing-${item.clientId}`,
      title: "Missing KYC documents",
      description: `${item.clientName} has ${item.docs.length} missing KYC document${item.docs.length > 1 ? "s" : ""}`,
      severity: "High" as const,
      type: "KYC_MISSING" as const,
      clientId: item.clientId,
      clientName: item.clientName,
      createdAt: new Date(),
      acknowledged: false,
    })),
    ...expiredKyc.map((item) => ({
      id: `kyc-expired-${item.clientId}`,
      title: "Expired KYC documents",
      description: `${item.clientName} has ${item.docs.length} expired KYC document${item.docs.length > 1 ? "s" : ""}`,
      severity: "High" as const,
      type: "KYC_EXPIRED" as const,
      clientId: item.clientId,
      clientName: item.clientName,
      createdAt: new Date(),
      acknowledged: false,
    })),
  ]
  
  // Add assistance request alerts for partner/admin
  const pendingAssistance = currentRole === "PARTNER_ADMIN" ? getPendingAssistanceRequests() : []
  const assistanceAlerts = pendingAssistance.map((req) => ({
    id: `assist-${req.id}`,
    title: "Assistance request pending approval",
    description: `${req.requestedByName} requested assistance on ${req.matterTitle}`,
    severity: "Normal" as const,
    type: "ASSISTANCE_REQUEST" as const,
    matterId: req.matterId,
    matterTitle: req.matterTitle,
    assistanceRequestId: req.id,
    createdAt: req.requestedAt,
    acknowledged: false,
  }))
  
  const alertsToShow = currentRole === "PARTNER_ADMIN" 
    ? [...allAlerts, ...kycAlerts, ...assistanceAlerts]
    : [...userAlerts, ...kycAlerts.filter((a) => {
        // Show KYC alerts for user's clients/matters
        const client = getClientById(a.clientId || "")
        return client // In real app, check if user has access
      })]
  
  const userTasksDueToday = getTasksDueToday().filter((t) => t.assignedToId === user.id)
  const userOverdueTasks = getOverdueTasks().filter((t) => t.assignedToId === user.id)
  const userTasksNext7Days = getTasksNext7Days().filter((t) => t.assignedToId === user.id)
  
  const userEvents = getNext3Events().filter((e) => e.attendeeIds.includes(user.id))
  
  const userMatters = getMattersByOwner(user.id)
  const allMatters = mockMatters
  const mattersAtRisk = getMattersAtRisk()
  
  // Finance data
  const collectionsThisMonth = getCollectionsThisMonth()
  const outstandingInvoices = getOutstandingInvoices()
  const overdueInvoices = getOverdueInvoices()
  const originatorStats = getOriginatorStats()
  const invoiceAging = getInvoiceAging()

  return (
    <div className="space-y-6 p-6">
      {/* Urgent Alerts Strip */}
      <div>
        <UrgentAlertStrip alerts={alertsToShow} showAssignee={currentRole === "PARTNER_ADMIN"} />
      </div>

      {/* Role-Specific Dashboard Content */}
      {currentRole === "PARTNER_ADMIN" && (
        <>
          {/* Firm KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={Briefcase}
              label="Active Matters"
              value={allMatters.length}
              delta={{ value: 12, positive: true }}
            />
            <KpiCard
              icon={AlertTriangle}
              label="Overdue Critical Deadlines"
              value={mattersAtRisk.filter((m) => m.risk === "Critical").length}
            />
            <KpiCard
              icon={CheckCircle2}
              label="Tasks Overdue"
              value={getOverdueTasks().length}
            />
            <KpiCard
              icon={DollarSign}
              label="Outstanding Invoices"
              value={formatCurrencyShort(outstandingInvoices.reduce((sum, inv) => sum + inv.amount, 0), currency)}
            />
          </div>

          {/* Team Workload & Monitoring - Available in Professional */}
          <PlanGate
            requiredPlan="PROFESSIONAL"
            feature="Team Analytics"
            description="Monitor team performance and workload with the Professional plan"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Team Workload & Monitoring</CardTitle>
                  <Link href="/app/team">
                    <Button variant="outline" size="sm">
                      View All <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Team monitoring table would be displayed here. See /app/team for full view.</p>
              </CardContent>
            </Card>
          </PlanGate>

          {/* Finance Performance - Advanced Reporting Features */}
          <PlanGate
            requiredPlan="PROFESSIONAL"
            feature="Advanced Reporting"
            description="Get detailed analytics and insights with the Professional plan"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Top Originators</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {originatorStats.slice(0, 5).map((stat, index) => (
                      <div key={stat.userId} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{stat.userName}</div>
                            <div className="text-xs text-muted-foreground">{stat.invoiceCount} invoices</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrencyShort(stat.collectedAmount, currency)}</div>
                          <div className="text-xs text-muted-foreground">Collected</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Collections This Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">{formatCurrencyShort(collectionsThisMonth, currency)}</div>
                  <p className="text-sm text-muted-foreground">Total collections this month</p>
                </CardContent>
              </Card>
            </div>
          </PlanGate>

          {/* Urgent Watchlist */}
          <Card>
            <CardHeader>
              <CardTitle>Urgent Watchlist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mattersAtRisk.slice(0, 5).map((matter) => (
                  <div key={matter.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <div>
                      <div className="font-medium text-sm">{matter.title}</div>
                      <div className="text-xs text-muted-foreground">{matter.clientName}</div>
                    </div>
                    <Badge variant={matter.risk === "Critical" ? "destructive" : "outline"}>
                      {matter.risk}
                    </Badge>
                  </div>
                ))}
                {pendingAssistance.length > 0 && (
                  <div className="pt-3 border-t">
                    <div className="text-sm font-medium mb-2">Pending Assistance Approvals</div>
                    {pendingAssistance.slice(0, 3).map((req) => (
                      <div key={req.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 mb-2">
                        <div className="text-xs">
                          <div className="font-medium">{req.requestedByName}</div>
                          <div className="text-muted-foreground">{req.matterTitle}</div>
                        </div>
                        <Badge variant="secondary">{req.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {currentRole === "FINANCE" && (
        <>
          {/* Finance KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={DollarSign}
              label="Collections This Month"
              value={formatCurrencyShort(collectionsThisMonth, currency)}
              delta={{ value: 15, positive: true }}
            />
            <KpiCard
              icon={TrendingUp}
              label="Outstanding Invoices"
              value={formatCurrencyShort(outstandingInvoices.reduce((sum, inv) => sum + inv.amount, 0), currency)}
            />
            <KpiCard
              icon={AlertTriangle}
              label="Overdue Invoices"
              value={overdueInvoices.length}
            />
            <KpiCard
              icon={FileText}
              label="Total Invoices"
              value={outstandingInvoices.length}
            />
          </div>

          {/* Top Originators - Advanced Reporting Feature */}
          <PlanGate
            requiredPlan="PROFESSIONAL"
            feature="Advanced Reporting"
            description="Get detailed analytics and insights with the Professional plan"
          >
            <Card>
              <CardHeader>
                <CardTitle>Top Originators</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {originatorStats.slice(0, 5).map((stat, index) => (
                    <div key={stat.userId} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{stat.userName}</div>
                          <div className="text-xs text-muted-foreground">{stat.invoiceCount} invoices</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{formatCurrencyShort(stat.collectedAmount, currency)}</div>
                        <div className="text-xs text-muted-foreground">Collected</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </PlanGate>

          {/* Invoice Aging - Advanced Reporting Feature */}
          <PlanGate
            requiredPlan="PROFESSIONAL"
            feature="Invoice Aging Analysis"
            description="View detailed invoice aging breakdown with the Professional plan"
          >
            <Card>
              <CardHeader>
                <CardTitle>Invoice Aging</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <span className="text-sm font-medium">Current</span>
                    <span className="font-bold">{formatCurrencyShort(invoiceAging.current, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <span className="text-sm font-medium">1-30 Days</span>
                    <span className="font-bold">{formatCurrencyShort(invoiceAging.days30, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <span className="text-sm font-medium">31-60 Days</span>
                    <span className="font-bold">{formatCurrencyShort(invoiceAging.days60, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <span className="text-sm font-medium">61-90 Days</span>
                    <span className="font-bold">{formatCurrencyShort(invoiceAging.days90, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                    <span className="text-sm font-medium">Over 90 Days</span>
                    <span className="font-bold text-red-600 dark:text-red-400">{formatCurrencyShort(invoiceAging.over90, currency)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PlanGate>
        </>
      )}

      {/* Common Panels for All Roles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TasksList
            tasksDueToday={userTasksDueToday}
            overdueTasks={userOverdueTasks}
            tasksNext7Days={userTasksNext7Days}
          />
        </div>
        <div className="space-y-6">
          <CalendarMini events={userEvents} />
          <MattersTableMini matters={userMatters.slice(0, 5)} showOwner={currentRole === "PARTNER_ADMIN"} />
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "INTAKE"]}>
              <Link href="/app/matters/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Matter
                </Button>
              </Link>
            </RoleGate>
            <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE"]}>
              <Link href="/app/tasks/new">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Task
                </Button>
              </Link>
            </RoleGate>
            <RoleGate allowedRoles={["PARTNER_ADMIN", "FINANCE"]}>
              <Link href="/app/accounting/invoices/new">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Invoice
                </Button>
              </Link>
            </RoleGate>
            <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER", "ASSOCIATE", "INTAKE"]}>
              <Link href="/app/clients/new">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Client
                </Button>
              </Link>
            </RoleGate>
            {canRecordMeetings && (
              <Button variant="outline" onClick={() => setRecordMeetingOpen(true)}>
                <Mic className="mr-2 h-4 w-4" />
                Record meeting
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

