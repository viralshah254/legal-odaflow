"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import {
  getFirmTrainingConsent,
  updateFirmTrainingConsent,
} from "@/lib/api/training-consent"

const DISMISS_KEY = "odaflow.training-consent-banner-dismissed"

/**
 * Lightweight in-product prompt so firms opt into prompt-improvement training.
 * Shown once near drafting feedback until granted or dismissed.
 */
export function TrainingConsentBanner({ tenantId }: { tenantId?: string }) {
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1") {
      return
    }
    let cancelled = false
    void getFirmTrainingConsent(tenantId)
      .then((consent) => {
        if (cancelled) return
        if (consent.consentStatus === "GRANTED" && consent.canUseForPromptImprove) {
          setVisible(false)
          return
        }
        setVisible(true)
      })
      .catch(() => {
        if (!cancelled) setVisible(true)
      })
    return () => {
      cancelled = true
    }
  }, [tenantId])

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "1")
    setVisible(false)
  }, [])

  const enable = useCallback(async () => {
    if (!tenantId) return
    setSaving(true)
    try {
      await updateFirmTrainingConsent(tenantId, {
        consentStatus: "GRANTED",
        canUseForPromptImprove: true,
        canUseForEvaluation: true,
        canUseForFineTuning: false,
      })
      setVisible(false)
    } catch {
      // keep banner visible on failure
    } finally {
      setSaving(false)
    }
  }, [tenantId])

  if (!visible || !tenantId) return null

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40 px-3 py-2.5 flex items-start gap-2 text-xs text-indigo-900 dark:text-indigo-200">
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-medium">Help improve drafting accuracy for your firm</p>
        <p className="text-indigo-700/80 dark:text-indigo-300/80">
          Allow redacted edits to personalise prompts for your team. You can change this anytime in{" "}
          <Link href="/app/settings/data-consent" className="underline font-medium">
            Data consent
          </Link>
          .
        </p>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={saving}
            onClick={() => void enable()}
            className="rounded-md bg-indigo-600 text-white px-2.5 py-1 text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Enabling…" : "Enable learning"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="text-indigo-500 hover:text-indigo-800 dark:hover:text-indigo-200 shrink-0"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
