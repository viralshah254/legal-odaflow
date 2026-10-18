"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ErrorState } from "@/components/ui/error-state"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { TabPanelMotion } from "@/components/ui/motion"
import { DataConsentForm } from "@/components/legal/data-consent-form"
import {
  getConsumerTrainingConsent,
  updateConsumerTrainingConsent,
  type TrainingConsentRecord,
} from "@/lib/api/training-consent"
import { useApiData } from "@/lib/hooks/use-api-data"

export default function ConsumerCaseConsentPage({
  params,
}: {
  params: { caseId: string }
}) {
  const t = useTranslations("consumer")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const { data: consent, isLoading, error, refetch } = useApiData<TrainingConsentRecord>(
    ["consumer-training-consent", params.caseId],
    { apiFn: getConsumerTrainingConsent },
  )

  const handleSave = async (
    optIn: boolean,
    options: {
      canUseForPromptImprove: boolean
      canUseForEvaluation: boolean
      canUseForFineTuning: boolean
    },
  ) => {
    setSaving(true)
    setMessage("")
    try {
      await updateConsumerTrainingConsent({
        consentStatus: optIn ? "GRANTED" : "DENIED",
        ...options,
      })
      await refetch()
      setMessage(optIn ? "Consent preferences saved." : "Training opt-in disabled.")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to save consent")
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <PageSkeleton rows={4} />
  if (error || !consent) {
    return (
      <ErrorState
        message="Failed to load consent settings."
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <TabPanelMotion value="consent" activeValue="consent">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("data_consent_for_this_case")}</CardTitle>
          <CardDescription>
            Control how data from this case may be used for AI improvement. Default is off.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {message && <p className="text-sm text-muted-foreground mb-4">{message}</p>}
          <DataConsentForm
            title={t("training_improvement_consent")}
            description={t("applies_to_account_changes_future")}
            consent={consent}
            onSave={handleSave}
            saving={saving}
          />
        </CardContent>
      </Card>
    </TabPanelMotion>
  )
}
