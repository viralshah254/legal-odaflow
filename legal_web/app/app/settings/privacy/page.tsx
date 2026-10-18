"use client"
import { useTranslations } from "next-intl"

import { RoleGate } from "@/components/dashboard/role-gate"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, Download, FileKey2, KeyRound, Loader2, Lock, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import {
  getGovernanceSettings,
  updateGovernanceSettings,
  type PrivacyAssessment,
} from "@/lib/api/governance"
import { PrivacyAssessmentForm } from "@/components/settings/privacy-assessment-form"
import { useState } from "react"
import Link from "next/link"

const controls = [
  {
    title: "Server-side encryption",
    description:
      "Sensitive platform secrets use envelope encryption with key-version metadata. This keeps AI/search workflows usable while raising protection for stored data.",
    icon: Lock,
    status: "Active",
  },
  {
    title: "Tenant isolation",
    description:
      "Firm data access is validated through tenant membership checks before tenant-scoped APIs are allowed to resolve workspace data.",
    icon: ShieldCheck,
    status: "Active",
  },
  {
    title: "AI training consent",
    description:
      "Firm training consent is explicit and defaults off. Users can manage whether anonymized data may be used for improvement or evaluation.",
    icon: Database,
    status: "Configurable",
  },
  {
    title: "Credential protection",
    description:
      "New integration OAuth tokens are encrypted before storage and redacted from API responses.",
    icon: KeyRound,
    status: "Active",
  },
]

export default function PrivacySecurityPage() {
  const t = useTranslations("settings")
  const { activeTenant, activeTenantId } = useTenant()
  const tenant = activeTenant?.tenant
  const [assessment, setAssessment] = useState<PrivacyAssessment | null>(null)
  const [savingAssessment, setSavingAssessment] = useState(false)
  const { data: governance, refetch } = useApiData(
    ["privacy-governance", activeTenantId],
    {
      apiFn: () => getGovernanceSettings(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )
  const assessmentValue = assessment ?? governance?.privacyAssessment

  const saveAssessment = async () => {
    if (!activeTenantId || !assessmentValue) return
    setSavingAssessment(true)
    try {
      await updateGovernanceSettings(activeTenantId, {
        privacyAssessment: assessmentValue,
      })
      setAssessment(null)
      await refetch()
    } finally {
      setSavingAssessment(false)
    }
  }

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
      <div className="p-6 space-y-6 max-w-5xl">
        <div>
          <h1 className="text-3xl font-bold">{t("privacy_security")}</h1>
          <p className="text-muted-foreground mt-1">
            Control how sensitive legal data is protected, processed, and audited across your firm.
          </p>
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileKey2 className="h-5 w-5 text-primary" />
              <CardTitle>{t("firm_privacy_posture")}</CardTitle>
            </div>
            <CardDescription>
              Umbrella uses strong server-side encryption so your workspace can keep legal AI,
              search, documents, and automation connected. This is not a user-only passphrase vault:
              authorized platform services can still process data to provide the features you use.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/app/settings/data-consent">{t("manage_ai_consent")}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/app/copilot/audit">{t("open_copilot_audit")}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/app/settings/governance">{t("governance_settings")}</Link>
            </Button>
          </CardContent>
        </Card>

        {tenant?.primaryCountry === "KE" && assessmentValue && (
          <Card>
            <CardHeader>
              <CardTitle>Kenya privacy assessment</CardTitle>
              <CardDescription>
                Auditable checks under the Data Protection Act, 2019. Unresolved answers block
                document processing, training opt-in, and external integrations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <PrivacyAssessmentForm
                value={assessmentValue}
                status={governance?.privacyStatus}
                onChange={setAssessment}
                disabled={savingAssessment}
              />
              <Button onClick={() => void saveAssessment()} disabled={savingAssessment}>
                {savingAssessment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save privacy assessment
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {controls.map(({ title, description, icon: Icon, status }) => (
            <Card key={title}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{title}</CardTitle>
                  </div>
                  <Badge variant="outline">{status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">{t("data_export")}</CardTitle>
              </div>
              <CardDescription>
                Export requests should include matters, clients, documents, billing, audit logs,
                AI records, and portal data for this firm.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild className="w-full">
                <Link href="/app/settings/compliance">{t("request_export")}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">{t("deletion_request")}</CardTitle>
              </div>
              <CardDescription>
                Start a reviewed deletion workflow for eligible firm data while preserving
                legally required records and audit history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild className="w-full">
                <Link href="/app/settings/compliance">{t("start_review")}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">{t("sensitive_labels")}</CardTitle>
              </div>
              <CardDescription>
                Label sensitive documents from the Documents page and restrict access by user or
                role when matters require extra confidentiality.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild className="w-full">
                <Link href="/app/documents">{t("review_documents")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("processing_transparency")}</CardTitle>
            <CardDescription>
              Current firm region: {tenant?.dataRegion ?? tenant?.primaryCountry ?? "Not configured"}.
              AI processing is governed by firm consent, jurisdiction policy, audit logs, and
              role-based access checks.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline">{t("no_training_without_consent")}</Badge>
            <Badge variant="outline">{t("audit_logged")}</Badge>
            <Badge variant="outline">{t("tenant_isolated")}</Badge>
            <Badge variant="outline">{t("encrypted_high-risk_fields")}</Badge>
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  )
}
