"use client"
import { useTranslations } from "next-intl"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { TabPanelMotion } from "@/components/ui/motion"
import { listConsumerCasePayments } from "@/lib/api/consumer-case-workspace"
import { getLawyerReviewFee } from "@/lib/pricing/country-pricing"
import { getCase } from "@/lib/api/consumers"
import { useAuth } from "@/lib/contexts/auth-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { formatDate } from "@/lib/utils"
import { CreditCard } from "lucide-react"

export default function ConsumerCasePaymentsPage({
  params,
}: {
  params: { caseId: string }
}) {
  const t = useTranslations("consumer")
  const { isAuthenticated } = useAuth()

  const { data: caseData } = useApiData(
    ["consumer-case", params.caseId],
    {
      apiFn: () => getCase(params.caseId),
      enabled: isAuthenticated,
    },
  )

  const { data: payments = [], isLoading, error, refetch } = useApiData(
    ["consumer-case-payments", params.caseId],
    {
      apiFn: () => listConsumerCasePayments(params.caseId),
      enabled: isAuthenticated,
    },
  )

  const reviewFee = getLawyerReviewFee(caseData?.countryCode ?? "IN")

  if (isLoading) return <PageSkeleton rows={3} />
  if (error) {
    return <ErrorState message="Failed to load payments." onRetry={() => void refetch()} />
  }

  return (
    <TabPanelMotion value="payments" activeValue="payments">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-lg">{t("lawyer_review_fee")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Verified lawyer review for this jurisdiction:{" "}
            <span className="font-semibold text-foreground">
              {reviewFee.label}
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("payment_history")}</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title={t("no_payments_yet")}
              description={t("empty_payments_description")}
            />
          ) : (
            <ul className="space-y-3">
              {payments.map((payment) => (
                <li key={payment.id} className="flex justify-between gap-4 rounded-lg border p-4 shadow-token-sm">
                  <div>
                    <p className="font-medium">{payment.description ?? "Payment"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(payment.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {payment.amount.toLocaleString()} {payment.currency}
                    </p>
                    <Badge variant="outline">{payment.status}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </TabPanelMotion>
  )
}
