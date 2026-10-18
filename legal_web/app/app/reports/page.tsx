"use client"
import { useTranslations } from "next-intl"

import { useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { PlanGate } from "@/components/plan/plan-gate"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getFirmReports } from "@/lib/api/analytics"
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle,
  FileText,
  Users,
  Scale,
} from "lucide-react"

// Industry benchmarks (Clio 2025 Report)
const BENCHMARKS = {
  utilizationRate: { target: 60, average: 38 },
  billingRealization: { target: 90, average: 88 },
  collectionRate: { target: 95, average: 93 },
  lockupDays: { target: 60, average: 93 },
}

function KpiCard({
  title,
  value,
  unit,
  benchmark,
  higherIsBetter = true,
  description,
  icon: Icon,
}: {
  title: string
  value: number | null
  unit?: string
  benchmark?: { target: number; average: number }
  higherIsBetter?: boolean
  description?: string
  icon?: React.ElementType
}) {
  const displayValue = value === null ? "—" : `${value.toFixed(0)}${unit ?? ""}`

  const isGood =
    value === null
      ? null
      : higherIsBetter
        ? value >= (benchmark?.target ?? 0)
        : value <= (benchmark?.target ?? Infinity)

  const isAverage =
    value !== null &&
    (higherIsBetter
      ? value >= (benchmark?.average ?? 0) && value < (benchmark?.target ?? 0)
      : value <= (benchmark?.average ?? Infinity) && value > (benchmark?.target ?? 0))

  const progressValue =
    value !== null && benchmark
      ? higherIsBetter
        ? Math.min((value / benchmark.target) * 100, 100)
        : Math.max(100 - ((value - benchmark.target) / benchmark.target) * 100, 0)
      : undefined

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-3xl font-bold">{displayValue}</p>
              {isGood === true && <TrendingUp className="h-5 w-5 text-green-500" />}
              {isGood === false && !isAverage && <TrendingDown className="h-5 w-5 text-red-500" />}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
            {benchmark && value !== null && (
              <div className="mt-3 space-y-1">
                {progressValue !== undefined && (
                  <Progress
                    value={progressValue}
                    className="h-1.5"
                  />
                )}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Industry avg: {benchmark.average}{unit}</span>
                  <span>Target: {benchmark.target}{unit}</span>
                </div>
              </div>
            )}
          </div>
          {Icon && (
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 ml-4">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function MetricRow({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-2 text-sm border-b last:border-0 ${highlight ? "font-medium" : ""}`}>
      <span className={highlight ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export default function ReportsPage() {
  const toFixed = useTranslations("lawyer")
  const t = useTranslations("lawyer")
  const tDashboard = useTranslations("dashboard")
  const { activeTenantId, isLoading: tenantLoading } = useTenant()
  const { data, isLoading: reportsLoading, error } = useApiData(
    ["firm-reports", activeTenantId],
    {
      apiFn: () => getFirmReports(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  const isLoading = tenantLoading || !activeTenantId || reportsLoading

  const totalInvoices = useMemo(() => {
    if (!data) return 0
    const a = data.invoiceAging
    return a.current + a.days1to30 + a.days31to60 + a.days61to90 + a.days90plus
  }, [data])

  const overdueCount = useMemo(() => {
    if (!data) return 0
    const a = data.invoiceAging
    return a.days1to30 + a.days31to60 + a.days61to90 + a.days90plus
  }, [data])


  return (
    <PlanGate
      requiredPlan="PROFESSIONAL"
      feature="Advanced Reports & Analytics"
      description={tDashboard("planFirmAnalyticsDescription")}
    >
      <div className="p-6 space-y-6 max-w-6xl">
        <div className="flex items-center justify-between" data-tour="reports-header">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              Firm Analytics
            </h1>
            <p className="text-muted-foreground">{t("kpis_pipeline_and_operational_health")}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/app/finance">
              <Button variant="outline" size="sm">
                <DollarSign className="h-4 w-4 mr-2" />
                Finance
              </Button>
            </Link>
            <Link href="/app/trust">
              <Button variant="outline" size="sm">
                <Scale className="h-4 w-4 mr-2" />
                Trust
              </Button>
            </Link>
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <Card className="border-destructive">
            <CardContent className="p-4 flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              Failed to load reports. Please try again.
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="space-y-6">
            {/* KPI Hero Row */}
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Firm KPIs
                <Badge variant="outline" className="text-xs font-normal">
                  Benchmarks: Clio 2025
                </Badge>
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="reports-kpis">
                <KpiCard
                  title={t("utilization_rate")}
                  value={null}
                  unit="%"
                  benchmark={BENCHMARKS.utilizationRate}
                  description={t("kpi_utilization_formula")}
                  icon={Clock}
                />
                <KpiCard
                  title={t("billing_realization")}
                  value={null}
                  unit="%"
                  benchmark={BENCHMARKS.billingRealization}
                  description={t("kpi_billing_realization_formula")}
                  icon={FileText}
                />
                <KpiCard
                  title={t("collection_rate")}
                  value={null}
                  unit="%"
                  benchmark={BENCHMARKS.collectionRate}
                  description={t("kpi_collection_rate_formula")}
                  icon={DollarSign}
                />
                <KpiCard
                  title={t("total_lockup")}
                  value={null}
                  unit=" days"
                  higherIsBetter={false}
                  benchmark={BENCHMARKS.lockupDays}
                  description={t("kpi_lockup_formula")}
                  icon={TrendingDown}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {t("kpi_calculations_require_time_tracking")}
              </p>
            </div>

            {/* Matter Pipeline + Invoice Aging */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-primary" />
                    Matter Pipeline
                    <Badge variant="outline" className="ml-auto">{data.matterPipelineTotal}</Badge>
                  </CardTitle>
                  <CardDescription>{t("active_matters_by_stage_and_status")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.matterPipeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">{t("no_open_matters")}</p>
                  ) : (
                    <div className="space-y-0">
                      {data.matterPipeline.slice(0, 8).map((row, i) => (
                        <MetricRow
                          key={i}
                          label={`${row.stage ?? "—"} / ${row.status}`}
                          value={row.count}
                        />
                      ))}
                    </div>
                  )}
                  <Link href="/app/matters">
                    <Button variant="ghost" size="sm" className="mt-3 w-full">
                      View all matters →
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Invoice Aging
                  </CardTitle>
                  <CardDescription>
                    {overdueCount} overdue of {totalInvoices} total
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-0">
                    <MetricRow label={t("current")} value={data.invoiceAging.current} />
                    <MetricRow
                      label={t("130_days_overdue")}
                      value={data.invoiceAging.days1to30}
                      highlight={data.invoiceAging.days1to30 > 0}
                    />
                    <MetricRow
                      label={t("3160_days_overdue")}
                      value={data.invoiceAging.days31to60}
                      highlight={data.invoiceAging.days31to60 > 0}
                    />
                    <MetricRow
                      label={t("6190_days_overdue")}
                      value={data.invoiceAging.days61to90}
                      highlight={data.invoiceAging.days61to90 > 0}
                    />
                    <div className={`flex justify-between items-center py-2 text-sm ${data.invoiceAging.days90plus > 0 ? "text-destructive font-medium" : ""}`}>
                      <span>{t("90_days_critical")}</span>
                      <span>{data.invoiceAging.days90plus}</span>
                    </div>
                  </div>
                  <Link href="/app/finance">
                    <Button variant="ghost" size="sm" className="mt-3 w-full">
                      Manage invoices →
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* Trust Summary + Overdue Tasks */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Trust Summary
                  </CardTitle>
                  <CardDescription>{t("client_money_accounts")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-0">
                    <MetricRow
                      label={t("total_balance")}
                      value={data.trustSummary.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      highlight
                    />
                    <MetricRow label={t("active_accounts")} value={data.trustSummary.accountCount} />
                    <div className="flex justify-between items-center py-2 text-sm border-b last:border-0">
                      <span className="text-muted-foreground">{t("pending_approvals")}</span>
                      <Badge variant={data.trustSummary.pendingApprovals > 0 ? "destructive" : "secondary"}>
                        {data.trustSummary.pendingApprovals}
                      </Badge>
                    </div>
                  </div>
                  <Link href="/app/trust">
                    <Button variant="ghost" size="sm" className="mt-3 w-full">
                      Manage trust →
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Overdue Tasks by Owner
                  </CardTitle>
                  <CardDescription>{t("tasks_past_due_date_by_assignee")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.overdueTasksByOwner.length === 0 ? (
                    <div className="flex items-center gap-2 text-green-600 py-4">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">{tDashboard("tasks.noOverdueTasks")}</span>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {data.overdueTasksByOwner.map((row) => (
                        <div key={row.ownerId} className="flex justify-between items-center py-2 text-sm border-b last:border-0">
                          <span className="text-muted-foreground">{row.ownerName}</span>
                          <Badge variant={row.count > 5 ? "destructive" : "outline"}>
                            {row.count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <Link href="/app/tasks">
                    <Button variant="ghost" size="sm" className="mt-3 w-full">
                      View all tasks →
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* Outcome Analyses */}
            {data.outcomeAnalysesPendingReview > 0 && (
              <Card className="border-amber-200 dark:border-amber-800">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="font-medium">
                        {data.outcomeAnalysesPendingReview} matter outcome analysis pending review
                      </p>
                      <p className="text-sm text-muted-foreground">
                        AI-generated analyses awaiting lawyer approval before sharing with clients
                      </p>
                    </div>
                  </div>
                  <Link href="/app/matters">
                    <Button variant="outline" size="sm">{t("review")}</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Firm outcome benchmarks dashboard — shown once a backend aggregation
                endpoint supplies approved win/settlement rates from outcome analyses */}
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground space-y-2">
                <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="font-medium">Outcome benchmarks not yet available</p>
                <p className="text-xs max-w-xs mx-auto">
                  Win rate and settlement rate benchmarks will appear here once matters
                  are closed and outcome analyses are approved by a partner.
                </p>
                <Link href="/app/matters">
                  <Button variant="outline" size="sm" className="mt-2">View matters</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Practice-area outcome analytics */}
            {data.practiceAreaBreakdown && data.practiceAreaBreakdown.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Practice Area Outcomes
                  </CardTitle>
                  <CardDescription>{t("matter_volume_and_average_cycle_time_by_practice_area")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.practiceAreaBreakdown
                      .sort((a, b) => (b.open + b.closed) - (a.open + a.closed))
                      .slice(0, 10)
                      .map((row) => {
                        const total = row.open + row.closed
                        const closedPct = total > 0 ? Math.round((row.closed / total) * 100) : 0
                        return (
                          <div key={row.practiceArea} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium capitalize">{row.practiceArea.replace(/_/g, " ")}</span>
                              <div className="flex items-center gap-3 text-muted-foreground">
                                <span>{total} matters</span>
                                {row.avgCycleDays !== null && (
                                  <span>~{row.avgCycleDays}d avg cycle</span>
                                )}
                                <span className="text-green-600 dark:text-green-400">{closedPct}% closed</span>
                              </div>
                            </div>
                            <Progress value={closedPct} className="h-1.5" />
                          </div>
                        )
                      })}
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        )}
      </div>
    </PlanGate>
  )
}
