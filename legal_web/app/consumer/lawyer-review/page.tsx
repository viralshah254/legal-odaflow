"use client"
import { useTranslations } from "next-intl"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Scale, ArrowRight } from "lucide-react"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { getLawyerReviewFee } from "@/lib/pricing/country-pricing"
import { listLeads, createReviewRequest } from "@/lib/api/marketplace"
import { listCases } from "@/lib/api/consumers"
import type { ConsumerCase } from "@/lib/api/types"

export default function LawyerReviewPage() {
  const t = useTranslations("consumer")
  const [cases, setCases] = useState<ConsumerCase[]>([])
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    listCases().then(setCases).catch(() => {})
  }, [])

  const handleRequestReview = async (caseItem: ConsumerCase) => {
    setSubmitting(caseItem.id)
    setMessage("")
    try {
      const fee = getLawyerReviewFee(caseItem.countryCode)
      await createReviewRequest({
        consumerCaseId: caseItem.id,
        countryCode: caseItem.countryCode,
        issueType: caseItem.issueType,
        price: fee.amount,
        currency: fee.currency,
      })
      setMessage("Lawyer review request submitted. A verified lawyer will respond soon.")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed")
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-3xl w-full">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t("lawyer_review")}</h1>
        <p className="text-muted-foreground mb-8">
          Upgrade to a verified lawyer-reviewed report for legal advice specific to your situation.
        </p>

        {message && (
          <Card className="mb-6 border-primary/30">
            <CardContent className="py-4 text-sm">{message}</CardContent>
          </Card>
        )}

        <div className="space-y-4" data-tour="consumer-lawyer-review">
          {cases.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{c.title}</CardTitle>
                    <CardDescription>{c.issueType} · {c.countryCode}</CardDescription>
                  </div>
                  <Badge variant="outline">{c.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button
                  onClick={() => handleRequestReview(c)}
                  disabled={submitting === c.id}
                >
                  <Scale className="h-4 w-4 mr-2" />
                  {submitting === c.id ? "Submitting…" : "Request Lawyer Review"}
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/consumer/cases/${c.id}`}>
                    View case
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
          {cases.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>{t("no_cases_yet_start_with_the_legal_issue_checker")}</p>
                <Button asChild className="mt-4">
                  <Link href="/legal-issue-checker">{t("check_my_legal_issue")}</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <LegalDisclaimer variant="compact" className="mt-8" />
      </div>
    </div>
  )
}
