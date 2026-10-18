"use client"

import { useEffect, useState } from "react"
import { useLocale as useNextIntlLocale, useTranslations } from "next-intl"
import { Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { LanguagePreferencePicker } from "@/components/i18n/language-preference-picker"
import { useLocale } from "@/lib/contexts/locale-context"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { cn } from "@/lib/utils"

interface LanguageToggleProps {
  className?: string
  variant?: "icon" | "inline"
}

export function LanguageToggle({ className, variant = "icon" }: LanguageToggleProps) {
  const t = useTranslations("common")
  const tHome = useTranslations("marketing.home.landingIssueBoard")
  const intlLocale = useNextIntlLocale()
  const { setLocale, isLoading } = useLocale()
  const { countryCode } = useDetectedCountry()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [pendingLocale, setPendingLocale] = useState(intlLocale)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (open) setPendingLocale(intlLocale)
  }, [open, intlLocale])

  const handleApply = async () => {
    if (pendingLocale !== intlLocale) {
      await setLocale(pendingLocale)
    }
    setOpen(false)
  }

  if (!mounted) {
    if (variant === "inline") {
      return (
        <span
          className={cn("text-sm text-muted-foreground inline-flex items-center gap-1", className)}
          aria-hidden
        >
          <Languages className="h-3.5 w-3.5" />
          {intlLocale}
        </span>
      )
    }

    return (
      <Button variant="ghost" size="icon" className={className} aria-hidden disabled>
        <Languages className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <>
      <Button
        variant={variant === "inline" ? "ghost" : "ghost"}
        size={variant === "inline" ? "default" : "icon"}
        className={cn(
          variant === "inline"
            ? "h-auto px-0 py-0 text-sm font-normal text-muted-foreground hover:text-foreground hover:bg-transparent gap-1"
            : className,
        )}
        title={t("language")}
        aria-label={t("selectLanguage")}
        disabled={isLoading}
        onClick={() => setOpen(true)}
      >
        <Languages className={variant === "inline" ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4"} />
        {variant === "inline" && <span>{intlLocale}</span>}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:max-w-md sm:mx-auto"
        >
          <SheetHeader className="text-left space-y-1.5 pb-4">
            <SheetTitle>{tHome("languageTitle")}</SheetTitle>
            <SheetDescription>
              {countryCode === "IN" ? tHome("languageSubtitleIndia") : tHome("languageSubtitle")}
            </SheetDescription>
          </SheetHeader>

          <LanguagePreferencePicker
            countryCode={countryCode}
            value={pendingLocale}
            onChange={setPendingLocale}
            disabled={isLoading}
          />

          <div className="flex gap-2 pt-5">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button className="flex-1" disabled={isLoading || !pendingLocale} onClick={() => void handleApply()}>
              {t("continue")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
