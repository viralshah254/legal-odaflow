"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  FileText,
  Gavel,
  Info,
  Loader2,
  Scale,
} from "lucide-react"

import { ConflictCheckPanel } from "@/components/conflicts/ConflictCheckPanel"
import { ClientQuickCreate } from "@/components/matters/client-quick-create"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ApiClientError } from "@/lib/api/client"
import { listClients } from "@/lib/api/clients"
import { createMatter } from "@/lib/api/matters"
import type { ApiClient, CountryCode } from "@/lib/api/types"
import {
  COURT_LEVEL_OPTIONS,
  getMatterTypeOption,
  getPracticeAreaConfig,
  PRACTICE_AREA_CONFIGS,
  showsCourtFields,
  showsDesiredOutcome,
  showsOpposingParty,
  type MatterTypeValue,
} from "@/lib/config/matter-intake"
import { useTenant } from "@/lib/contexts/tenant-context"
import { getCountryName } from "@/lib/geo/detect-country"
import { getStateOptions } from "@/lib/geo/country-states"
import { useApiData } from "@/lib/hooks/use-api-data"
import { cn } from "@/lib/utils"

const STEPS = [
  { title: "What is this?", description: "Classify and name the matter." },
  { title: "Who and where?", description: "Add the client, parties, and jurisdiction." },
  { title: "Context and checks", description: "Give the team context and clear conflicts." },
] as const

function MatterTypeIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    Litigation: <Scale className="h-5 w-5" />,
    Transaction: <Building2 className="h-5 w-5" />,
    Advisory: <Info className="h-5 w-5" />,
    Dispute: <Gavel className="h-5 w-5" />,
    Drafting: <FileText className="h-5 w-5" />,
  }
  return <>{icons[type] ?? <FileText className="h-5 w-5" />}</>
}

