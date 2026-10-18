"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { useLocale } from "@/lib/contexts/locale-context"
import { LanguagePreferencePicker } from "@/components/i18n/language-preference-picker"
import { getCountryName } from "@/lib/geo/detect-country"
import type { CountryCode } from "@/lib/api/types"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

const SUPPORTED_COUNTRIES: CountryCode[] = ["IN", "US", "KE", "GB"]

interface CountryLanguageFlowProps {
  onComplete?: () => void
  className?: string
}

export function CountryLanguageFlow({ onComplete, className }: CountryLanguageFlowProps) {
  const t = useTranslations("common")
  const tHome = useTranslations("marketing.home.landingIssueBoard")
  const { countryCode, setCountryCode } = useDetectedCountry()
  const { locale, setLocale } = useLocale()
  const [step, setStep] = useState<"country" | "language">("country")
  const [pendingCountry, setPendingCountry] = useState<CountryCode>(countryCode)
  const [pendingLocale, setPendingLocale] = useState(locale)

  const handleCountryContinue = () => {
    setCountryCode(pendingCountry)
    setPendingLocale(locale)
    setStep("language")
  }

  const handleLanguageContinue = async () => {
    await setLocale(pendingLocale)
    onComplete?.()
  }

  return (
    <Card className={cn("w-full max-w-lg mx-auto", className)}>
      <CardHeader>
        <CardTitle>
          {step === "country" ? t("selectCountry") : tHome("languageTitle")}
        </CardTitle>
        <CardDescription>
          {step === "country" ? t("countryLanguageHint") : tHome("languageSubtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === "country" ? (
          <>
            <div className="grid gap-2">
              {SUPPORTED_COUNTRIES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setPendingCountry(code)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50",
                    pendingCountry === code && "border-primary bg-primary/5",
                  )}
                >
                  <span className="font-medium">{getCountryName(code)}</span>
                  {pendingCountry === code && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={handleCountryContinue}>
              {t("continue")}
            </Button>
          </>
        ) : (
          <>
            <LanguagePreferencePicker
              countryCode={pendingCountry}
              value={pendingLocale}
              onChange={setPendingLocale}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("country")}>
                {t("back")}
              </Button>
              <Button className="flex-1" onClick={() => void handleLanguageContinue()}>
                {t("continue")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
