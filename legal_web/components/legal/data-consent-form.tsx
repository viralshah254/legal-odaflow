"use client"
import { useTranslations } from "next-intl"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import type { TrainingConsentRecord } from "@/lib/api/training-consent"
import { Loader2 } from "lucide-react"

interface DataConsentFormProps {
  title: string
  description: string
  consent: TrainingConsentRecord
  saving: boolean
  onSave: (optIn: boolean, options: {
    canUseForPromptImprove: boolean
    canUseForEvaluation: boolean
    canUseForFineTuning: boolean
  }) => Promise<void>
  policyLink?: string
  backHref?: string
  backLabel?: string
  disabledReason?: string
}

export function DataConsentForm({
  title,
  description,
  consent,
  saving,
  onSave,
  policyLink = "/data-consent",
  backHref,
  backLabel = "Back",
  disabledReason,
}: DataConsentFormProps) {
  const t = useTranslations("common")
  const [optIn, setOptIn] = useState(consent.consentStatus === "GRANTED")
  const [promptImprove, setPromptImprove] = useState(consent.canUseForPromptImprove)
  const [evaluation, setEvaluation] = useState(consent.canUseForEvaluation)
  const [fineTuning, setFineTuning] = useState(consent.canUseForFineTuning)

  const handleToggleOptIn = async (checked: boolean) => {
    setOptIn(checked)
    if (!checked) {
      setPromptImprove(false)
      setEvaluation(false)
      setFineTuning(false)
      await onSave(false, {
        canUseForPromptImprove: false,
        canUseForEvaluation: false,
        canUseForFineTuning: false,
      })
    }
  }

  const handleSaveDetails = async () => {
    await onSave(optIn, {
      canUseForPromptImprove: promptImprove,
      canUseForEvaluation: evaluation,
      canUseForFineTuning: fineTuning,
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {backHref && (
        <Link href={backHref} className="text-sm text-primary hover:underline">
          ← {backLabel}
        </Link>
      )}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("training_opt-in")}</CardTitle>
          <CardDescription>
            {t("training_opt_in_default", { state: t("off") })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {disabledReason && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {disabledReason}
            </p>
          )}
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="training-opt-in" className="flex-1">
              Allow anonymized use for AI improvement
            </Label>
            <Switch
              id="training-opt-in"
              checked={optIn}
              onCheckedChange={(v) => void handleToggleOptIn(v)}
              disabled={saving || Boolean(disabledReason)}
            />
          </div>

          {optIn && (
            <div className="space-y-4 pl-4 border-l-2 border-primary/20">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="prompt-improve">{t("prompt_improvement")}</Label>
                <Switch
                  id="prompt-improve"
                  checked={promptImprove}
                  onCheckedChange={setPromptImprove}
                  disabled={saving || Boolean(disabledReason)}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="evaluation">{t("quality_evaluation")}</Label>
                <Switch
                  id="evaluation"
                  checked={evaluation}
                  onCheckedChange={setEvaluation}
                  disabled={saving || Boolean(disabledReason)}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="fine-tuning">{t("fine-tuning_admin-approved_datasets_only")}</Label>
                <Switch
                  id="fine-tuning"
                  checked={fineTuning}
                  onCheckedChange={setFineTuning}
                  disabled={saving || Boolean(disabledReason)}
                />
              </div>
              <Button onClick={() => void handleSaveDetails()} disabled={saving || Boolean(disabledReason)}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save preferences"
                )}
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Policy version {consent.consentTextVersion} · Jurisdiction {consent.jurisdictionCountryCode}
            {consent.requiresAnonymization && " · Anonymization required"}
          </p>
          <p className="text-sm">
            Read the full{" "}
            <Link href={policyLink} className="text-primary hover:underline">
              Data & AI Consent Policy
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <LegalDisclaimer variant="compact" />
    </div>
  )
}
