"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getLandingLocaleOptionsOrdered,
  type LocaleDefinition,
} from "@/lib/i18n/locales"
import { cn } from "@/lib/utils"

export interface LanguagePreferencePickerProps {
  countryCode: string
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  /** Override placeholder when no value is selected */
  otherLanguagesPlaceholder?: string
  className?: string
}

export function LanguagePreferencePicker({
  countryCode,
  value,
  onChange,
  disabled = false,
  otherLanguagesPlaceholder,
  className,
}: LanguagePreferencePickerProps) {
  const tHome = useTranslations("marketing.home.landingIssueBoard")
  const tCommon = useTranslations("common")

  const options = useMemo(
    () => getLandingLocaleOptionsOrdered(countryCode),
    [countryCode],
  )

  return (
    <div className={cn(className)}>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="language-select" className="h-11 w-full text-sm">
          <SelectValue placeholder={otherLanguagesPlaceholder ?? tHome("otherLanguagesPlaceholder")} />
        </SelectTrigger>
        <SelectContent className="max-h-[min(18rem,50vh)]">
          {options.map((loc) => (
            <SelectItem key={loc.code} value={loc.code}>
              {loc.nativeName} ({loc.englishName})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="sr-only">{tCommon("selectLanguage")}</p>
    </div>
  )
}

export function LanguagePill({
  lang,
  selected,
  disabled,
  onSelect,
  size = "default",
}: {
  lang: LocaleDefinition
  selected: boolean
  disabled?: boolean
  onSelect: () => void
  size?: "default" | "compact"
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "rounded-lg border font-medium transition-colors touch-manipulation",
        "disabled:opacity-50 disabled:pointer-events-none",
        size === "compact" ? "px-3 py-1.5 text-xs" : "px-3 py-2 text-sm",
        selected
          ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
          : "border-border/70 text-foreground hover:bg-muted/50",
        lang.rtl && "font-sans",
      )}
    >
      {lang.nativeName}
    </button>
  )
}
