"use client"
import { useTranslations } from "next-intl"

import { useEffect, useMemo, useRef, useState } from "react"
import { ConflictCheckPanel } from "@/components/conflicts/ConflictCheckPanel"
import { AlertTriangle, Check, Clock, Flame, Loader2, Plus, Search, Zap } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  INTAKE_OUTCOME_ROW_CLASSES,
  type IssueCheckerMode,
  type IssueCheckerWizardData,
} from "./constants"
import type { UrgencyLevel } from "@/lib/api/types"
import { useIssueCheckerLabels, issueTypeToPracticeAreaSlug } from "@/lib/i18n/use-issue-checker-labels"
import { listClients } from "@/lib/api/clients"
import { listMatters } from "@/lib/api/matters"
import { getOutcomeOptions } from "@/lib/api/consumers"
import { getDeviceId } from "@/lib/device/device-id"
import { useTenant } from "@/lib/contexts/tenant-context"
import type { ApiClient } from "@/lib/api/types"

// Terms that indicate the lawyer is describing themselves instead of a client.
const SELF_REFERENTIAL_TERMS = new Set([
  "you", "i", "me", "myself", "us", "we", "our", "the client",
])

export function isSelfReferentialClientName(name: string): boolean {
  return SELF_REFERENTIAL_TERMS.has(name.trim().toLowerCase())
}

interface DetailsStepProps {
  mode: IssueCheckerMode
  data: IssueCheckerWizardData
  onChange: (partial: Partial<IssueCheckerWizardData>) => void
  /** Inferred parties from AI classification */
  classificationParties?: string
  /** Client name extracted from facts by AI — pre-fills the client name field */
  suggestedClientName?: string
  /** Outcome phrases from classify — shown immediately, then refined by outcome-options AI */
  suggestedOutcomes?: string[]
  layoutWide?: boolean
}

