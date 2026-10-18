"use client"

import { useTranslations } from "next-intl"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LanguagePreferencePicker } from "@/components/i18n/language-preference-picker"

interface LandingLanguageStepProps {
  countryCode: string
  pendingLocale: string
  onSelect: (code: string) => void
  disabled?: boolean
  onContinue: () => void
}

export function LandingLanguageStep({
  countryCode,
  pendingLocale,
  onSelect,
  disabled = false,
  onContinue,
}: LandingLanguageStepProps) {
  const tCommon = useTranslations("common")

  return (
    <div className="space-y-3 animate-fade-in">
      <LanguagePreferencePicker
        countryCode={countryCode}
        value={pendingLocale}
        onChange={onSelect}
        disabled={disabled}
      />

      <div className="flex justify-end pt-1">
        <Button
          onClick={onContinue}
          disabled={disabled || !pendingLocale}
          className="group touch-manipulation"
        >
          {tCommon("continue")}
          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </Button>
      </div>
    </div>
  )
}
