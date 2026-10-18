"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useTenant } from "@/lib/contexts/tenant-context"
import { updateTenant } from "@/lib/api/tenants"
import { updateGovernanceSettings } from "@/lib/api/governance"
import type { PrivacyAssessment } from "@/lib/api/governance"
import { getCountryCompliancePolicy } from "@/lib/api/country-compliance"
import { createClient } from "@/lib/api/clients"
import { createMatter } from "@/lib/api/matters"
import { connectIntegration, INTEGRATION_PROVIDER_LABELS, listIntegrations } from "@/lib/api/integrations"
import { createAutomationRule, listBuiltInRecipes, seedAutomationRecipes } from "@/lib/api/automations"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CountryCode } from "@/lib/api/types"
import { CheckCircle2, Link2, Loader2, Zap } from "lucide-react"
import { useApiData } from "@/lib/hooks/use-api-data"
import { PRACTICE_AREAS, resolvePracticeAreaSlug } from "@/lib/taxonomy/platform-taxonomy"
import { INDIA_FIRM_PRACTICE_AREA_MAPPINGS } from "@/lib/taxonomy/firm-practice-area-mapping"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  EMPTY_PRIVACY_ASSESSMENT,
  PrivacyAssessmentForm,
} from "@/components/settings/privacy-assessment-form"

const STEPS = ["profile", "privacy", "governance", "client", "matter", "integrations", "automation"] as const
type Step = (typeof STEPS)[number]

const ONBOARDING_INTEGRATIONS = ["google_calendar", "gmail", "docusign"] as const

