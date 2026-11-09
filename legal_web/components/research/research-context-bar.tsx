"use client"

import type { CountryCode } from "@/lib/api/types"
import { JurisdictionSelect } from "@/components/research/jurisdiction-select"
import { OutputLanguageSelect } from "@/components/research/output-language-select"
import { cn } from "@/lib/utils"

interface ResearchContextBarProps {
  countryCode: CountryCode
  jurisdiction: string
  onJurisdictionChange: (next: { countryCode: CountryCode; jurisdiction: string }) => void
  countryLoading: boolean
  outputLanguage: string
  onOutputLanguageChange: (lang: string) => void
  className?: string
  matterScope?: boolean
}

export function ResearchContextBar({
  countryCode,
  jurisdiction,
  onJurisdictionChange,
  countryLoading,
  outputLanguage,
  onOutputLanguageChange,
  className,
  matterScope = false,
}: ResearchContextBarProps) {
  return (
    <div
      className={cn(
        "px-4 py-3 bg-muted/25 border-b border-border/60",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-6">
        {matterScope ? (
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-semibold">Matter law: {countryCode}</p>
            <p className="mt-1 text-muted-foreground">Jurisdiction follows this matter. Change it in matter settings.</p>
          </div>
        ) : <JurisdictionSelect
          countryCode={countryCode}
          jurisdiction={jurisdiction}
          onChange={onJurisdictionChange}
          isDetecting={countryLoading}
          showProfileHint
          className="flex-1 min-w-0"
        />}
        <OutputLanguageSelect
          value={outputLanguage}
          onChange={onOutputLanguageChange}
          countryCode={countryCode}
          className="w-full sm:w-52 shrink-0"
        />
      </div>
    </div>
  )
}
