"use client"

import { OutputLanguageSelect } from "@/components/language/output-language-select"

export type OutputLanguage = string

interface LanguagePickerProps {
  value: OutputLanguage
  onChange: (lang: OutputLanguage) => void
  label?: string
  /** Only show when country is India */
  countryCode?: string
  className?: string
}

export function BilingualLanguagePicker({
  value,
  onChange,
  label = "Output language",
  countryCode = "IN",
  className,
}: LanguagePickerProps) {
  if (countryCode && countryCode !== "IN") return null

  return (
    <OutputLanguageSelect
      value={value}
      onChange={onChange}
      countryCode={countryCode}
      label={label}
      className={className}
    />
  )
}
