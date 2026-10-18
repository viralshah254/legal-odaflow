"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getAgentJob, listAgentJobs, listAgents } from "@/lib/api/agents"
import { ApiClientError } from "@/lib/api/client"
import type { AgentJob, InternalAgent } from "@/lib/api/types"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useRealtime, useRealtimeEvent } from "@/lib/contexts/realtime-context"
import { REALTIME_EVENTS } from "@/lib/realtime/events"
import { PageCopilotActions } from "@/components/copilot/page-copilot-actions"
import { Bot, RefreshCw } from "lucide-react"

const POLL_MS = 5000

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "COMPLETED") return "default"
  if (status === "FAILED") return "destructive"
  if (status === "PROCESSING") return "secondary"
  return "outline"
}

function formatDate(input?: string | null): string {
  if (!input) return "—"
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export default function AgentsPage() {
  const t = useTranslations("lawyer")
  const { activeTenantId } = useTenant()
  const { status: realtimeStatus } = useRealtime()
  const [agents, setAgents] = useState<InternalAgent[]>([])
  const [jobs, setJobs] = useState<AgentJob[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<AgentJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!activeTenantId) return
    setError(null)
    try {
      const [agentRows, jobRows] = await Promise.all([
        listAgents(activeTenantId),
        listAgentJobs(activeTenantId, 40),
      ])
      setAgents(agentRows)
      setJobs(jobRows)

      let selectedForFetch: string | null = null
      setSelectedJobId((prev) => {
        selectedForFetch = prev ?? jobRows[0]?.id ?? null
        return selectedForFetch
      })

      if (selectedForFetch) {
        const job = await getAgentJob(activeTenantId, selectedForFetch)
        setSelectedJob(job)
      } else {
        setSelectedJob(null)
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load agents")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!activeTenantId) return
    void load()
    if (realtimeStatus === "connected") return
    const timer = setInterval(() => {
      void load()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [activeTenantId, realtimeStatus])

  useRealtimeEvent(REALTIME_EVENTS.AGENT_JOB_UPDATED, () => {
    if (activeTenantId) void load()
  })

  useEffect(() => {
    if (!selectedJobId || !activeTenantId) return
    getAgentJob(activeTenantId, selectedJobId)
      .then(setSelectedJob)
      .catch(() => setSelectedJob(null))
  }, [activeTenantId, selectedJobId])

  const outputMarkdown = useMemo(() => {
    const raw = selectedJob?.result
    if (!raw || typeof raw !== "object") return ""
    const maybeMarkdown = (raw as { outputMarkdown?: unknown }).outputMarkdown
    return typeof maybeMarkdown === "string" ? maybeMarkdown : ""
  }, [selectedJob])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bot className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold">{t("agent_command_center")}</h1>
          </div>
          <p className="text-muted-foreground">
            Monitor agent jobs and outputs in near real-time (auto-refresh every 5s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/automations">
            <Button variant="outline">{t("install_automation_recipes")}</Button>
          </Link>
          <div className="flex items-center gap-2">
            <PageCopilotActions />
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 p-3">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {agents.map((agent) => (
          <Card key={agent.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{agent.name}</CardTitle>
              <CardDescription className="text-xs">{agent.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{agent.queue}</Badge>
                {agent.requiresApproval ? <Badge variant="secondary">{t("approval")}</Badge> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2" data-tour="agents-jobs">
        <Card>
          <CardHeader>
            <CardTitle>{t("job_feed")}</CardTitle>
            <CardDescription>{t("most_recent_agent_jobs")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[580px] overflow-y-auto">
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("no_agent_jobs_yet")}</p>
            ) : (
              jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedJobId(job.id)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    selectedJobId === job.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-sm">{job.jobType}</p>
                    <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Queue: {job.queue} · Created: {formatDate(job.createdAt)}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("output_preview")}</CardTitle>
            <CardDescription>
              {selectedJob ? `Job ${selectedJob.jobType} · ${selectedJob.id}` : "Select a job"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedJob ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(selectedJob.status)}>{selectedJob.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Completed: {formatDate(selectedJob.completedAt)}
                  </span>
                </div>

                {selectedJob.error ? (
                  <p className="text-sm text-destructive border border-destructive/30 rounded-md p-3">
                    {selectedJob.error}
                  </p>
                ) : null}

                <div className="min-h-[340px] max-h-[470px] overflow-y-auto rounded-md border p-4">
                  {outputMarkdown ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                      {outputMarkdown}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No markdown output yet for this job.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("select_a_job_from_the_feed_to_preview_output")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
