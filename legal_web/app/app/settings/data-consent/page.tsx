"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import { RoleGate } from "@/components/dashboard/role-gate"
import { DataConsentForm } from "@/components/legal/data-consent-form"
import {
  getFirmTrainingConsent,
  updateFirmTrainingConsent,
  type TrainingConsentRecord,
} from "@/lib/api/training-consent"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getGovernanceSettings } from "@/lib/api/governance"
import { StatePanel } from "@/components/ui/state-panel"

export default function FirmDataConsentPage() {
  const t = useTranslations("settings")
  const { activeTenantId, activeTenant } = useTenant()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const { data: consent, isLoading, refetch } = useApiData<TrainingConsentRecord>(
    ["firm-training-consent", activeTenantId],
    {
      apiFn: () => getFirmTrainingConsent(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )
  const { data: governance } = useApiData(
    ["firm-training-privacy-status", activeTenantId],
    {
      apiFn: () => getGovernanceSettings(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )
  const privacyBlocked =
    activeTenant?.tenant.primaryCountry === "KE" &&
    governance?.privacyStatus?.trainingAllowed === false

  const handleSave = async (
    optIn: boolean,
    options: {
      canUseForPromptImprove: boolean
      canUseForEvaluation: boolean
      canUseForFineTuning: boolean
    },
  ) => {
    if (!activeTenantId) return
    setSaving(true)
    setMessage("")
    try {
      await updateFirmTrainingConsent(activeTenantId, {
        consentStatus: optIn ? "GRANTED" : "DENIED",
        ...options,
      })
      await refetch()
      setMessage(optIn ? "Firm training opt-in saved." : "Training opt-in disabled.")
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to save consent")
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !consent) {
    return (
      <div className="p-6">
        <StatePanel
          title={t("loading_consent_settings")}
          description={t("checking_firm_training_preferences")}
          variant="loading"
        />
      </div>
    )
  }

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN"]}>
      <div className="p-6">
        {message && (
          <StatePanel
            title={message}
            description={t("privacy_choice_recorded_for_firm")}
            variant="success"
            className="mb-4"
          />
        )}
        <DataConsentForm
          title={t("firm_data_training_consent")}
          description={t("control_anonymized_firm_data_for_ai")}
          consent={consent}
          saving={saving}
          onSave={handleSave}
          backHref="/app/settings/governance"
          backLabel="Governance"
          disabledReason={
            privacyBlocked
              ? `Complete the Kenya privacy assessment first: ${governance?.privacyStatus?.blockers.join(", ")}.`
              : undefined
          }
        />
      </div>
    </RoleGate>
  )
}