export default function OnboardingPage() {
  const t = useTranslations("lawyer")
  const tAuth = useTranslations("auth")
  const router = useRouter()
  const { activeTenantId, activeTenant } = useTenant()
  const [step, setStep] = useState<Step>("profile")
  const [firmName, setFirmName] = useState(activeTenant?.tenant.name ?? "")
  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [createdClientId, setCreatedClientId] = useState<string | null>(null)
  const [matterTitle, setMatterTitle] = useState("")
  const [matterPracticeArea, setMatterPracticeArea] = useState("")
  const [privacyAssessment, setPrivacyAssessment] = useState<PrivacyAssessment>({
    ...EMPTY_PRIVACY_ASSESSMENT,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null)

  const { data: integrations = [] } = useApiData(
    ["onboarding-integrations", activeTenantId],
    {
      apiFn: () => listIntegrations(activeTenantId!),
      enabled: !!activeTenantId && step === "integrations",
    },
  )
  const countryCode = activeTenant?.tenant.primaryCountry ?? "KE"
  const { data: countryPolicy } = useApiData(
    ["onboarding-country-compliance", countryCode],
    { apiFn: () => getCountryCompliancePolicy(countryCode) },
  )

  const { data: recipes = [] } = useApiData(
    ["onboarding-recipes", activeTenantId],
    {
      apiFn: () => listBuiltInRecipes(activeTenantId!),
      enabled: !!activeTenantId && step === "automation",
    },
  )

  const stepIndex = STEPS.indexOf(step)
  const progress = ((stepIndex + 1) / STEPS.length) * 100

  const goNext = () => {
    const i = STEPS.indexOf(step)
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]!)
  }

  const handleProfile = async () => {
    if (!activeTenantId || !firmName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await updateTenant(activeTenantId, { name: firmName.trim() })
      goNext()
    } catch {
      setError("Could not save firm profile.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleGovernance = async () => {
    if (!activeTenantId) return
    setSubmitting(true)
    setError(null)
    try {
      await updateGovernanceSettings(activeTenantId, {
        ethicalWallsEnabled: true,
        aiTrainingOptOut: true,
        dataRetentionDays: 2555,
        requireMatterApprovalForSharing: false,
        copilotPolicy: "standard",
      })
      goNext()
    } catch {
      setError("Could not apply governance defaults.")
    } finally {
      setSubmitting(false)
    }
  }

  const handlePrivacy = async () => {
    if (!activeTenantId) return
    if (
      countryCode === "KE" &&
      (privacyAssessment.sensitiveDataHandled === null ||
        privacyAssessment.crossBorderTransfers === null ||
        !privacyAssessment.residencyConfirmed ||
        (privacyAssessment.sensitiveDataHandled && !privacyAssessment.dpiaCompleted) ||
        (privacyAssessment.crossBorderTransfers &&
          privacyAssessment.transferSafeguard === "UNASSESSED"))
    ) {
      setError("Resolve every residency, transfer, and sensitive-data requirement to continue.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (countryCode === "KE") {
        await updateTenant(activeTenantId, {
          dataRegion: countryPolicy?.defaultDataRegion ?? "af-south-1",
        })
        await updateGovernanceSettings(activeTenantId, { privacyAssessment })
      }
      goNext()
    } catch {
      setError("Could not save the privacy assessment.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClient = async () => {
    if (!activeTenantId || !clientName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const client = await createClient(activeTenantId, {
        name: clientName.trim(),
        email: clientEmail || undefined,
        type: "COMPANY",
        countryCode: (activeTenant?.tenant.primaryCountry ?? "KE") as CountryCode,
      })
      setCreatedClientId(client.id)
      goNext()
    } catch {
      setError("Could not create client.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleMatter = async () => {
    if (!activeTenantId || !createdClientId || !matterTitle.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await createMatter(activeTenantId, {
        clientId: createdClientId,
        title: matterTitle.trim(),
        countryCode: (activeTenant?.tenant.primaryCountry ?? "KE") as CountryCode,
        practiceArea: matterPracticeArea
          ? resolvePracticeAreaSlug(matterPracticeArea)
          : "general_usage",
        matterType: "General",
      })
      goNext()
    } catch {
      setError("Could not create matter.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleConnect = async (provider: string) => {
    if (!activeTenantId) return
    setConnectingProvider(provider)
    setError(null)
    try {
      await connectIntegration(activeTenantId, provider)
    } catch {
      setError(`Could not connect ${INTEGRATION_PROVIDER_LABELS[provider] ?? provider}. You can finish this later in Settings.`)
    } finally {
      setConnectingProvider(null)
    }
  }

  const handleIntegrationsContinue = () => {
    goNext()
  }

  const handleAutomation = async () => {
    if (!activeTenantId) return
    setSubmitting(true)
    setError(null)
    try {
      await seedAutomationRecipes(activeTenantId)
      const firstRecipe = recipes[0]
      if (firstRecipe) {
        await createAutomationRule(activeTenantId, {
          name: firstRecipe.name,
          trigger: firstRecipe.trigger,
          conditions: firstRecipe.conditions,
          actions: firstRecipe.actions,
          isEnabled: true,
        })
      }
      router.push("/app/dashboard")
    } catch {
      setError("Could not set up automation. Continue to dashboard anyway.")
      router.push("/app/dashboard")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/20">
      <Card className="w-full max-w-lg" data-tour="onboarding-wizard">
        <CardHeader>
          <CardTitle>{t("firm_onboarding")}</CardTitle>
          <CardDescription>
            Step {stepIndex + 1} of {STEPS.length}: set up your workspace
          </CardDescription>
          <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</p>
          )}

          {step === "profile" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="firmName">{tAuth("firmName")}</Label>
                <Input
                  id="firmName"
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  placeholder={t("your_law_firm_llp")}
                />
              </div>
              <Button className="w-full" onClick={handleProfile} disabled={submitting}>
                Continue
              </Button>
            </>
          )}

          {step === "governance" && (
            <>
              <p className="text-sm text-muted-foreground">
                We enable ethical walls, AI data opt-out, and standard retention by default. You can change these later in Settings → Governance.
              </p>
              <Button className="w-full" onClick={handleGovernance} disabled={submitting}>
                Apply defaults & continue
              </Button>
            </>
          )}

          {step === "privacy" && (
            <>
              {countryCode === "KE" ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Complete the Kenya Data Protection Act assessment before document processing,
                    AI training opt-in, or external integrations can be enabled.
                  </p>
                  <PrivacyAssessmentForm
                    value={privacyAssessment}
                    onChange={setPrivacyAssessment}
                    disabled={submitting}
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No additional country privacy assessment is required during setup.
                </p>
              )}
              <Button className="w-full" onClick={() => void handlePrivacy()} disabled={submitting}>
                Save privacy controls & continue
              </Button>
            </>
          )}

          {step === "client" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="clientName">{t("first_client_name")}</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder={t("acme_corporation")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientEmail">{t("client_email_optional")}</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={handleClient} disabled={submitting || !clientName.trim()}>
                Create client
              </Button>
            </>
          )}

          {step === "matter" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="matterTitle">{t("first_matter_title")}</Label>
                <Input
                  id="matterTitle"
                  value={matterTitle}
                  onChange={(e) => setMatterTitle(e.target.value)}
                  placeholder={t("acme_corp_commercial_agreement")}
                />
              </div>
              {(activeTenant?.tenant.primaryCountry ?? "KE") === "IN" ? (
                <div className="space-y-2">
                  <Label htmlFor="matterPracticeArea">{t("practice_area")}</Label>
                  <Select value={matterPracticeArea || undefined} onValueChange={setMatterPracticeArea}>
                    <SelectTrigger id="matterPracticeArea">
                      <SelectValue placeholder="Select practice area (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDIA_FIRM_PRACTICE_AREA_MAPPINGS.map((mapping) => (
                        <SelectItem
                          key={mapping.firmLabel}
                          value={mapping.taxonomySlugs[0]!}
                        >
                          {mapping.firmLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Maps to Umbrella taxonomy — e.g. Real Estate, NRI, International Practice.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="matterPracticeAreaGeneric">{t("practice_area")}</Label>
                  <Select value={matterPracticeArea || undefined} onValueChange={setMatterPracticeArea}>
                    <SelectTrigger id="matterPracticeAreaGeneric">
                      <SelectValue placeholder="Select practice area (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRACTICE_AREAS.map((area) => (
                        <SelectItem key={area.slug} value={area.slug}>
                          {area.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                className="w-full"
                onClick={handleMatter}
                disabled={submitting || !createdClientId || !matterTitle.trim()}
              >
                Continue
              </Button>
            </>
          )}

          {step === "integrations" && (
            <>
              <p className="text-sm text-muted-foreground">
                Connect calendar, email, or e-signature tools. Optional — you can configure more in{" "}
                <Link href="/app/settings/integrations" className="text-primary underline">
                  Settings → Integrations
                </Link>
                .
              </p>
              <div className="space-y-2">
                {ONBOARDING_INTEGRATIONS.map((provider) => {
                  const connected = integrations.some(
                    (i) => i.provider === provider && i.status === "CONNECTED",
                  )
                  return (
                    <div
                      key={provider}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {INTEGRATION_PROVIDER_LABELS[provider] ?? provider}
                        </span>
                      </div>
                      {connected ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Connected
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={connectingProvider === provider}
                          onClick={() => void handleConnect(provider)}
                        >
                          {connectingProvider === provider ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Connect"
                          )}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
              <Button className="w-full" onClick={handleIntegrationsContinue}>
                Continue
              </Button>
            </>
          )}

          {step === "automation" && (
            <>
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <Zap className="h-4 w-4 mt-0.5 shrink-0" />
                Enable a starter automation recipe to notify your team when matters or tasks need attention.
              </p>
              {recipes.length > 0 && (
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{recipes[0]!.name}</p>
                  <p className="text-muted-foreground text-xs mt-1">{recipes[0]!.description}</p>
                </div>
              )}
              <Button className="w-full" onClick={handleAutomation} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Finish setup
              </Button>
            </>
          )}

          {stepIndex > 0 && step !== "automation" && (
            <Button variant="ghost" className="w-full" onClick={() => setStep(STEPS[stepIndex - 1]!)}>
              Back
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
