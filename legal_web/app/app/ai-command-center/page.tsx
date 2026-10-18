"use client"
import { useTranslations } from "next-intl"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RoleGate } from "@/components/dashboard/role-gate"
import { PageSkeleton, CardGridSkeleton } from "@/components/ui/page-skeleton"
import { ErrorState } from "@/components/ui/error-state"
import { PageEnter, StaggerList } from "@/components/ui/motion"
import { getCommandCenterSummary, type CommandCenterSummary } from "@/lib/api/ai"
import { ApiClientError } from "@/lib/api/client"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useRealtimeEvent } from "@/lib/contexts/realtime-context"
import { REALTIME_EVENTS } from "@/lib/realtime/events"
import { PageCopilotActions } from "@/components/copilot/page-copilot-actions"
import {
  AlertTriangle,
  Bot,
  Clock,
  CreditCard,
  FileSearch,
  FileText,
  Gavel,
  RefreshCw,
  Scale,
  Sparkles,
  Timer,
  Users,
} from "lucide-react"

interface CommandCard {
  key: keyof CommandCenterSummary
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  format?: (value: number) => string
  href?: string
}

const CARDS: CommandCard[] = [
  {
    key: "newConsumerLeads",
    title: "New consumer leads",
    description: "Issue-checker leads awaiting firm follow-up",
    icon: Users,
    href: "/app/leads",
  },
  {
    key: "aiDraftsAwaitingReview",
    title: "AI drafts awaiting review",
    description: "Copilot drafts pending lawyer approval",
    icon: FileText,
    href: "/app/ai-review",
  },
  {
    key: "highRiskMatters",
    title: "High-risk matters",
    description: "Matters flagged by AI risk scoring",
    icon: AlertTriangle,
    href: "/app/matters",
  },
  {
    key: "documentsNeedingClassification",
    title: "Documents needing classification",
    description: "Uploaded docs without matter type tags",
    icon: FileSearch,
    href: "/app/documents",
  },
  {
    key: "missedUrgentDeadlines",
    title: "Missed / urgent deadlines",
    description: "Calendar events requiring immediate action",
    icon: Clock,
    href: "/app/calendar",
  },
  {
    key: "suggestedTimeEntries",
    title: "Suggested time entries",
    description: "AI-suggested billable time from activity",
    icon: Timer,
    href: "/app/time",
  },
  {
    key: "researchMemosGenerated",
    title: "Research memos generated",
    description: "Research outputs this period",
    icon: Scale,
    href: "/app/research",
  },
  {
    key: "opponentFilingsNeedingResponse",
    title: "Opponent filings needing response",
    description: "Filings flagged for response drafting",
    icon: Gavel,
    href: "/app/matters",
  },
  {
    key: "aiCreditsUsed",
    title: "AI credit usage",
    description: "Credits consumed this billing cycle",
    icon: CreditCard,
    href: "/app/settings/plan-usage",
  },
]

function formatCardValue(
  card: CommandCard,
  summary: CommandCenterSummary,
): string {
  const value = summary[card.key]
  if (typeof value !== "number") return "—"
  if (card.key === "aiCreditsUsed") {
    return `${value} / ${summary.aiCreditsIncluded ?? "—"}`
  }
  if (card.format) return card.format(value)
  return value.toLocaleString()
}

export default function AiCommandCenterPage() {
  const toFixed = useTranslations("lawyer")
  const t = useTranslations("lawyer")
  const tCopilot = useTranslations("copilot")
  const { activeTenantId } = useTenant()
  const [summary, setSummary] = useState<CommandCenterSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getCommandCenterSummary(activeTenantId ?? undefined)
      setSummary(data)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load command center")
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [activeTenantId])

  useRealtimeEvent(REALTIME_EVENTS.DASHBOARD_METRICS_UPDATED, () => {
    void load()
  })

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN", "JUNIOR_PARTNER"]}>
      <PageEnter className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap" data-tour="command-center-header">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bot className="h-7 w-7 text-primary" />
              <h1 className="text-3xl font-bold">{t("ai_command_center")}</h1>
            </div>
            <p className="text-muted-foreground">
              Operational dashboard for AI workload, risk, and spend
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/app/intake">
              <Button variant="secondary">
                <Scale className="mr-2 h-4 w-4" />
                Client intake
              </Button>
            </Link>
            <PageCopilotActions label={tCopilot("askCopilot")} />
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {loading && !summary && <CardGridSkeleton count={10} />}

        {error && !summary && (
          <ErrorState message={error} onRetry={() => void load()} />
        )}

        {summary && (
          <>
            {summary.providerHealth && (
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t("provider")}</span>
                <Badge variant={summary.providerHealth.status === "ok" ? "default" : "secondary"}>
                  {summary.providerHealth.status}
                  {summary.providerHealth.provider ? ` · ${summary.providerHealth.provider}` : ""}
                </Badge>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-4" data-tour="command-center-cards">
              {[
                {
                  label: "Spend this month",
                  value: `$${summary.aiCostThisMonthUsd.toFixed(2)}`,
                  helper: "Track gross model cost",
                },
                {
                  label: "Review queue",
                  value: summary.aiDraftsAwaitingReview.toLocaleString(),
                  helper: "Drafts need lawyer approval",
                },
                {
                  label: "Workflow pressure",
                  value: (
                    summary.opponentFilingsNeedingResponse +
                    summary.documentsNeedingClassification +
                    summary.missedUrgentDeadlines
                  ).toLocaleString(),
                  helper: "Operational AI follow-ups",
                },
                {
                  label: "Audit posture",
                  value: summary.providerHealth?.status === "ok" ? "Healthy" : "Check",
                  helper: "Provider, logs, and guardrails",
                },
              ].map((item) => (
                <Card key={item.label}>
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-xl font-bold">{item.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.helper}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {CARDS.map((card) => {
                const Icon = card.icon
                const content = (
                  <Card className="h-full shadow-token-sm hover:shadow-token-md transition-shadow duration-normal">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <CardDescription className="text-xs">{card.title}</CardDescription>
                      </div>
                      <CardTitle className="text-2xl">
                        {formatCardValue(card, summary)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">{card.description}</p>
                    </CardContent>
                  </Card>
                )
                return card.href ? (
                  <Link key={card.key} href={card.href} className="block">
                    {content}
                  </Link>
                ) : (
                  <div key={card.key}>{content}</div>
                )
              })}
            </StaggerList>
          </>
        )}
      </PageEnter>
    </RoleGate>
  )
}
