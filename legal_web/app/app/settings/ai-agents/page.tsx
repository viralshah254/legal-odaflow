"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { useEffect, useState } from "react"
import { RoleGate } from "@/components/dashboard/role-gate"
import { listAgents } from "@/lib/api/agents"
import type { InternalAgent } from "@/lib/api/types"
import { useTenant } from "@/lib/contexts/tenant-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bot } from "lucide-react"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export default function AiAgentsSettingsPage() {
  const t = useTranslations("settings")
  const { activeTenantId } = useTenant()
  const [agents, setAgents] = useState<InternalAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!activeTenantId) return
    listAgents(activeTenantId)
      .then(setAgents)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load agents"))
      .finally(() => setLoading(false))
  }, [activeTenantId])

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
      <div className="p-6 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold">{t("ai_agents")}</h1>
          <p className="text-muted-foreground">
            Internal agents available to your firm and their approval requirements
          </p>
        </div>

        <p className="text-sm">
          <Link href="/app/agents" className="text-primary hover:underline">
            Open agents job dashboard
          </Link>
          {" · "}
          <Link href="/app/settings/ai-policy" className="text-primary hover:underline">
            AI policy
          </Link>
        </p>

        {loading && <PageSkeleton rows={4} />}
        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <Bot className="h-6 w-6 text-primary shrink-0" />
                  {agent.requiresApproval && (
                    <Badge variant="outline">{t("approval_required")}</Badge>
                  )}
                </div>
                <CardTitle className="text-lg">{agent.name}</CardTitle>
                <CardDescription>{agent.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Queue: {agent.queue}</p>
                <div className="flex flex-wrap gap-1">
                  {agent.capabilities.map((cap) => (
                    <Badge key={cap} variant="secondary" className="text-xs">
                      {cap}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {!loading && agents.length === 0 && !error && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No agents registered for this tenant.
            </CardContent>
          </Card>
        )}

        <Button asChild variant="outline">
          <Link href="/app/agents">{t("view_agent_jobs")}</Link>
        </Button>
      </div>
    </RoleGate>
  )
}
