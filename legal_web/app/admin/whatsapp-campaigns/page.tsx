"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, Plus, Pause, Play, MessageSquare, ChevronDown, ChevronUp, Check, X, Trash2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  listWhatsappCampaigns,
  createWhatsappCampaign,
  pauseWhatsappCampaign,
  resumeWhatsappCampaign,
  deleteWhatsappCampaign,
  getWhatsappCampaign,
  listWhatsappTemplates,
  getWhatsappDiagnostics,
  getCitiesForCountry,
  getLawyerProspectStats,
  listLawyerProspects,
  type WhatsappCampaign,
  type WhatsappMessage,
  type LawyerProspect,
  type WhatsappTemplate,
  type WhatsappTemplateDiagnostics,
  type WhatsappDiagnostics,
  type CreateCampaignPayload,
} from "@/lib/api/admin"

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  RUNNING: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  PAUSED: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  DONE: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
}

const MSG_STATUS_COLORS: Record<string, string> = {
  QUEUED: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  READ: "bg-purple-100 text-purple-700",
  FAILED: "bg-red-100 text-red-700",
  OPT_OUT: "bg-orange-100 text-orange-700",
}

const ANY_VALUE = "any"

/** Replace {{1}}, {{2}} placeholders with example values for preview */
function previewBody(bodyText: string, firstName = "Rohan", city = "Mumbai") {
  return bodyText
    .replace(/\{\{1\}\}/g, firstName)
    .replace(/\{\{2\}\}/g, city)
    .replace(/\{\{3\}\}/g, "okaylegal.ai")
}

