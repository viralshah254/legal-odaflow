"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import type { CountryCode } from "@/lib/api/types"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ALL_REGIONS_VALUE, getStateOptions } from "@/lib/geo/country-states"
import {
  getCountryName,
  COUNTRY_NAMES,
  TIER1_COUNTRY_CODES,
} from "@/lib/geo/detect-country"
import { Info, MapPin } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/** Tier-1 countries pinned at the top of the picker. */
const TIER1_OPTIONS: { value: CountryCode; label: string }[] = TIER1_COUNTRY_CODES.map((code) => ({
  value: code,
  label: COUNTRY_NAMES[code] ?? code,
}))

/** All remaining countries, sorted alphabetically by label, excluding tier-1 and "OTHER". */
const OTHER_OPTIONS: { value: CountryCode; label: string }[] = Object.entries(COUNTRY_NAMES)
  .filter(([code]) => !TIER1_COUNTRY_CODES.includes(code) && code !== "OTHER")
  .map(([code, label]) => ({ value: code, label }))
  .sort((a, b) => a.label.localeCompare(b.label))

const OTHER_OPTION: { value: CountryCode; label: string } = { value: "OTHER", label: COUNTRY_NAMES["OTHER"] ?? "Other" }

function buildCountrySelectOptions(preferredCode?: string) {
  const preferred = preferredCode?.toUpperCase()
  const all = [...TIER1_OPTIONS, ...OTHER_OPTIONS, OTHER_OPTION]
  if (!preferred) return { preferredOption: null as typeof TIER1_OPTIONS[number] | null, rest: all }

  const match = all.find((o) => o.value === preferred)
  if (!match) return { preferredOption: null, rest: all }
  return { preferredOption: match, rest: all.filter((o) => o.value !== preferred) }
}

