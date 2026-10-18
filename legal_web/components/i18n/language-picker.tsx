"use client"

import { useLocale as useNextIntlLocale, useTranslations } from "next-intl"
import { Check, Languages } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/contexts/locale-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface LanguagePickerProps {
  className?: string
  variant?: "select" | "list"
  showLabel?: boolean
}

export function LanguagePicker({
  className,
  variant = "select",
  showLabel = true,
}: LanguagePickerProps) {
  const t = useTranslations("common")
  const intlLocale = useNextIntlLocale()
  const { availableLocales, setLocale, isLoading } = useLocale()

  if (variant === "list") {
    return (
      <div className={cn("space-y-2", className)}>
        {showLabel && (
          <Label className="flex items-center gap-2">
            <Languages className="h-4 w-4" />
            {t("selectLanguage")}
          </Label>
        )}
        <div className="grid gap-2">
          {availableLocales.map((loc) => (
            <button
              key={loc.code}
              type="button"
              disabled={isLoading}
              onClick={() => void setLocale(loc.code)}
              className={cn(
                "flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50",
                intlLocale === loc.code && "border-primary bg-primary/5",
              )}
            >
              <div>
                <div className="font-medium">{loc.nativeName}</div>
                <div className="text-sm text-muted-foreground">{loc.englishName}</div>
              </div>
              {intlLocale === loc.code && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      {showLabel && (
        <Label htmlFor="language-select" className="flex items-center gap-2">
          <Languages className="h-4 w-4" />
          {t("language")}
        </Label>
      )}
      <Select value={intlLocale} onValueChange={(v) => void setLocale(v)} disabled={isLoading}>
        <SelectTrigger id="language-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableLocales.map((loc) => (
            <SelectItem key={loc.code} value={loc.code}>
              {loc.nativeName} ({loc.englishName})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
