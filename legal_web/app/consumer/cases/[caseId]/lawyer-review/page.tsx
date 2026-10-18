"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { getCase } from "@/lib/api/consumers"
import { createReviewRequest, payForReviewRequest } from "@/lib/api/marketplace"
import { useAuth } from "@/lib/contexts/auth-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { CheckCircle, CreditCard, Loader2, Scale } from "lucide-react"

import { getLawyerReviewFee } from "@/lib/pricing/country-pricing"

export default function CaseLawyerReviewPage({
  params,
}: {
  params: { caseId: string }
}) {
  const t = useTranslations("consumer")
  const tCommon = useTranslations("common")
  const { isAuthenticated } = useAuth()
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  const { data: caseData, isLoading } = useApiData(
    ["consumer-case-review", params.caseId],
    {
      apiFn: () => getCase(params.caseId),
      enabled: isAuthenticated,
    },
  )

  const pricing = getLawyerReviewFee(caseData?.countryCode ?? "IN")
  const fullReport = caseData?.reports?.find((r) => !r.isPreview) ?? caseData?.reports?.[0]

  const handleSubmit = async () => {
    if (!caseData) return
    setSubmitting(true)
    setError("")
    try {
      // Step 1 — create the request record
      const created = await createReviewRequest({
        consumerCaseId: caseData.id,
        countryCode: caseData.countryCode,
        issueType: caseData.issueType,
        price: pricing.amount,
        currency: pricing.currency,
        consumerReportId: fullReport?.id,
        jurisdiction: caseData.jurisdiction ?? undefined,
        summary: notes.trim() || undefined,
      })

      // Step 2 — initiate payment; redirect to checkout if available
      const payResult = await payForReviewRequest(created.id)
      if (payResult.checkoutUrl) {
        window.location.href = payResult.checkoutUrl
        return
      }

      // No redirect URL (e.g. M-Pesa STK push sent) — show success
      setSubmitted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed")
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24 max-w-2xl mx-auto w-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!caseData) return null

  if (submitted) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto w-full">
        <Card className="border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="py-10 flex flex-col items-center text-center gap-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
            <div>
              <p className="font-semibold text-lg">Review request submitted!</p>
              <p className="text-sm text-muted-foreground mt-1">
                A verified lawyer will review your case and respond within 48 hours.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={`/consumer/cases/${params.caseId}/report`}>Back to report</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto w-full">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t("lawyer_review_request")}</h1>
        <p className="text-muted-foreground">
          Request a licensed lawyer to review your AI report and provide guidance for your
          situation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{caseData.title}</CardTitle>
          <CardDescription>
            {caseData.issueType} · {caseData.countryCode}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Fee row — uses Intl-formatted label, no duplicate symbol */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <span className="text-sm font-medium">{t("review_fee")}</span>
            <Badge variant="secondary" className="text-sm font-semibold">
              {pricing.label}
            </Badge>
          </div>

          {fullReport && (
            <p className="text-sm text-muted-foreground">
              Report attached: {fullReport.title}
              {fullReport.isPreview && " (preview — upgrade recommended)"}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">{tCommon("additional_context_optional")}</Label>
            <Textarea
              id="notes"
              placeholder={t("deadlines_parties_or_questions_for_the_reviewing_lawyer")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Pay {pricing.label} &amp; submit request
              </>
            )}
          </Button>

          {fullReport && (
            <Button variant="outline" asChild className="w-full">
              <Link href={`/consumer/cases/${params.caseId}/report`}>
                View legal report
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <LegalDisclaimer />
    </div>
  )
}