function CountrySelectItems({
  preferredCode,
}: {
  preferredCode?: string
}) {
  const { preferredOption, rest } = buildCountrySelectOptions(preferredCode)
  const tier1 = rest.filter((o) => TIER1_COUNTRY_CODES.includes(o.value))
  const others = rest.filter((o) => !TIER1_COUNTRY_CODES.includes(o.value) && o.value !== "OTHER")
  const other = rest.find((o) => o.value === "OTHER")

  return (
    <>
      {preferredOption && (
        <>
          <SelectItem key={`pref-${preferredOption.value}`} value={preferredOption.value}>
            {preferredOption.label}
          </SelectItem>
          <Separator className="my-1" />
        </>
      )}
      {tier1.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
      {others.length > 0 && (
        <>
          <Separator className="my-1" />
          {others.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </>
      )}
      {other && (
        <>
          <Separator className="my-1" />
          <SelectItem value={other.value}>{other.label}</SelectItem>
        </>
      )}
    </>
  )
}

type CountryConfirmVariant = "default" | "compact" | "inline"

interface CountryConfirmStepProps {
  countryCode: CountryCode
  jurisdiction: string
  onCountryChange: (code: CountryCode) => void
  onJurisdictionChange: (value: string) => void
  variant?: CountryConfirmVariant
  /** @deprecated Use variant="compact" */
  compact?: boolean
  hideCountry?: boolean
  /** Show helper linking to profile defaults (firm intake). */
  showProfileHint?: boolean
  /** True while geo-detection is in progress — shows a subtle loading state. */
  isDetecting?: boolean
  /** Optional helper shown under the country label (e.g. synced from phone). */
  countryHelperText?: string
}

function ProfileHintTooltip({
  profileLinkLabel,
  changeIfElsewhere,
}: {
  profileLinkLabel: string
  changeIfElsewhere: string
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Jurisdiction defaults"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
          Defaults from your{" "}
          <Link href="/app/profile" className="text-primary underline-offset-2 hover:underline">
            {profileLinkLabel}
          </Link>
          . {changeIfElsewhere}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function CountryConfirmStep({
  countryCode,
  jurisdiction,
  onCountryChange,
  onJurisdictionChange,
  variant,
  compact = false,
  hideCountry = false,
  showProfileHint = false,
  isDetecting = false,
  countryHelperText,
}: CountryConfirmStepProps) {
  const tCommon = useTranslations("common")
  const t = useTranslations("issueChecker")
  const normalizedCode = countryCode?.toUpperCase() || ""
  const countryLabel = getCountryName(normalizedCode) || normalizedCode
  const effectiveVariant: CountryConfirmVariant = variant ?? (compact ? "compact" : "default")
  const isCompactLike = effectiveVariant === "compact" || effectiveVariant === "inline"

  const stateOptions = getStateOptions(normalizedCode)
  const statePlaceholder =
    normalizedCode === "US"
      ? t("state_optional")
      : normalizedCode === "KE"
        ? t("countyOptional")
        : t("stateRegionOptional")

  const jurisdictionField = normalizedCode ? (
    <Select
      value={jurisdiction || ALL_REGIONS_VALUE}
      onValueChange={onJurisdictionChange}
    >
      <SelectTrigger
        className={
          isCompactLike
            ? "h-9 w-full sm:w-auto sm:min-w-[140px] bg-background text-foreground"
            : "text-foreground"
        }
      >
        <SelectValue placeholder={statePlaceholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={ALL_REGIONS_VALUE}>{ALL_REGIONS_VALUE}</SelectItem>
        {stateOptions.map((state) => (
          <SelectItem key={state} value={state}>
            {state}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : null

  if (effectiveVariant === "inline") {
    return (
      <div className="flex flex-col gap-2 w-full min-w-0 sm:flex-row sm:flex-wrap sm:items-center">
        {!hideCountry && (
          <div className="flex items-center gap-1.5 shrink-0">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-semibold text-foreground whitespace-nowrap">
              {tCommon("legal_context")}
            </span>
            {showProfileHint && (
              <ProfileHintTooltip
                profileLinkLabel={t("profileJurisdictionLink")}
                changeIfElsewhere={t("changeIfElsewhere")}
              />
            )}
          </div>
        )}
        {!hideCountry && (
          <Select
            value={normalizedCode}
            onValueChange={(v) => onCountryChange(v as CountryCode)}
          >
            <SelectTrigger className="h-9 w-full sm:w-auto sm:min-w-[120px] bg-background text-foreground">
              <SelectValue placeholder={isDetecting ? t("detecting") : tCommon("selectCountry")}>
                {!isDetecting && normalizedCode ? countryLabel : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <CountrySelectItems preferredCode={normalizedCode} />
            </SelectContent>
          </Select>
        )}
        {jurisdictionField}
      </div>
    )
  }

  if (effectiveVariant === "compact") {
    const showRegion = jurisdiction && jurisdiction !== ALL_REGIONS_VALUE
    const contextLabel = showRegion
      ? `${countryLabel} · ${jurisdiction}`
      : countryLabel

    return (
      <div className="rounded-lg border border-border/80 bg-muted/40 p-3 space-y-2 w-full min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {!hideCountry && (
            <>
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium text-foreground">{tCommon("legal_context")}</span>
              {showRegion && (
                <Badge variant="secondary" className="text-xs font-normal">
                  {contextLabel}
                </Badge>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {!hideCountry && (
            <Select
              value={normalizedCode}
              onValueChange={(v) => onCountryChange(v as CountryCode)}
            >
              <SelectTrigger className="h-9 w-full sm:w-auto sm:min-w-[140px] bg-background text-foreground">
                <SelectValue placeholder={isDetecting ? t("detecting") : tCommon("selectCountry")}>
                  {!isDetecting && normalizedCode ? countryLabel : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <CountrySelectItems preferredCode={normalizedCode} />
              </SelectContent>
            </Select>
          )}
          {jurisdictionField && (
            <div className="w-full sm:w-auto sm:min-w-[160px]">{jurisdictionField}</div>
          )}
        </div>
        {showProfileHint && (
          <p className="text-xs text-muted-foreground break-words hidden sm:block">
            Defaults from your{" "}
            <Link href="/app/profile" className="text-primary underline-offset-2 hover:underline">
              {t("profileJurisdictionLink")}
            </Link>
            . {t("changeIfElsewhere")}
          </p>
        )}
      </div>
    )
  }

  if (hideCountry) {
    return (
      <div className="space-y-2">
        <Label htmlFor="jurisdiction">
          {normalizedCode === "US" ? t("stateLabel") : t("stateRegionLabel")}{" "}
          {t("optional")}
        </Label>
        {jurisdictionField}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>{t("where_does_this_legal_issue_apply")}</Label>
        <p className="text-sm text-muted-foreground mt-1">
          {countryHelperText ??
            (isDetecting
              ? t("detectingLocation")
              : countryLabel &&
                  jurisdiction &&
                  jurisdiction !== ALL_REGIONS_VALUE
                ? t("detectedCountryRegionChange", {
                    country: countryLabel,
                    region: jurisdiction,
                  })
                : countryLabel
                  ? t("detectedCountryChange", { country: countryLabel })
                  : tCommon("countryLanguageHint"))}
        </p>
      </div>
      <Select
        value={normalizedCode}
        onValueChange={(v) => onCountryChange(v as CountryCode)}
      >
        <SelectTrigger className="text-foreground">
          <SelectValue placeholder={isDetecting ? t("detecting") : tCommon("selectCountry")}>
            {!isDetecting && normalizedCode ? countryLabel : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <CountrySelectItems preferredCode={normalizedCode} />
        </SelectContent>
      </Select>
      <div className="space-y-2">
        <Label htmlFor="jurisdiction">
          {normalizedCode === "US" ? t("stateLabel") : t("stateRegionLabel")}{" "}
          {t("optional")}
        </Label>
        {jurisdictionField}
      </div>
    </div>
  )
}
