"use client"

import { useTranslations } from "next-intl"

export function StandardDisclaimer() {
  const t = useTranslations("legal")
  return <p className="text-xs text-muted-foreground">{t("standardDisclaimer")}</p>
}

export function AiOutputDisclaimer() {
  const t = useTranslations("legal")
  return <p className="text-xs text-muted-foreground">{t("aiOutputDisclaimer")}</p>
}

export function AttorneyDisclaimer() {
  const t = useTranslations("legal")
  return <p className="text-xs text-muted-foreground">{t("attorneyDisclaimer")}</p>
}
