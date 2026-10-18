"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { Info } from "lucide-react"
import type { CountryCode } from "@/lib/api/types"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ALL_REGIONS_VALUE, isAllRegionsSelection } from "@/lib/geo/country-states"
import { getCountryName } from "@/lib/geo/detect-country"
import { cn } from "@/lib/utils"
import {
  decodeJurisdictionValue,
  encodeJurisdictionValue,
} from "@/lib/geo/jurisdiction-value"
import {
  findResearchCountry,
  useResearchCountries,
} from "@/lib/hooks/use-research-countries"

export { decodeJurisdictionValue, encodeJurisdictionValue }

function formatJurisdictionLabel(countryCode: string, jurisdiction: string, countryName?: string): string {
  const countryLabel = countryName || getCountryName(countryCode) || countryCode
  if (isAllRegionsSelection(jurisdiction)) return countryLabel
  return `${countryLabel} · ${jurisdiction}`
}

interface JurisdictionSelectProps {
  countryCode: CountryCode
  jurisdiction: string
  onChange: (next: { countryCode: CountryCode; jurisdiction: string }) => void
  isDetecting?: boolean
  showProfileHint?: boolean
  className?: string
}

export function JurisdictionSelect({
  countryCode,
  jurisdiction,
  onChange,
  isDetecting = false,
  showProfileHint = false,
  className,
}: JurisdictionSelectProps) {
  const t = useTranslations("matters")
  const tIssue = useTranslations("issueChecker")
  const { countries, loading: countriesLoading } = useResearchCountries()

  const normalizedCode = countryCode?.toUpperCase() || ""
  const selectedValue = encodeJurisdictionValue(normalizedCode, jurisdiction)
  const activeCountry = findResearchCountry(countries, normalizedCode)
  const displayLabel = formatJurisdictionLabel(
    normalizedCode,
    jurisdiction,
    activeCountry?.name,
  )

  const optionGroups = useMemo(() => {
    if (countries.length > 0) {
      return countries.map((country) => {
        const regions = [ALL_REGIONS_VALUE, ...(country.supportedJurisdictions ?? [])]
        return {
          countryCode: country.code,
          countryLabel: country.name,
          options: regions.map((region) => ({
            value: encodeJurisdictionValue(country.code, region),
            label: formatJurisdictionLabel(country.code, region, country.name),
          })),
        }
      })
    }

    if (!normalizedCode) return []

    return [
      {
        countryCode: normalizedCode,
        countryLabel: getCountryName(normalizedCode) || normalizedCode,
        options: [
          {
            value: selectedValue,
            label: displayLabel,
          },
        ],
      },
    ]
  }, [countries, displayLabel, normalizedCode, selectedValue])

  const selectDisabled = countriesLoading && countries.length === 0

  return (
    <div className={cn("space-y-1.5 min-w-0", className)}>
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-muted-foreground">{t("jurisdiction")}</span>
        {showProfileHint && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  aria-label="Jurisdiction defaults"
                >
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                Defaults from your{" "}
                <Link href="/app/profile" className="text-primary underline-offset-2 hover:underline">
                  {tIssue("profileJurisdictionLink")}
                </Link>
                . {tIssue("changeIfElsewhere")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <Select
        value={selectedValue}
        onValueChange={(value) => onChange(decodeJurisdictionValue(value))}
        disabled={selectDisabled}
      >
        <SelectTrigger className="h-9 w-full bg-background text-foreground">
          <SelectValue
            placeholder={
              isDetecting || countriesLoading ? tIssue("detecting") : t("jurisdiction")
            }
          >
            {!isDetecting && normalizedCode ? displayLabel : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[min(24rem,70vh)]">
          {optionGroups.map((group) => (
            <SelectGroup key={group.countryCode}>
              <SelectLabel>{group.countryLabel}</SelectLabel>
              {group.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
