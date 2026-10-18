"use client"

import { useMemo } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getLocaleDefinition,
  getLocaleOptionsForCountry,
} from "@/lib/i18n/locales"
import { cn } from "@/lib/utils"

function formatLanguageLabel(code: string): string {
  const loc = getLocaleDefinition(code)
  if (loc.nativeName === loc.englishName) return loc.nativeName
  return `${loc.nativeName} (${loc.englishName})`
}

interface OutputLanguageSelectProps {
  value: string
  onChange: (lang: string) => void
  countryCode: string
  label?: string
  className?: string
}

export function OutputLanguageSelect({
  value,
  onChange,
  countryCode,
  label = "Output",
  className,
}: OutputLanguageSelectProps) {
  const options = useMemo(
    () => getLocaleOptionsForCountry(countryCode),
    [countryCode],
  )

  return (
    <div className={cn("space-y-1.5 min-w-0", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full bg-background text-foreground">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent className="max-h-[min(18rem,50vh)]">
          {options.map((loc) => (
            <SelectItem key={loc.code} value={loc.code}>
              {formatLanguageLabel(loc.code)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
