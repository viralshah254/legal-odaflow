"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LanguagePreferencePicker } from "@/components/i18n/language-preference-picker"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { useLocale } from "@/lib/contexts/locale-context"
import { useTranslations } from "next-intl"
import { Languages } from "lucide-react"

export function LanguageSettingsCard() {
  const t = useTranslations("settings")
  const tHome = useTranslations("marketing.home.landingIssueBoard")
  const { countryCode } = useDetectedCountry()
  const { locale, setLocale, isLoading } = useLocale()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Languages className="h-5 w-5 text-muted-foreground" />
          <CardTitle>{t("language")}</CardTitle>
        </div>
        <CardDescription>{t("languageDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <LanguagePreferencePicker
          countryCode={countryCode}
          value={locale}
          onChange={(code) => void setLocale(code)}
          disabled={isLoading}
          otherLanguagesPlaceholder={tHome("otherLanguagesPlaceholder")}
        />
      </CardContent>
    </Card>
  )
}
