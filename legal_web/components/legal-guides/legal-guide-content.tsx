"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AiOutputDisclaimer } from "@/components/legal/translated-disclaimers"
import { ArrowRight, BookOpen } from "lucide-react"

interface LegalGuideContentProps {
  countryLabel: string
  title: string
}

export function LegalGuideContent({ countryLabel, title }: LegalGuideContentProps) {
  const t = useTranslations("legalGuides")

  const sections = [
    t("overview"),
    t("whenToSeekHelp"),
    t("keyConsiderations"),
    t("nextSteps"),
    t("relatedResources"),
    t("nextSteps"),
  ]

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <BookOpen className="h-4 w-4" />
          <span>{countryLabel}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
      </div>

      <div className="space-y-6 mb-10">
        {sections.map((section, index) => (
          <Card key={`${section}-${index}`}>
            <CardHeader>
              <CardTitle className="text-lg">{section}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{t("placeholderSection")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold">{t("ctaTitle")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("ctaSubtitle")}
            </p>
          </div>
          <Button asChild>
            <Link href="/legal-issue-checker">
              {t("ctaButton")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="mt-8">
        <AiOutputDisclaimer />
      </div>
    </>
  )
}