function ProgressBar({ sent, total }: { sent: number; total: number }) {
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>{sent} / {total} sent</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function CampaignRow({
  campaign,
  onPause,
  onResume,
  onDelete,
  onExpand,
  expanded,
}: {
  campaign: WhatsappCampaign
  onPause: (id: string) => void
  onResume: (id: string) => void
  onDelete: (campaign: WhatsappCampaign) => void
  onExpand: (id: string) => void
  expanded: boolean
}) {
  const delivered = campaign.totalDelivered
  const read = campaign.totalRead
  const sent = campaign.totalSent

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-4 p-4 bg-card">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{campaign.name}</span>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[campaign.status] ?? "bg-muted"}`}
            >
              {campaign.status}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            Template: <span className="font-mono">{campaign.templateName}</span>
            {" · "}
            {new Date(campaign.createdAt).toLocaleDateString()}
          </div>
          <ProgressBar sent={sent} total={campaign.totalQueued} />
          <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
            <span>Delivered: <strong className="text-foreground">{delivered}</strong></span>
            <span>Read: <strong className="text-foreground">{read}</strong></span>
            <span>Failed: <strong className="text-red-500">{campaign.totalFailed}</strong></span>
            {campaign.totalFailed > 0 && campaign.lastFailedError && (
              <span className="text-red-500 truncate max-w-md" title={campaign.lastFailedError}>
                {campaign.lastFailedError}
              </span>
            )}
            {sent > 0 && (
              <>
                <span>Del%: <strong className="text-foreground">{Math.round((delivered / sent) * 100)}%</strong></span>
                <span>Read%: <strong className="text-foreground">{Math.round((read / sent) * 100)}%</strong></span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {campaign.status === "RUNNING" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPause(campaign.id)}
            >
              <Pause className="h-3.5 w-3.5 mr-1" />
              Pause
            </Button>
          )}
          {campaign.status === "PAUSED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResume(campaign.id)}
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              Resume
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => onDelete(campaign)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onExpand(campaign.id)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {expanded && <CampaignMessageList campaignId={campaign.id} />}
    </div>
  )
}

function CampaignMessageList({ campaignId }: { campaignId: string }) {
  const [messages, setMessages] = useState<WhatsappMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getWhatsappCampaign(campaignId)
      .then((c) => setMessages(c.messages ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [campaignId])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 border-t border-border">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="border-t border-border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">Messages ({messages.length})</p>
      <div className="max-h-60 overflow-y-auto space-y-1">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">No messages yet</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex items-center gap-2 text-xs font-mono">
            <span className="text-muted-foreground w-32 shrink-0 truncate">{msg.to}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${MSG_STATUS_COLORS[msg.status] ?? "bg-muted"}`}
            >
              {msg.status}
            </span>
            {msg.errorCode && (
              <span className="text-red-500 truncate">{msg.errorCode}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function CityMultiSelect({
  cities,
  selected,
  onChange,
  disabled,
  loading,
}: {
  cities: { city: string; count: number }[]
  selected: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
  loading?: boolean
}) {
  const [open, setOpen] = useState(false)

  const toggle = (city: string) => {
    if (selected.includes(city)) {
      onChange(selected.filter((c) => c !== city))
    } else {
      onChange([...selected, city])
    }
  }

  const label =
    selected.length === 0
      ? "All cities"
      : selected.length === 1
      ? selected[0]
      : `${selected.length} cities selected`

  return (
    <div className="mt-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="truncate text-left text-muted-foreground">
              {disabled ? "Select country first" : label}
            </span>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0 ml-2 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 ml-2 text-muted-foreground" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2 max-h-72 flex flex-col overflow-hidden">
          {cities.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">No cities found</p>
          ) : (
            <>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="mb-1 flex shrink-0 w-full items-center justify-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                >
                  <X className="h-3 w-3" /> Clear all
                </button>
              )}
              <div className="overflow-y-auto space-y-0.5 flex-1 min-h-0">
                {cities.map((c) => {
                  const checked = selected.includes(c.city)
                  return (
                    <div
                      key={c.city}
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(c.city)}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? "border-primary bg-primary"
                            : "border-border bg-background"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="flex-1 text-sm">{c.city}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {c.count.toLocaleString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>

      {/* Selected city tags */}
      {selected.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selected.map((city) => (
            <span
              key={city}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
            >
              {city}
              <button type="button" onClick={() => toggle(city)} className="hover:text-red-500">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function NewCampaignModal({
  open,
  onClose,
  onCreated,
  defaultFilters,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
  defaultFilters?: Partial<CreateCampaignPayload>
}) {
  const [form, setForm] = useState<CreateCampaignPayload>({
    name: "",
    templateName: "",
    audienceType: "PROSPECT",
    testOnly: false,
    whatsappConfidence: "verified",
    country: "",
    cities: [],
    source: "",
    outreachStatus: "NEW",
    subscriptionActiveOnly: false,
    limit: 250,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [testProspects, setTestProspects] = useState<LawyerProspect[]>([])
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([])
  const [loadingTestProspects, setLoadingTestProspects] = useState(false)

  // Template fetch state
  const [templates, setTemplates] = useState<WhatsappTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsappTemplate | null>(null)
  const [templateDiagnostics, setTemplateDiagnostics] = useState<WhatsappTemplateDiagnostics | null>(null)

  // Location fetch state
  const [countries, setCountries] = useState<{ country: string; count: number }[]>([])
  const [cities, setCities] = useState<{ city: string; count: number }[]>([])
  const [loadingCities, setLoadingCities] = useState(false)

  // Reset and fetch on open
  useEffect(() => {
    if (!open) return
    setForm({
      name: "",
      templateName: "",
      audienceType: "PROSPECT",
      testOnly: false,
      whatsappConfidence: "verified",
      country: "",
      cities: [],
      source: "",
      outreachStatus: "NEW",
      subscriptionActiveOnly: false,
      limit: 250,
      ...defaultFilters,
    })
    setError("")
    setSelectedTemplate(null)
    setTemplateDiagnostics(null)
    setCities([])
    setTestProspects([])
    setSelectedTestIds([])

    // Fetch templates
    setLoadingTemplates(true)
    listWhatsappTemplates()
      .then((result) => {
        // Gracefully handle both the new { templates, diagnostics } shape and
        // the legacy bare-array response from older backend deployments.
        const isLegacyArray = Array.isArray(result)
        const ts: WhatsappTemplate[] = isLegacyArray
          ? (result as unknown as WhatsappTemplate[])
          : (result.templates ?? [])
        const diags = isLegacyArray ? null : (result.diagnostics ?? null)
        setTemplates(ts)
        setTemplateDiagnostics(diags)
        // Auto-select first template if none pre-set
        if (ts.length > 0 && !defaultFilters?.templateName) {
          setForm((f) => ({ ...f, templateName: ts[0].name }))
          setSelectedTemplate(ts[0])
        } else if (defaultFilters?.templateName) {
          setSelectedTemplate(ts.find((t) => t.name === defaultFilters.templateName) ?? null)
        }
      })
      .catch((e: unknown) => {
        setTemplates([])
        setTemplateDiagnostics({
          reason: "meta_api_error",
          message: e instanceof Error ? e.message : "Failed to fetch templates from server.",
        })
      })
      .finally(() => setLoadingTemplates(false))

    // Fetch countries from stats
    getLawyerProspectStats()
      .then((s) =>
        setCountries(
          s.byCountry
            .filter((r) => r.country)
            .map((r) => ({ country: r.country as string, count: r.count }))
        )
      )
      .catch(() => setCountries([]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open || !form.testOnly) return
    setLoadingTestProspects(true)
    listLawyerProspects({ isTest: true, limit: 50 })
      .then((res) => {
        setTestProspects(res.items)
        setSelectedTestIds(res.items.map((p) => p.id))
      })
      .catch(() => {
        setTestProspects([])
        setSelectedTestIds([])
      })
      .finally(() => setLoadingTestProspects(false))
  }, [open, form.testOnly])

  // Fetch cities when country changes; reset selected cities
  useEffect(() => {
    if (!form.country) {
      setCities([])
      return
    }
    setLoadingCities(true)
    getCitiesForCountry(form.country)
      .then(setCities)
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false))
    // Reset city selection when country changes
    setForm((f) => ({ ...f, cities: [] }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.country])

  const handleTemplateChange = (templateName: string) => {
    const t = templates.find((t) => t.name === templateName) ?? null
    setSelectedTemplate(t)
    setForm((f) => ({ ...f, templateName }))
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Campaign name is required")
      return
    }
    if (!form.templateName) {
      setError("Select a template")
      return
    }
    if (form.testOnly && selectedTestIds.length === 0) {
      setError("Select at least one test user")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const payload: CreateCampaignPayload = {
        ...form,
        country: form.testOnly || form.audienceType === "USER" ? undefined : form.country || undefined,
        cities: form.testOnly || form.audienceType === "USER" ? undefined : form.cities?.length ? form.cities : undefined,
        source: form.testOnly || form.audienceType === "USER" ? undefined : form.source || undefined,
        whatsappConfidence:
          form.testOnly || form.audienceType === "USER" ? undefined : form.whatsappConfidence || undefined,
        outreachStatus:
          form.testOnly || form.audienceType === "USER" ? undefined : form.outreachStatus || undefined,
        testOnly: form.testOnly || undefined,
        testProspectIds: form.testOnly ? selectedTestIds : undefined,
        audienceType: form.testOnly ? "PROSPECT" : form.audienceType,
        userType: form.audienceType === "USER" ? form.userType || undefined : undefined,
        userCountryCode: form.audienceType === "USER" ? form.userCountryCode || undefined : undefined,
        subscriptionActiveOnly:
          form.audienceType === "USER" && form.subscriptionActiveOnly ? true : undefined,
        limit: form.limit ? Number(form.limit) : undefined,
      }
      await createWhatsappCampaign(payload)
      onCreated()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create campaign")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New WhatsApp Campaign</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Campaign name */}
          <div>
            <Label className="text-xs">Campaign Name</Label>
            <Input
              className="mt-1"
              placeholder="e.g. Launch Wave 1 – India Verified"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          {/* Template picker */}
          <div>
            <Label className="text-xs">Template</Label>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading templates…
              </div>
            ) : templates.length === 0 ? (
              <div className="mt-1 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 px-3 py-2 text-xs">
                {templateDiagnostics ? (
                  <>
                    <p className="font-medium text-amber-800 dark:text-amber-300">
                      {templateDiagnostics.reason === "not_configured"
                        ? "Server not configured"
                        : templateDiagnostics.reason === "meta_api_error"
                          ? "Meta API error"
                          : templateDiagnostics.reason === "all_filtered"
                            ? "No usable templates"
                            : "No templates found"}
                    </p>
                    <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                      {templateDiagnostics.message}
                    </p>
                    {templateDiagnostics.reason === "not_configured" && (
                      <p className="mt-1 text-amber-600 dark:text-amber-500">
                        Set the missing env var(s) on the server and restart the backend.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-amber-700 dark:text-amber-400">
                    No approved templates found. Create and get approval on Meta first.
                  </p>
                )}
              </div>
            ) : (
              <Select
                value={form.templateName || ANY_VALUE}
                onValueChange={(v) => handleTemplateChange(v === ANY_VALUE ? "" : v)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name}
                      <span className="ml-2 text-[10px] text-muted-foreground">{t.language}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Template preview bubble */}
            {selectedTemplate?.bodyText && (
              <div className="mt-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3">
                <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 mb-1 uppercase tracking-wide">
                  Preview
                </p>
                <p className="text-xs text-foreground whitespace-pre-wrap">
                  {previewBody(selectedTemplate.bodyText)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Variables: <span className="font-mono">{"{{1}}"}</span> = first name,{" "}
                  <span className="font-mono">{"{{2}}"}</span> = city
                </p>
              </div>
            )}
          </div>

          {/* Audience mode */}
          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-medium">Test users only</Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Send to selected test prospects only — ignores country/city filters
                </p>
              </div>
              <Switch
                checked={form.testOnly ?? false}
                onCheckedChange={(checked) =>
                  setForm((f) => ({
                    ...f,
                    testOnly: checked,
                    audienceType: checked ? "PROSPECT" : f.audienceType ?? "PROSPECT",
                  }))
                }
              />
            </div>

            {!form.testOnly && (
              <div>
                <Label className="text-xs">Audience</Label>
                <Select
                  value={form.audienceType ?? "PROSPECT"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      audienceType: v as "PROSPECT" | "USER",
                    }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROSPECT">Lawyer prospects</SelectItem>
                    <SelectItem value="USER">App users (WhatsApp opt-in)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {form.testOnly ? (
            <div>
              <Label className="text-xs">Test recipients</Label>
              {loadingTestProspects ? (
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading test users…
                </div>
              ) : testProspects.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  No test prospects found. Run the latest migration to seed the admin test user.
                </p>
              ) : (
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto rounded-md border border-border p-2">
                  {testProspects.map((p) => {
                    const checked = selectedTestIds.includes(p.id)
                    const phone = p.whatsapp ?? p.phone ?? "—"
                    return (
                      <label
                        key={p.id}
                        className="flex items-start gap-2 text-xs cursor-pointer rounded p-1.5 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setSelectedTestIds((ids) =>
                              v ? [...ids, p.id] : ids.filter((id) => id !== p.id),
                            )
                          }}
                        />
                        <span>
                          <span className="font-medium">{p.fullName}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {phone} · {p.city ?? "—"}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {selectedTestIds.length} test recipient{selectedTestIds.length === 1 ? "" : "s"} selected
              </p>
            </div>
          ) : form.audienceType === "USER" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">User type</Label>
                  <Select
                    value={form.userType ?? ANY_VALUE}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        userType: v === ANY_VALUE ? undefined : v,
                      }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY_VALUE}>All types</SelectItem>
                      <SelectItem value="CONSUMER">Consumer</SelectItem>
                      <SelectItem value="LAWYER">Lawyer</SelectItem>
                      <SelectItem value="LAW_FIRM">Law firm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Country code</Label>
                  <Input
                    className="mt-1"
                    placeholder="e.g. IN"
                    value={form.userCountryCode ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        userCountryCode: e.target.value.toUpperCase() || undefined,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border p-2">
                <Label className="text-xs">Active subscription only</Label>
                <Switch
                  checked={form.subscriptionActiveOnly ?? false}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, subscriptionActiveOnly: checked }))
                  }
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Only users with WhatsApp marketing opt-in and a phone number on file are included.
              </p>
            </div>
          ) : (
            <>
          {/* Location: Country → City */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Country</Label>
              <Select
                value={form.country || ANY_VALUE}
                onValueChange={(v) => {
                  const country = v === ANY_VALUE ? "" : v
                  setForm((f) => ({ ...f, country, city: "" }))
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_VALUE}>All countries</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c.country} value={c.country}>
                      {c.country}
                      <span className="ml-1.5 text-[10px] text-muted-foreground">({c.count.toLocaleString()})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">
                Cities
                {loadingCities && <Loader2 className="inline h-2.5 w-2.5 animate-spin ml-1" />}
              </Label>
              <CityMultiSelect
                cities={cities}
                selected={form.cities ?? []}
                onChange={(v) => setForm((f) => ({ ...f, cities: v }))}
                disabled={!form.country}
                loading={loadingCities}
              />
            </div>
          </div>

          {/* Confidence + Outreach status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">WhatsApp Confidence</Label>
              <Select
                value={form.whatsappConfidence ?? ANY_VALUE}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    whatsappConfidence: v === ANY_VALUE ? undefined : v,
                  }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Any (includes phone fallback)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_VALUE}>Any (incl. phone fallback)</SelectItem>
                  <SelectItem value="verified">Verified only</SelectItem>
                  <SelectItem value="high">High confidence</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Outreach Status</Label>
              <Select
                value={form.outreachStatus ?? "NEW"}
                onValueChange={(v) => setForm((f) => ({ ...f, outreachStatus: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="CONTACTED">Contacted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

            </>
          )}

          {/* Max recipients — all modes */}
          <div>
            <Label className="text-xs">Max recipients</Label>
            <Input
              className="mt-1"
              type="number"
              min={1}
              max={5000}
              value={form.limit ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, limit: Number(e.target.value) }))}
            />
          </div>

          {form.testOnly && (
            <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3 text-xs text-blue-800 dark:text-blue-200">
              Test mode sends only to the selected test prospects. Use this before a real rollout.
            </div>
          )}

          {!form.testOnly && form.audienceType !== "USER" && (
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200">
            <strong>Rollout strategy:</strong> Day 1–2 send ≤250 verified prospects, expand to high confidence if quality rating is GREEN, then full list at 500/day.
            <br />
            <strong>Phone fallback:</strong> Prospects without a confirmed WhatsApp number will be tried via their phone number. Failed sends auto-clear the number.
          </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || loadingTemplates}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Start Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminWhatsappCampaignsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <AdminWhatsappCampaignsPageInner />
    </Suspense>
  )
}

function AdminWhatsappCampaignsPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<WhatsappCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modalDefaults, setModalDefaults] = useState<Partial<CreateCampaignPayload>>({})
  const [deleteTarget, setDeleteTarget] = useState<WhatsappCampaign | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [diagnostics, setDiagnostics] = useState<WhatsappDiagnostics | null>(null)

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    listWhatsappCampaigns()
      .then((data) => setCampaigns(Array.isArray(data) ? data : []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => {
        if (!silent) setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
    getWhatsappDiagnostics()
      .then(setDiagnostics)
      .catch(() => setDiagnostics(null))
  }, [load])

  // Poll while any campaign is still sending
  useEffect(() => {
    const needsPoll = campaigns.some(
      (c) =>
        c.status === "RUNNING" &&
        c.totalSent + c.totalFailed < c.totalQueued,
    )
    if (!needsPoll) return
    const id = window.setInterval(() => load(true), 5000)
    return () => window.clearInterval(id)
  }, [campaigns, load])

  useEffect(() => {
    const city = searchParams.get("city")
    const source = searchParams.get("source")
    const country = searchParams.get("country")
    const whatsappConfidence = searchParams.get("whatsappConfidence")
    const shouldOpen =
      searchParams.get("new") === "1" || city || source || country || whatsappConfidence
    if (!shouldOpen) return

    setModalDefaults({
      country: country ?? undefined,
      cities: city ? [city] : undefined,
      source: source ?? undefined,
      whatsappConfidence: whatsappConfidence ?? undefined,
    })
    setShowModal(true)
    router.replace("/admin/whatsapp-campaigns")
  }, [searchParams, router])

  const handlePause = async (id: string) => {
    await pauseWhatsappCampaign(id)
    load()
  }

  const handleResume = async (id: string) => {
    await resumeWhatsappCampaign(id)
    load()
  }

  const handleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setError("")
    try {
      await deleteWhatsappCampaign(deleteTarget.id)
      if (expandedId === deleteTarget.id) setExpandedId(null)
      setDeleteTarget(null)
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete campaign")
    } finally {
      setDeleting(false)
    }
  }

  const totalQueued = campaigns.reduce((s, c) => s + c.totalQueued, 0)
  const totalSent = campaigns.reduce((s, c) => s + c.totalSent, 0)
  const totalDelivered = campaigns.reduce((s, c) => s + c.totalDelivered, 0)
  const totalRead = campaigns.reduce((s, c) => s + c.totalRead, 0)
  const totalFailed = campaigns.reduce((s, c) => s + c.totalFailed, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">WhatsApp Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Send templated launch messages to lawyer prospects via Meta Cloud API
          </p>
          {diagnostics && (
            <p className="text-xs text-muted-foreground mt-1">
              API WhatsApp config:{" "}
              {diagnostics.apiConfigured ? (
                <>
                  OK · Phone Number ID{" "}
                  <span className="font-mono">{diagnostics.phoneNumberId ?? "—"}</span>
                </>
              ) : (
                <span className="text-amber-600">Missing {diagnostics.missing.join(", ")}</span>
              )}
            </p>
          )}
        </div>
        <Button
          onClick={() => {
            setModalDefaults({})
            setShowModal(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Total Queued", value: totalQueued },
          { label: "Sent", value: totalSent },
          { label: "Delivered", value: totalDelivered },
          { label: "Read", value: totalRead },
          { label: "Failed", value: totalFailed, className: totalFailed > 0 ? "text-red-500" : undefined },
        ].map(({ label, value, className }) => (
          <Card key={label}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className={`text-2xl font-semibold ${className ?? ""}`}>{value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No campaigns yet</p>
          <Button
            className="mt-4"
            onClick={() => {
              setModalDefaults({})
              setShowModal(true)
            }}
          >
            Create your first campaign
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <CampaignRow
              key={c.id}
              campaign={c}
              onPause={handlePause}
              onResume={handleResume}
              onDelete={setDeleteTarget}
              onExpand={handleExpand}
              expanded={expandedId === c.id}
            />
          ))}
        </div>
      )}

      <NewCampaignModal
        open={showModal}
        onClose={() => {
          setShowModal(false)
          setModalDefaults({})
        }}
        onCreated={load}
        defaultFilters={modalDefaults}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete campaign?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete <strong>{deleteTarget?.name}</strong> and all
            {" "}{deleteTarget?.totalQueued ?? 0} queued message(s). This cannot be undone.
          </p>
          {deleteTarget?.status === "RUNNING" && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              This campaign is still running. Pending messages will be cancelled before deletion.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
