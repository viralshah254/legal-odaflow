"use client"
import { useTranslations } from "next-intl"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, ArrowRight, ChevronDown, Loader2, MapPin } from "lucide-react"
import { CharCountBadge } from "./char-count-badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getStateOptions, hasStateDropdown, matchRegionToStateOption } from "@/lib/geo/country-states"
import { isTier1Country, COUNTRY_NAMES, TIER1_COUNTRY_CODES, inferCountryFromText } from "@/lib/geo/detect-country"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import type { CountryCode, UrgencyLevel } from "@/lib/api/types"
import type { IssueCheckerMode, IssueCheckerWizardData } from "./constants"
import { useIssueCheckerCaptcha } from "@/lib/captcha/issue-checker-captcha"

const MIN_FACTS_CHARS = 20
const MAX_FACTS_CHARS = 3000

// Build country list: tier-1 first, then others alphabetically
const ALL_COUNTRY_OPTIONS = (() => {
  const tier1 = TIER1_COUNTRY_CODES.map((code) => ({
    value: code,
    label: COUNTRY_NAMES[code] ?? code,
    tier: 1 as const,
  }))
  const others = Object.entries(COUNTRY_NAMES)
    .filter(([code]) => !TIER1_COUNTRY_CODES.includes(code) && code !== "OTHER")
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([code, label]) => ({ value: code, label, tier: 2 as const }))
  const other = [{ value: "OTHER", label: COUNTRY_NAMES.OTHER ?? "Other / Not listed", tier: 2 as const }]
  return [...tier1, ...others, ...other]
})()

export interface IntakeMicroFlowResult {
  facts: string
  mode: IssueCheckerMode
  countryCode: CountryCode
  jurisdiction: string
  planningAnswers?: Record<string, string | string[]>
  /** Set when classify ran — avoids a redundant classify after handoff. */
  issueType?: string
  title?: string
  urgencyLevel?: UrgencyLevel
  parties?: string
  suggestedClientName?: string
}

interface IssueIntakeMicroFlowProps {
  initialData?: Partial<IssueCheckerWizardData>
  initialMode?: IssueCheckerMode
  /** @deprecated no longer used — classification happens in the wizard */
  issueType?: string
  onComplete: (result: IntakeMicroFlowResult) => void
  /** @deprecated role selection removed from pre-analysis flow */
  showFirmIntake?: boolean
  compact?: boolean
  layoutWide?: boolean
  /** Landing mobile hero — larger input and continue button. */
  heroFocus?: boolean
}