export function MatterIntakeWizard() {
  const t = useTranslations("matters")
  const tDashboard = useTranslations("dashboard")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const searchParams = useSearchParams()
  const { activeTenantId, activeTenant } = useTenant()
  const isResearchPrefill = searchParams.get("aiProposed") === "1"
  const sourceResearchId = searchParams.get("sourceResearchId") ?? ""
  const proposedPracticeArea = searchParams.get("practiceArea") ?? PRACTICE_AREA_CONFIGS[0].slug
  const proposedPracticeConfig =
    getPracticeAreaConfig(proposedPracticeArea) ?? PRACTICE_AREA_CONFIGS[0]

  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflictClear, setConflictClear] = useState(false)
  const [researchPrefillConfirmed, setResearchPrefillConfirmed] = useState(false)
  const [createdClients, setCreatedClients] = useState<ApiClient[]>([])
  const [form, setForm] = useState({
    title: isResearchPrefill ? searchParams.get("title") ?? "" : "",
    clientId: searchParams.get("clientId") ?? "",
    countryCode: (
      (isResearchPrefill ? searchParams.get("country") : null)
      ?? activeTenant?.tenant.primaryCountry
      ?? "KE"
    ) as CountryCode,
    practiceArea: proposedPracticeConfig.slug,
    matterType: proposedPracticeConfig.defaultMatterType,
    opposingParty: "",
    desiredOutcome: isResearchPrefill ? searchParams.get("desiredOutcome") ?? "" : "",
    courtName: "",
    courtLevel: "",
    caseNumber: "",
    jurisdiction: "",
    factsSummary: isResearchPrefill ? searchParams.get("factsSummary") ?? "" : "",
  })

  useEffect(() => {
    if (activeTenant?.tenant.primaryCountry && !isResearchPrefill) {
      setForm((current) => ({
        ...current,
        countryCode: activeTenant.tenant.primaryCountry as CountryCode,
        jurisdiction: "",
      }))
    }
  }, [activeTenant, isResearchPrefill])

  const { data: loadedClients = [] } = useApiData(
    ["clients", activeTenantId],
    {
      apiFn: () => listClients(activeTenantId!),
      enabled: Boolean(activeTenantId),
    },
  )
  const clients = useMemo(
    () => [...createdClients, ...loadedClients.filter((client) => !createdClients.some((item) => item.id === client.id))],
    [createdClients, loadedClients],
  )
  const selectedClient = clients.find((client) => client.id === form.clientId)
  const parties = useMemo(() => {
    const result: Array<{ name?: string; email?: string }> = []
    if (selectedClient) result.push({ name: selectedClient.name, email: selectedClient.email ?? undefined })
    if (form.opposingParty.trim()) result.push({ name: form.opposingParty.trim() })
    return result
  }, [form.opposingParty, selectedClient])
  const partiesKey = JSON.stringify(parties)

  useEffect(() => {
    setConflictClear(false)
  }, [partiesKey])

  const practiceArea = getPracticeAreaConfig(form.practiceArea) ?? PRACTICE_AREA_CONFIGS[0]
  const matterTypeOptions = practiceArea.matterTypes.map((type) => getMatterTypeOption(type)!)

  function changePracticeArea(slug: string) {
    const config = getPracticeAreaConfig(slug)
    setForm((current) => ({
      ...current,
      practiceArea: slug,
      matterType: config?.defaultMatterType ?? "Advisory",
      opposingParty: "",
      desiredOutcome: "",
      courtName: "",
      courtLevel: "",
      caseNumber: "",
    }))
  }

  function changeMatterType(value: MatterTypeValue) {
    setForm((current) => ({
      ...current,
      matterType: value,
      opposingParty: showsOpposingParty(value) ? current.opposingParty : "",
      desiredOutcome: showsDesiredOutcome(value) ? current.desiredOutcome : "",
      courtName: showsCourtFields(value) ? current.courtName : "",
      courtLevel: showsCourtFields(value) ? current.courtLevel : "",
      caseNumber: showsCourtFields(value) ? current.caseNumber : "",
    }))
  }

  const canContinue =
    step === 0
      ? Boolean(form.title.trim() && form.practiceArea && form.matterType)
      : step === 1
        ? Boolean(form.clientId)
        : Boolean(
            conflictClear
            && (!isResearchPrefill || researchPrefillConfirmed),
          )

  async function submit() {
    if (!activeTenantId || !canContinue) return
    setSubmitting(true)
    setError(null)
    try {
      const matter = await createMatter(activeTenantId, {
        title: form.title.trim(),
        clientId: form.clientId,
        countryCode: form.countryCode,
        practiceArea: form.practiceArea,
        matterType: form.matterType,
        jurisdiction: form.jurisdiction || undefined,
        courtName: form.courtName || undefined,
        courtLevel: form.courtLevel || undefined,
        caseNumber: form.caseNumber || undefined,
        opposingParty: form.opposingParty || undefined,
        desiredOutcome: form.desiredOutcome || undefined,
        factsSummary: form.factsSummary || undefined,
      })
      router.push(`/app/matters/${matter.id}?hub=1&created=1`)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("failed_to_create_matter"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app/matters"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{tDashboard("new_matter")}</h1>
          <p className="text-sm text-muted-foreground">Create the workspace first. Documents and recommended forms come next.</p>
        </div>
      </div>

      <nav aria-label="Matter creation progress" className="grid grid-cols-3 gap-2">
        {STEPS.map((item, index) => (
          <button
            key={item.title}
            type="button"
            disabled={index > step}
            onClick={() => index < step && setStep(index)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              index === step && "border-primary bg-primary/5",
              index < step && "border-primary/30",
              index > step && "opacity-60",
            )}
          >
            <span className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <span className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs",
                index <= step && "bg-primary text-primary-foreground",
              )}>
                {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="hidden sm:inline">{item.title}</span>
            </span>
            <span className="hidden text-xs text-muted-foreground md:block">{item.description}</span>
          </button>
        ))}
      </nav>

      {isResearchPrefill && (
        <Card className="border-violet-300 bg-violet-50/60 dark:bg-violet-950/20">
          <CardContent className="p-4 text-sm">
            <p className="font-semibold">AI-proposed matter intake</p>
            <p className="text-xs text-muted-foreground">
              Review every field before creation. Source research: {sourceResearchId || "not available"}.
            </p>
          </CardContent>
        </Card>
      )}

      <Card data-tour="matter-form">
        <CardHeader>
          <CardTitle>{STEPS[step].title}</CardTitle>
          <CardDescription>{STEPS[step].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label>Practice area</Label>
                <Select value={form.practiceArea} onValueChange={changePracticeArea}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRACTICE_AREA_CONFIGS.map((area) => (
                      <SelectItem key={area.slug} value={area.slug}>{area.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <fieldset className="space-y-2">
                <Label asChild><legend>Matter type</legend></Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {matterTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => changeMatterType(option.value)}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 text-left hover:bg-muted/50",
                        form.matterType === option.value && "border-primary bg-primary/5",
                      )}
                    >
                      <span className="mt-0.5 text-primary"><MatterTypeIcon type={option.value} /></span>
                      <span>
                        <span className="block text-sm font-medium">{option.label}</span>
                        <span className="block text-xs text-muted-foreground">{option.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2">
                <Label htmlFor="matter-title">Matter title <span className="text-destructive">*</span></Label>
                <Input
                  id="matter-title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder={form.matterType === "Litigation" ? t("placeholder_litigation_title") : t("placeholder_matter_title")}
                />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Client <span className="text-destructive">*</span></Label>
                  {activeTenantId && (
                    <ClientQuickCreate
                      tenantId={activeTenantId}
                      countryCode={form.countryCode}
                      onCreated={(client) => {
                        setCreatedClients((current) => [client, ...current])
                        setForm((current) => ({ ...current, clientId: client.id }))
                      }}
                    />
                  )}
                </div>
                <Select value={form.clientId || "none"} onValueChange={(value) => setForm({ ...form, clientId: value === "none" ? "" : value })}>
                  <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Select a client</SelectItem>
                    {clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Jurisdiction</Label>
                <p className="text-xs text-muted-foreground">{getCountryName(form.countryCode)} · from firm settings</p>
                <Select value={form.jurisdiction} onValueChange={(value) => setForm({ ...form, jurisdiction: value })}>
                  <SelectTrigger><SelectValue placeholder="Select state / region" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {getStateOptions(form.countryCode).map((state) => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {showsOpposingParty(form.matterType) && (
                <div className="space-y-2">
                  <Label htmlFor="opposing-party">Opposing party</Label>
                  <Input id="opposing-party" value={form.opposingParty} onChange={(event) => setForm({ ...form, opposingParty: event.target.value })} />
                </div>
              )}
              {showsDesiredOutcome(form.matterType) && (
                <div className="space-y-2">
                  <Label htmlFor="desired-outcome">Desired outcome</Label>
                  <Textarea id="desired-outcome" rows={3} value={form.desiredOutcome} onChange={(event) => setForm({ ...form, desiredOutcome: event.target.value })} />
                </div>
              )}
              {showsCourtFields(form.matterType) && (
                <div className="rounded-lg border p-4">
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Gavel className="h-4 w-4" /> Court details</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label>Court name</Label><Input value={form.courtName} onChange={(event) => setForm({ ...form, courtName: event.target.value })} /></div>
                    <div className="space-y-2">
                      <Label>Court level</Label>
                      <Select value={form.courtLevel || "none"} onValueChange={(value) => setForm({ ...form, courtLevel: value === "none" ? "" : value })}>
                        <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not specified</SelectItem>
                          {COURT_LEVEL_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2"><Label>Case / file number</Label><Input value={form.caseNumber} onChange={(event) => setForm({ ...form, caseNumber: event.target.value })} /></div>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="facts-summary">Facts summary</Label>
                <Textarea
                  id="facts-summary"
                  rows={6}
                  value={form.factsSummary}
                  onChange={(event) => setForm({ ...form, factsSummary: event.target.value })}
                  placeholder={t("facts_summary_placeholder")}
                />
                <p className="text-xs text-muted-foreground">This gives the matter workspace and AI enough context to suggest the first useful actions.</p>
              </div>
              {activeTenantId && (
                <ConflictCheckPanel
                  tenantId={activeTenantId}
                  clientId={form.clientId}
                  parties={parties}
                  autoRun
                  onClear={() => setConflictClear(true)}
                  onReviewRequired={() => setConflictClear(false)}
                />
              )}
              {isResearchPrefill && (
                <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                  <input type="checkbox" className="mt-0.5 h-4 w-4" checked={researchPrefillConfirmed} onChange={(event) => setResearchPrefillConfirmed(event.target.checked)} />
                  I reviewed and confirmed the AI-proposed title, classification, client, facts, and desired outcome.
                </label>
              )}
            </>
          )}

          {error && <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex items-center justify-between border-t pt-4">
            {step === 0 ? (
              <Button variant="outline" asChild><Link href="/app/matters">{tCommon("cancel")}</Link></Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" disabled={!canContinue} onClick={() => setStep((current) => current + 1)}>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" size="lg" data-tour="matter-submit" disabled={submitting || !canContinue} onClick={submit}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("createMatter")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
