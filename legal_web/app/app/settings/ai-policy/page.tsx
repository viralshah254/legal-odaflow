"use client"
import { useTranslations } from "next-intl"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RoleGate } from "@/components/dashboard/role-gate"
import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"
import { LegalDisclaimer, AI_CITATION_NOTICE, UNIVERSAL_LEGAL_DISCLAIMER } from "@/components/legal/LegalDisclaimer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, Save } from "lucide-react"
import { useTenant } from "@/lib/contexts/tenant-context"
import {
  getGovernanceSettings,
  updateGovernanceSettings,
  type AiPolicySettings,
} from "@/lib/api/governance"

const POLICY_FLAGS: Array<{
  id: keyof AiPolicySettings
  label: string
  description: string
}> = [
  {
    id: "disclaimerRequired",
    label: "Require disclaimer on every AI output",
    description: "Consumer and lawyer outputs include the universal legal disclaimer.",
  },
  {
    id: "citationGuardrails",
    label: "Citation guardrails",
    description: "Research and memos must cite retrieved authorities only.",
  },
  {
    id: "trainingOptOut",
    label: "No training on firm data (default)",
    description: "Firm content is excluded from training unless explicitly opted in.",
  },
  {
    id: "requireLawyerApproval",
    label: "Human approval for high-risk outputs",
    description: "Court filings, external notices, and client advice require lawyer sign-off.",
  },
]

const DEFAULT_POLICY: AiPolicySettings = {
  disclaimerRequired: true,
  citationGuardrails: true,
  trainingOptOut: true,
  requireLawyerApproval: true,
}

export default function AiPolicyPage() {
  const t = useTranslations("settings")
  const tCommon = useTranslations("common")
  const { activeTenantId } = useTenant()
  const queryClient = useQueryClient()
  const [policy, setPolicy] = useState<AiPolicySettings>(DEFAULT_POLICY)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["governance-settings", activeTenantId],
    queryFn: () => getGovernanceSettings(activeTenantId!),
    enabled: !!activeTenantId,
  })

  useEffect(() => {
    if (data?.aiPolicy) {
      setPolicy({ ...DEFAULT_POLICY, ...data.aiPolicy })
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateGovernanceSettings(activeTenantId!, { aiPolicy: policy }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["governance-settings", activeTenantId] })
      setSaveMessage("AI policy saved.")
      setTimeout(() => setSaveMessage(null), 4000)
    },
    onError: () => setSaveMessage("Failed to save. Try again."),
  })

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
      <div className="p-6 space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("ai_policy")}</h1>
            <p className="text-muted-foreground">
              Platform AI safety rules for your firm (persisted per tenant)
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saveMessage && (
              <span className="text-sm text-muted-foreground">{saveMessage}</span>
            )}
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!activeTenantId || saveMutation.isPending || isLoading}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
            <OpenCopilotButton />
          </div>
        </div>

        <p className="text-sm">
          <Link href="/app/settings/governance" className="text-primary hover:underline">
            Governance settings
          </Link>
          {" · "}
          <Link href="/app/settings/data-consent" className="text-primary hover:underline">
            Training opt-in
          </Link>
          {" · "}
          <Link href="/app/copilot/audit" className="text-primary hover:underline">
            Copilot audit
          </Link>
        </p>

        <Card>
          <CardHeader>
            <CardTitle>{t("active_policies")}</CardTitle>
            <CardDescription>{t("saved_to_firm_governance_settings")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
            ) : (
              POLICY_FLAGS.map((flag) => {
                const enabled = policy[flag.id]
                return (
                  <div key={flag.id} className="flex items-start justify-between gap-4">
                    <div>
                      <Label className="text-base">{flag.label}</Label>
                      <p className="text-sm text-muted-foreground mt-1">{flag.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) =>
                          setPolicy((p) => ({ ...p, [flag.id]: checked }))
                        }
                      />
                      <Badge variant={enabled ? "default" : "secondary"}>
                        {enabled ? "On" : "Off"}
                      </Badge>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("universal_disclaimer_text")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{UNIVERSAL_LEGAL_DISCLAIMER}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("citation_rule")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{AI_CITATION_NOTICE}</p>
          </CardContent>
        </Card>

        <LegalDisclaimer variant="compact" />
      </div>
    </RoleGate>
  )
}