export function IssueIntakeMicroFlow({
  initialData,
  initialMode = "SELF",
  onComplete,
  compact = false,
  layoutWide = false,
  heroFocus = false,
}: IssueIntakeMicroFlowProps) {
  const t = useTranslations("issueChecker")
  const tCommon = useTranslations("common")
  const { countryCode: detectedCountry, detectedRegion, isLoading: countryDetecting, setCountryCode: persistCountryCode } = useDetectedCountry()
  const { captchaReady, captchaRequired } = useIssueCheckerCaptcha()

  const [facts, setFacts] = useState(initialData?.facts ?? "")
  const [countryCode, setCountryCode] = useState<CountryCode>(
    initialData?.countryCode ?? "",
  )
  const [jurisdiction, setJurisdiction] = useState(initialData?.jurisdiction ?? "")

  const detecting =
    countryDetecting || (!initialData?.countryCode && !countryCode)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const locationUserEdited = useRef(false)

  const { preferredCountryOption, tier1CountryOptions, tier2CountryOptions } = useMemo(() => {
    const preferred = countryCode?.toUpperCase()
    const preferredOpt = preferred
      ? ALL_COUNTRY_OPTIONS.find((o) => o.value === preferred)
      : null
    const rest = preferredOpt
      ? ALL_COUNTRY_OPTIONS.filter((o) => o.value !== preferred)
      : ALL_COUNTRY_OPTIONS
    return {
      preferredCountryOption: preferredOpt,
      tier1CountryOptions: rest.filter((o) => o.tier === 1),
      tier2CountryOptions: rest.filter((o) => o.tier !== 1),
    }
  }, [countryCode])

  useEffect(() => {
    if (!compact || heroFocus) textareaRef.current?.focus()
  }, [compact, heroFocus])

  // Pre-fill country + state from IP geo as soon as context resolves.
  useEffect(() => {
    if (initialData?.countryCode) return
    if (locationUserEdited.current) return
    if (countryDetecting) return
    if (!detectedCountry) return

    const textInferred = inferCountryFromText(facts)
    const resolved = (textInferred ?? detectedCountry) as CountryCode
    setCountryCode(resolved)

    if (!textInferred && detectedRegion) {
      const match = matchRegionToStateOption(resolved, detectedRegion)
      if (match) setJurisdiction(match)
    }
  }, [countryDetecting, detectedCountry, detectedRegion, facts, initialData?.countryCode])

  const trimmedFactsLen = facts.trim().length
  const factsReady = trimmedFactsLen >= MIN_FACTS_CHARS

  const handleSubmit = () => {
    if (!factsReady || !countryCode) return
    if (captchaRequired && !captchaReady) return
    onComplete({ facts, mode: initialMode, countryCode, jurisdiction })
  }

  const countrySelectContent = (
    <SelectContent className="max-h-72">
      {preferredCountryOption && (
        <>
          <SelectItem key={`pref-${preferredCountryOption.value}`} value={preferredCountryOption.value}>
            {preferredCountryOption.label}
          </SelectItem>
          <div className="my-1 border-t" />
        </>
      )}
      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {t("fullLegalDatabase")}
      </div>
      {tier1CountryOptions.map((opt) => (
        <SelectItem key={opt.value} value={opt.value}>
          {opt.label}
        </SelectItem>
      ))}
      <div className="px-2 py-1.5 mt-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-t">
        {t("bestEffortAnalysis")}
      </div>
      {tier2CountryOptions.map((opt) => (
        <SelectItem key={opt.value} value={opt.value}>
          {opt.label}
        </SelectItem>
      ))}
    </SelectContent>
  )

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      <div className="space-y-2" data-tour="intake-issue-input">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            rows={heroFocus ? 7 : compact ? (layoutWide ? 4 : 3) : layoutWide ? 6 : 5}
            placeholder={t("microFlowFactsPlaceholder")}
            value={facts}
            onChange={(e) => setFacts(e.target.value)}
            maxLength={MAX_FACTS_CHARS}
            className={cn(
              "landing-textarea resize-none transition-shadow focus:shadow-md",
              heroFocus
                ? "text-[15px] sm:text-base font-medium min-h-[9.5rem] leading-relaxed"
                : compact
                  ? "text-sm"
                  : "text-[15px] sm:text-base font-medium",
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && factsReady) {
                e.preventDefault()
                handleSubmit()
              }
            }}
          />
          <div className="absolute bottom-2 right-2 pointer-events-none">
            <CharCountBadge current={trimmedFactsLen} min={MIN_FACTS_CHARS} max={MAX_FACTS_CHARS} />
          </div>
        </div>

        {/* Country chip + jurisdiction — always visible */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={countryCode || undefined}
            onValueChange={(v) => {
              locationUserEdited.current = true
              const code = v as CountryCode
              setCountryCode(code)
              persistCountryCode(code)
              setJurisdiction("")
            }}
            disabled={detecting}
          >
            <SelectTrigger
              className={cn(
                "h-7 w-auto px-2.5 rounded-full border border-border/60 bg-background text-xs font-medium gap-1 focus:ring-0 shadow-none",
                "[&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground [&>svg]:shrink-0",
              )}
            >
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
              <SelectValue placeholder={detecting ? tCommon("loading") : t("select_country")} />
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </SelectTrigger>
            {countrySelectContent}
          </Select>

          {countryCode && hasStateDropdown(countryCode) && (
            <Select
              value={jurisdiction || undefined}
              onValueChange={(v) => {
                locationUserEdited.current = true
                setJurisdiction(v)
              }}
            >
              <SelectTrigger className="h-7 w-auto max-w-[10rem] px-2.5 rounded-full border border-border/60 bg-background text-xs font-medium gap-1 focus:ring-0 shadow-none [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0">
                <SelectValue placeholder={countryCode === "KE" ? t("countyOptional") : t("stateRegionOptional")} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {getStateOptions(countryCode).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {countryCode && !isTier1Country(countryCode) && countryCode !== "OTHER" && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {t("tier2CoverageNotice", { countries: t("india_us_kenya_and_uk") })}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{t("microFlowFactsHelper")}</p>

        <div className="flex items-center justify-end gap-3">
          <Button
            size={heroFocus ? "lg" : compact ? "sm" : "default"}
            onClick={handleSubmit}
            disabled={!factsReady || (captchaRequired && !captchaReady)}
            className="shrink-0 group active:scale-[0.97] transition-transform"
            data-tour="intake-continue"
          >
            {captchaRequired && !captchaReady ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {tCommon("loading")}
              </>
            ) : (
              <>
                {t("checkMySituation")}
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