const URGENCY_CONFIG: Record<string, { icon: React.ElementType; color: string; activeClass: string }> = {
  LOW: {
    icon: Clock,
    color: "text-emerald-600",
    activeClass: "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  MEDIUM: {
    icon: AlertTriangle,
    color: "text-amber-600",
    activeClass: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  HIGH: {
    icon: Zap,
    color: "text-orange-600",
    activeClass: "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  },
  URGENT: {
    icon: Flame,
    color: "text-red-600",
    activeClass: "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400",
  },
}

export function DetailsStep({ mode, data, onChange, classificationParties, suggestedClientName, suggestedOutcomes, layoutWide = false }: DetailsStepProps) {
  const tClients = useTranslations("clients")
  const t = useTranslations("issueChecker")
  const tCommon = useTranslations("common")
  const { urgencyOptions } = useIssueCheckerLabels()
  const { activeTenantId } = useTenant()

  // Client search state
  const [clientSearch, setClientSearch] = useState(data.clientName ?? "")
  const [clientResults, setClientResults] = useState<ApiClient[]>([])
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false)
  const [clientSearchLoading, setClientSearchLoading] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Matter / file number state
  const [matterOptions, setMatterOptions] = useState<Array<{ id: string; label: string }>>([])
  const [mattersLoading, setMattersLoading] = useState(false)
  const [showNewFileInput, setShowNewFileInput] = useState(false)
  const [newFileValue, setNewFileValue] = useState("")

  // Outcome options state
  const [outcomeOptions, setOutcomeOptions] = useState<string[]>([])
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([])
  const [outcomeOther, setOutcomeOther] = useState("")
  const [outcomeLoading, setOutcomeLoading] = useState(false)
  const didLoadOutcomes = useRef(false)

  // Auto-fill parties from classification if not yet set.
  useEffect(() => {
    if (classificationParties && !data.parties) {
      onChange({ parties: classificationParties })
    }
  }, [classificationParties]) // eslint-disable-line react-hooks/exhaustive-deps

  // Track whether we've applied an AI-suggested client name so we only do it once.
  const didApplySuggestedName = useRef(false)

  // Auto-fill client name from AI suggestion when the field is empty (FIRM_INTAKE only).
  useEffect(() => {
    if (
      mode !== "FIRM_INTAKE" ||
      !suggestedClientName ||
      data.clientName ||
      didApplySuggestedName.current ||
      isSelfReferentialClientName(suggestedClientName)
    ) return
    didApplySuggestedName.current = true
    setClientSearch(suggestedClientName)
    onChange({ clientName: suggestedClientName })
  }, [suggestedClientName]) // eslint-disable-line react-hooks/exhaustive-deps

  // Seed from classify AI, then refine with a dedicated outcome-options call.
  useEffect(() => {
    if (suggestedOutcomes?.length) {
      setOutcomeOptions(suggestedOutcomes)
    }
  }, [suggestedOutcomes])

  useEffect(() => {
    if (didLoadOutcomes.current || !data.facts) return

    didLoadOutcomes.current = true
    setOutcomeLoading(true)
    getOutcomeOptions({
      facts: data.facts,
      countryCode: data.countryCode,
      practiceArea: data.issueType || undefined,
      deviceFingerprint: getDeviceId() ?? undefined,
    })
      .then((res) => {
        if (res.options.length >= 2) setOutcomeOptions(res.options)
      })
      .catch(() => {/* keep classify suggestions */})
      .finally(() => {
        setOutcomeLoading(false)
      })
  }, [data.countryCode, data.facts, data.issueType])

  // Debounced client search
  useEffect(() => {
    if (!activeTenantId || mode !== "FIRM_INTAKE" || !clientSearch.trim()) {
      setClientResults([])
      return
    }
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      setClientSearchLoading(true)
      try {
        const results = await listClients(activeTenantId, clientSearch)
        setClientResults(results.slice(0, 8))
      } catch {/* ignore */}
      finally { setClientSearchLoading(false) }
    }, 300)
    return () => { if (searchRef.current) clearTimeout(searchRef.current) }
  }, [clientSearch, activeTenantId, mode])

  // Load matters when a client is selected
  useEffect(() => {
    if (!data.clientId || !activeTenantId) return
    setMattersLoading(true)
    setShowNewFileInput(false)
    setNewFileValue("")
    listMatters(activeTenantId)
      .then((matters) => {
        const clientMatters = matters.filter((m) => m.clientId === data.clientId)
        setMatterOptions(clientMatters.map((m) => ({
          id: m.id,
          label: m.caseNumber ? `${m.caseNumber} — ${m.title}` : m.title,
        })))
      })
      .catch(() => setMatterOptions([]))
      .finally(() => setMattersLoading(false))
  }, [data.clientId, activeTenantId])

  const generateFileNumber = (existingCount: number) => {
    const year = new Date().getFullYear()
    const next = String(existingCount + 1).padStart(3, "0")
    return `MAT-${year}-${next}`
  }

  const openNewFileInput = () => {
    const generated = generateFileNumber(matterOptions.length)
    setNewFileValue(generated)
    setShowNewFileInput(true)
    onChange({ clientReference: generated })
  }

  const closeNewFileInput = () => {
    setShowNewFileInput(false)
    setNewFileValue("")
    onChange({ clientReference: undefined })
  }

  const selectClient = (client: ApiClient) => {
    onChange({ clientName: client.name, clientId: client.id })
    setClientSearch(client.name)
    setClientDropdownOpen(false)
  }

  const toggleOutcome = (opt: string) => {
    const next = selectedOutcomes.includes(opt)
      ? selectedOutcomes.filter((o) => o !== opt)
      : [...selectedOutcomes, opt]
    setSelectedOutcomes(next)
    const combined = [
      ...next,
      ...(outcomeOther.trim() ? [outcomeOther.trim()] : []),
    ].join("; ")
    onChange({ desiredOutcome: combined })
  }

  const handleOtherOutcome = (v: string) => {
    setOutcomeOther(v)
    const combined = [
      ...selectedOutcomes,
      ...(v.trim() ? [v.trim()] : []),
    ].join("; ")
    onChange({ desiredOutcome: combined })
  }

  const conflictParties = useMemo(() => {
    const parties: Array<{ name?: string; email?: string }> = []
    const clientName = data.clientName.trim()
    if (clientName) parties.push({ name: clientName })
    const raw = data.parties.trim()
    if (raw) {
      for (const part of raw.split(/\s+(?:vs\.?|v\.|and|&|,|;)\s+/i)) {
        const name = part.trim()
        if (name && name.toLowerCase() !== clientName.toLowerCase()) {
          parties.push({ name })
        }
      }
    }
    return parties
  }, [data.clientName, data.parties])

  return (
    <div className="space-y-6">
      {/* Firm intake: client name (combobox) + reference / file number */}
      {mode === "FIRM_INTAKE" && (
        <div className="space-y-4 p-4 rounded-xl border bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{tClients("clientDetails")}</p>
          <div className={cn("grid gap-4", layoutWide ? "lg:grid-cols-2" : "sm:grid-cols-2")}>
            {/* Client name combobox */}
            <div className="space-y-1.5 relative">
              <Label htmlFor="clientName">{tClients("clientName")}<span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  id="clientName"
                  className={cn("pl-8", isSelfReferentialClientName(clientSearch) && "border-destructive focus-visible:ring-destructive")}
                  placeholder={tCommon("search_existing_clients")}
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value)
                    onChange({ clientName: e.target.value, clientId: undefined })
                    setClientDropdownOpen(true)
                  }}
                  onFocus={() => setClientDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setClientDropdownOpen(false), 150)}
                  autoComplete="off"
                />
                {clientSearchLoading && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
              {isSelfReferentialClientName(clientSearch) && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {t("clientNameCannotBeSelf")}
                </p>
              )}
              {suggestedClientName && clientSearch === suggestedClientName && !data.clientId && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60" />
                  {t("aiSuggestedEditFreely")}
                </span>
              )}
              {/* Dropdown */}
              {clientDropdownOpen && (clientResults.length > 0 || clientSearch.trim()) && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border bg-background shadow-lg overflow-hidden">
                  {clientResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => selectClient(c)}
                      className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors"
                    >
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                      </div>
                      {data.clientId === c.id && <Check className="h-3.5 w-3.5 text-primary ml-auto shrink-0 mt-1" />}
                    </button>
                  ))}
                  {clientSearch.trim() && (
                    <button
                      type="button"
                      onMouseDown={() => {
                        onChange({ clientName: clientSearch, clientId: undefined })
                        setClientDropdownOpen(false)
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/60 border-t text-sm text-muted-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Use &quot;{clientSearch}&quot; {t("useAsNewClient")}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* File / matter number */}
            <div className="space-y-1.5">
              <Label htmlFor="clientReference">
                {t("reference_file_number")}{" "}
                <span className="text-muted-foreground text-xs font-normal">{t("optional")}</span>
              </Label>
              {data.clientId && matterOptions.length > 0 && !showNewFileInput ? (
                <Select
                  value={data.clientReference || undefined}
                  onValueChange={(v) => {
                    if (v === "__new__") {
                      openNewFileInput()
                    } else {
                      onChange({ clientReference: v })
                    }
                  }}
                >
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue placeholder={t("select_existing_matter_or_type_new")} />
                  </SelectTrigger>
                  <SelectContent>
                    {matterOptions.map((m) => (
                      <SelectItem key={m.id} value={m.label}>{m.label}</SelectItem>
                    ))}
                    <SelectItem value="__new__">{t("enter_new_file_number")}</SelectItem>
                  </SelectContent>
                </Select>
              ) : showNewFileInput ? (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <Input
                      id="clientReference"
                      value={newFileValue}
                      onChange={(e) => {
                        setNewFileValue(e.target.value)
                        onChange({ clientReference: e.target.value })
                      }}
                      placeholder={t("eg_mat-2026-001")}
                      autoFocus
                    />
                    {matterOptions.length > 0 && (
                      <button
                        type="button"
                        onClick={closeNewFileInput}
                        className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap shrink-0"
                      >
                        ← {tCommon("back")}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("auto-generated_edit_if_needed")}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Input
                    id="clientReference"
                    placeholder={mattersLoading ? t("loadingMatters") : t("eg_mat-2026-001")}
                    value={data.clientReference ?? ""}
                    onChange={(e) => onChange({ clientReference: e.target.value })}
                    disabled={mattersLoading}
                  />
                  {!data.clientId && !mattersLoading && (
                    <p className="text-xs text-muted-foreground">{t("select_a_client_above_to_link_to_an_existing_matter")}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Urgency */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-semibold">{t("how_urgent_is_this")}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{t("pick_the_closest_match_you_can_update_this_later")}</p>
        </div>
        <div className={cn("grid gap-2", layoutWide ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-4")}>
          {urgencyOptions.map((option) => {
            const config = URGENCY_CONFIG[option.value]
            const Icon = config?.icon ?? Clock
            const isSelected = data.urgencyLevel === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ urgencyLevel: option.value as UrgencyLevel })}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-left transition-all hover:shadow-sm",
                  isSelected
                    ? config?.activeClass ?? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted/50 hover:border-muted-foreground/30",
                )}
              >
                <Icon className={cn("h-4 w-4", isSelected ? "" : config?.color)} />
                <span className="text-sm font-medium">{option.short}</span>
                <span className="text-xs text-muted-foreground text-center leading-tight hidden sm:block">
                  {option.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Parties — auto-filled from classification */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="parties" className="text-sm font-semibold">{t("who_is_involved")}</Label>
          {classificationParties && data.parties === classificationParties && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60" />
              {t("aiSuggestedEditFreely")}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("people_or_organisations_in_this_dispute")}</p>
        <Textarea
          id="parties"
          rows={2}
          placeholder={t("eg_my_employer_and_hr_manager_or_the_counterparty_in_a_contr")}
          value={data.parties}
          onChange={(e) => onChange({ parties: e.target.value })}
          className="resize-none"
        />
      </div>

      {mode === "FIRM_INTAKE" && activeTenantId && (
        <ConflictCheckPanel
          tenantId={activeTenantId}
          clientId={data.clientId}
          parties={conflictParties}
          autoRun
        />
      )}

      {/* Desired outcome — AI chip options */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">{t("what_outcome_do_you_want")}</Label>
        <p className="text-xs text-muted-foreground">{t("select_all_that_apply_you_can_choose_multiple")}</p>

        {outcomeLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("generatingOutcomeOptions")}
          </div>
        ) : (
          <div className="flex flex-col gap-2 w-full min-w-0">
            {outcomeOptions.map((opt) => {
              const isSelected = selectedOutcomes.includes(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleOutcome(opt)}
                  className={cn(
                    INTAKE_OUTCOME_ROW_CLASSES,
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:border-primary/60 hover:bg-primary/5",
                  )}
                >
                  <Check
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      isSelected ? "opacity-100" : "opacity-30",
                    )}
                  />
                  <span className="min-w-0 flex-1 whitespace-normal break-words">{opt}</span>
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => {
                if (outcomeOther) {
                  setOutcomeOther("")
                  const combined = selectedOutcomes.join("; ")
                  onChange({ desiredOutcome: combined })
                }
              }}
              className="flex w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium bg-background border-border hover:border-primary/60 hover:bg-primary/5"
            >
              + {t("otherOption")}
            </button>
          </div>
        )}

        {/* "Other" free-text + additional context */}
        <Textarea
          rows={2}
          placeholder={
            outcomeOptions.length > 0
              ? t("outcomeMoreContextPlaceholder")
              : t("outcomeResolutionPlaceholder")
          }
          value={outcomeOther || (outcomeOptions.length === 0 ? data.desiredOutcome : "")}
          onChange={(e) => handleOtherOutcome(e.target.value)}
          className="resize-none text-sm"
        />
      </div>

      {/* Internal notes (firm only) */}
      {mode === "FIRM_INTAKE" && (
        <div className="space-y-1.5">
          <Label htmlFor="internalNotes" className="text-sm font-semibold">
            {t("internalNotes")} <span className="text-muted-foreground text-xs font-normal">{t("optional")}</span>
          </Label>
          <p className="text-xs text-muted-foreground">{t("confidential_not_shared_with_the_client_preview")}</p>
          <Textarea
            id="internalNotes"
            rows={2}
            placeholder={t("eg_high-value_client_refer_to_partner_before_settlement_disc")}
            value={data.internalNotes}
            onChange={(e) => onChange({ internalNotes: e.target.value })}
            className="resize-none"
          />
        </div>
      )}
    </div>
  )
}
