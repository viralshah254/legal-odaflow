"use client"
import { useTranslations } from "next-intl"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { LeadStatusBadge } from "@/components/leads/lead-status-badge"
import {
  listPipelineLeads,
  updateIntakeStage,
  type IntakeStage,
  type LawyerLead,
} from "@/lib/api/marketplace"
import { getLeadDisplayTitle } from "@/lib/leads/lead-display-title"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useRealtimeEvent } from "@/lib/contexts/realtime-context"
import { REALTIME_EVENTS } from "@/lib/realtime/events"
import { USER_CONNECTION_ERROR, toUserFacingErrorMessage } from "@/lib/errors/user-facing-messages"
import { formatDate } from "@/lib/utils"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { AlertTriangle, CheckCircle2, FolderOpen, Inbox, Plus, Search } from "lucide-react"

const PIPELINE_STAGES: { id: IntakeStage; label: string }[] = [
  { id: "NEW", label: "New" },
  { id: "SCREENING", label: "Screening" },
  { id: "CONSULT", label: "Consult" },
  { id: "ENGAGED", label: "Engaged" },
]

function urgencyVariant(urgency: string) {
  if (urgency === "HIGH" || urgency === "CRITICAL") return "text-destructive"
  if (urgency === "MEDIUM") return "text-amber-600 dark:text-amber-400"
  return "text-muted-foreground"
}

function leadTitle(lead: LawyerLead) {
  return getLeadDisplayTitle(lead)
}

function tenantLoadErrorMessage(error: Error | null): string {
  const msg = error?.message ?? ""
  if (msg.includes("500") || msg.includes("Internal Server Error")) {
    return USER_CONNECTION_ERROR
  }
  return toUserFacingErrorMessage(msg, "Could not load your firm workspace.")
}

export default function LeadsPage() {
  const t = useTranslations("lawyer")
  const router = useRouter()
  const {
    activeTenantId,
    isLoading: tenantLoading,
    isError: tenantError,
    error: tenantLoadError,
    refreshTenants,
  } = useTenant()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [movingId, setMovingId] = useState<string | null>(null)

  const { data: leads = [], isLoading, error, refetch } = useApiData<LawyerLead[]>(
    ["leads-pipeline", activeTenantId],
    {
      apiFn: () => listPipelineLeads(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  useRealtimeEvent(REALTIME_EVENTS.LEAD_CREATED, () => refetch())
  useRealtimeEvent(REALTIME_EVENTS.LEAD_UPDATED, () => refetch())

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return leads
    return leads.filter(
      (lead) =>
        lead.summary?.toLowerCase().includes(q) ||
        lead.issueType.toLowerCase().includes(q) ||
        lead.jurisdiction?.toLowerCase().includes(q),
    )
  }, [leads, searchQuery])

  const byStage = useMemo(() => {
    const map: Record<IntakeStage, LawyerLead[]> = {
      NEW: [],
      SCREENING: [],
      CONSULT: [],
      ENGAGED: [],
      CONVERTED: [],
    }
    for (const lead of filtered) {
      const stage = (lead.intakeStage ?? "NEW") as IntakeStage
      if (map[stage]) {
        map[stage].push(lead)
      } else {
        map.NEW.push(lead)
      }
    }
    return map
  }, [filtered])

  const pipelineStats = useMemo(() => {
    const highUrgency = leads.filter((lead) =>
      ["HIGH", "URGENT", "CRITICAL"].includes(lead.urgency),
    ).length
    const readyToConvert = leads.filter((lead) => lead.intakeStage === "ENGAGED").length
    const converted = leads.filter((lead) => lead.status === "CONVERTED").length
    return [
      { label: "Open leads", value: leads.length, icon: Inbox },
      { label: "High urgency", value: highUrgency, icon: AlertTriangle },
      { label: "Ready to convert", value: readyToConvert, icon: CheckCircle2 },
      { label: "Converted", value: converted, icon: FolderOpen },
    ]
  }, [leads])

  const handleMoveStage = async (leadId: string, intakeStage: IntakeStage) => {
    setMovingId(leadId)
    try {
      await updateIntakeStage(leadId, intakeStage)
      await queryClient.invalidateQueries({ queryKey: ["leads-pipeline", activeTenantId] })
    } finally {
      setMovingId(null)
    }
  }

  if (tenantError) {
    return (
      <ErrorState
        title={t("could_not_load_firm_workspace")}
        message={tenantLoadErrorMessage(tenantLoadError)}
        onRetry={() => void refreshTenants()}
      />
    )
  }

  if (!activeTenantId) {
    if (tenantLoading) return <PageSkeleton rows={6} />
    return (
      <ErrorState
        title={t("no_firm_workspace")}
        message="Your account is not linked to an active firm tenant."
        onRetry={() => void refreshTenants()}
      />
    )
  }

  if (isLoading) return <PageSkeleton rows={6} />
  if (error) {
    return (
      <ErrorState
        title={t("could_not_load_leads")}
        message={error.message}
        onRetry={() => refetch()}
      />
    )
  }

  return (
    <div className="space-y-6" data-tour="leads-inbox">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Inbox className="h-6 w-6" />
            Client intake pipeline
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Kanban by intake stage — move leads from new through engaged.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/app/consumer-reports/review-queue">{t("verified_review_queue")}</Link>
          </Button>
          <Link href="/app/intake">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New client matter
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("search_leads")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {pipelineStats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
              <div className="rounded-full bg-primary/10 p-2">
                <Icon className="h-4 w-4 text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t("no_leads_yet")}
          description={t("run_client_matter_intake_for_first_lead")}
          actionLabel="Start client intake"
          actionHref="/app/intake"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage.id} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">{stage.label}</h2>
                <Badge variant="secondary">{byStage[stage.id].length}</Badge>
              </div>
              <div className="space-y-2 min-h-[120px] rounded-lg border border-dashed p-2 bg-muted/20">
                {byStage[stage.id].map((lead) => (
                  <Card
                    key={lead.id}
                    className="cursor-pointer hover:border-primary/40 transition-colors shadow-sm"
                    onClick={() => router.push(`/app/leads/${lead.id}`)}
                  >
                    <CardContent className="py-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-sm truncate">{leadTitle(lead)}</p>
                        <LeadStatusBadge status={lead.status} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {lead.issueType}
                        {lead.jurisdiction ? ` · ${lead.jurisdiction}` : ""}
                      </p>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className={urgencyVariant(lead.urgency)}>
                          {lead.urgency}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDate(lead.createdAt)}
                        </span>
                      </div>
                      <div
                        className="flex flex-wrap gap-1 pt-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {PIPELINE_STAGES.filter((s) => s.id !== stage.id).map((s) => (
                          <Button
                            key={s.id}
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            disabled={movingId === lead.id}
                            onClick={() => void handleMoveStage(lead.id, s.id)}
                          >
                            → {s.label}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {byStage[stage.id].length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No leads in {stage.label.toLowerCase()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
