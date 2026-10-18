"use client"

import { createElement, useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  PROMPT_REFINE_TOAST_CLASS,
  PromptRefineUndoToastContent,
} from "@/components/ai/prompt-refine-undo-toast"
import { toast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { refinePrompt, type PromptRefinementPurpose, type PromptRefinementSkipReason } from "@/lib/api/prompt-refine"

export interface UsePromptRefinementOptions {
  purpose: PromptRefinementPurpose
  tenantId?: string
  getContext?: () => Omit<
    Parameters<typeof refinePrompt>[0],
    "prompt" | "purpose"
  >
}

export interface RunWithRefinementCallbacks {
  onAutoFill: (text: string) => void
  /** Must return the live textarea value (use a ref if needed). */
  getCurrentText: () => string
  onProceed: (finalText: string) => void | Promise<void>
}

const UNDO_DELAY_MS = 10_000

const SKIP_TOAST: Record<PromptRefinementSkipReason, string> = {
  disabled: "Feature flag off on backend (ENABLE_PROMPT_REFINEMENT ≠ true). Restart API after changing .env.",
  too_short: "Prompt too short — refinement skipped.",
  too_long: "Prompt too long to refine safely — using your original text.",
  already_clear: "Prompt already clear — refinement skipped (no preview).",
  llm_failed: "Refinement LLM failed — using your original prompt.",
}

function isDevPromptRefineDebug(): boolean {
  if (process.env.NODE_ENV === "development") return true
  if (typeof window === "undefined") return false
  const host = window.location.hostname
  return host === "localhost" || host === "127.0.0.1"
}

function showDevRefinementToast(title: string, description: string) {
  if (!isDevPromptRefineDebug()) return
  console.info(`[prompt-refine] ${title} — ${description}`)
}

export function usePromptRefinement({ purpose, tenantId, getContext }: UsePromptRefinementOptions) {
  const t = useTranslations("promptRefine")
  const [loading, setLoading] = useState(false)
  const [pendingProceed, setPendingProceed] = useState(false)
  const [countdownSeconds, setCountdownSeconds] = useState(0)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const undoToastRef = useRef<ReturnType<typeof toast> | null>(null)
  const proceedingRef = useRef(false)

  const clearPendingProceed = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    undoToastRef.current?.dismiss()
    undoToastRef.current = null
    setPendingProceed(false)
    setCountdownSeconds(0)
  }, [])

  useEffect(() => () => clearPendingProceed(), [clearPendingProceed])

  const scheduleProceedWithUndo = useCallback(
    (originalPrompt: string, callbacks: RunWithRefinementCallbacks, refinedPrompt: string) => {
      clearPendingProceed()
      proceedingRef.current = false

      callbacks.onAutoFill(refinedPrompt)

      let secondsLeft = Math.ceil(UNDO_DELAY_MS / 1000)
      setPendingProceed(true)
      setCountdownSeconds(secondsLeft)

      const finish = async (finalText: string) => {
        if (proceedingRef.current) return
        proceedingRef.current = true
        clearPendingProceed()
        await callbacks.onProceed(finalText.trim())
      }

      const handleUndo = () => {
        callbacks.onAutoFill(originalPrompt)
        void finish(originalPrompt)
      }

      const buildUndoToast = (seconds: number) => ({
        title: createElement(PromptRefineUndoToastContent, { seconds }),
        description: undefined,
        className: PROMPT_REFINE_TOAST_CLASS,
        duration: UNDO_DELAY_MS + 3000,
        action: createElement(
          ToastAction,
          { altText: t("undo"), onClick: handleUndo },
          t("undo"),
        ),
      })

      const updateUndoToast = (seconds: number) => {
        if (!undoToastRef.current) return
        undoToastRef.current.update({
          id: undoToastRef.current.id,
          ...buildUndoToast(seconds),
        })
      }

      undoToastRef.current = toast(buildUndoToast(secondsLeft))

      countdownRef.current = setInterval(() => {
        secondsLeft -= 1
        setCountdownSeconds(Math.max(0, secondsLeft))
        if (secondsLeft > 0) {
          updateUndoToast(secondsLeft)
        }
      }, 1000)

      timerRef.current = setTimeout(() => {
        void finish(callbacks.getCurrentText())
      }, UNDO_DELAY_MS)
    },
    [clearPendingProceed, t],
  )

  const runWithRefinement = useCallback(
    async (prompt: string, callbacks: RunWithRefinementCallbacks) => {
      const trimmed = prompt.trim()
      if (!trimmed) return

      proceedingRef.current = false
      setLoading(true)
      showDevRefinementToast("Prompt refine started", `Calling /ai/prompt/refine (${purpose})…`)

      try {
        const context = getContext?.() ?? {}
        const result = await refinePrompt(
          {
            prompt: trimmed,
            purpose,
            ...context,
          },
          tenantId,
        )

        if (result.skipped) {
          const reason = result.skipReason ?? "unknown"
          showDevRefinementToast(
            "Prompt refine skipped",
            SKIP_TOAST[reason as PromptRefinementSkipReason] ?? `Skipped (${reason}) — using original.`,
          )
          await callbacks.onProceed(trimmed)
          return
        }

        showDevRefinementToast(
          "Prompt refined",
          "Text updated — undo within 10s or research starts automatically.",
        )
        scheduleProceedWithUndo(result.originalPrompt, callbacks, result.refinedPrompt)
      } catch (err) {
        const msg = err instanceof Error ? err.message : "API error"
        showDevRefinementToast("Prompt refine failed", `${msg} — continuing with original.`)
        await callbacks.onProceed(trimmed)
      } finally {
        setLoading(false)
      }
    },
    [getContext, purpose, scheduleProceedWithUndo, tenantId],
  )

  return {
    loading,
    pendingProceed,
    countdownSeconds,
    runWithRefinement,
    cancelPendingProceed: clearPendingProceed,
  }
}
