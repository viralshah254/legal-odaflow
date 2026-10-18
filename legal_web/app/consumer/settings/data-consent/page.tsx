"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { DataConsentForm } from "@/components/legal/data-consent-form"
import {
  getConsumerTrainingConsent,
  updateConsumerTrainingConsent,
  type TrainingConsentRecord,
} from "@/lib/api/training-consent"
import { useApiData } from "@/lib/hooks/use-api-data"
import { Loader2 } from "lucide-react"

export default function ConsumerDataConsentPage() {
  const t = useTranslations("consumer")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const { data: consent, isLoading, refetch } = useApiData<TrainingConsentRecord>(
    ["consumer-training-consent"],
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

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-2xl w-full">
        {isLoading || !consent ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {message && <p className="text-sm text-muted-foreground mb-4">{message}</p>}
            <div data-tour="consumer-data-consent">
              <DataConsentForm
                title={t("data_ai_consent")}
                description={t("control_case_data_for_ai_improvement")}
                consent={consent}
                saving={saving}
                onSave={handleSave}
                backHref="/consumer/settings"
                backLabel="Settings"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
