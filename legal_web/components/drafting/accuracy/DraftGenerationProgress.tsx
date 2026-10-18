"use client"

import { useEffect, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

const STEP_KEYS = [
  "stepResearch",
  "stepRoute",
  "stepDrafting",
  "stepVerifyingStatutes",
  "stepCrossCheckingCases",
] as const

// v2 engine steps shown when engineVersion === "v2"
const V2_STEP_LABELS = [
  "Analysing matter — building legal plan",
  "Knowledge graph — verifying statutes & ingredients",
  "Rule engine — limitation, jurisdiction, court fees",
  "Building document outline",
  "Validating evidence",
  "Generating sections in parallel",
  "Verifying citations per section",
  "Targeted repair — fixing failing sections",
  "Assembling final document",
] as const

/** Max step index while waiting — never auto-complete the final verification steps. */
const MAX_ACTIVE_STEP = 2
const MAX_V2_ACTIVE_STEP = 6

// v3 stage order and labels (matches backend STAGE_LABEL constant)
const V3_STAGES = [
  { key: "normalizing",      label: "Reviewing case details" },
  { key: "procedural_check", label: "Checking procedure and jurisdiction" },
  { key: "retrieving",       label: "Finding verified legal authorities" },
  { key: "planning",         label: "Planning the document" },
  { key: "generating",       label: "Drafting sections" },
  { key: "verifying",        label: "Checking citations and legal accuracy" },
  { key: "repairing",        label: "Repairing flagged sections" },
  { key: "assembling",       label: "Finalizing your draft" },
] as const

interface DraftGenerationProgressProps {
  active: boolean
  className?: string
  accentClassName?: string
  variant?: "filingGrade" | "express"
  /** When true, show v2 stage steps instead of v1 steps */
  engineVersion?: "v1" | "v2" | "v3"
  /** Real percent (0–100) from the unified engine (v3). When provided, drives the progress bar. */
  serverPercent?: number
  /** Current stage key from the unified engine (v3). */
  serverStage?: string
}

export function DraftGenerationProgress({
  active,
  className,
  accentClassName = "text-indigo-500",
  variant = "filingGrade",
  engineVersion = "v1",
  serverPercent,
  serverStage,
}: DraftGenerationProgressProps) {
  const t = useTranslations("drafting.accuracy")
  const isV2 = engineVersion === "v2"
  const isV3 = engineVersion === "v3"
  const maxActiveStep = isV2 ? MAX_V2_ACTIVE_STEP : MAX_ACTIVE_STEP

  const [stepIdx, setStepIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active) {
      setStepIdx(0)
      setElapsed(0)
      return
    }

    setStepIdx(0)
    setElapsed(0)
    const started = Date.now()
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000))
    }, 1000)
    // v3 uses server-driven progress; suppress fake step advancement
    if (isV3) {
      return () => clearInterval(tick)
    }
    const stepInterval = isV2 ? 4500 : 3500
    const interval = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, maxActiveStep))
    }, stepInterval)
    return () => {
      clearInterval(interval)
      clearInterval(tick)
    }
  }, [active, isV2, isV3, maxActiveStep])

  if (!active) return null

  const isExpress = variant === "express"
  const longWaitThreshold = isExpress ? 45 : isV2 ? 120 : 90

  // ── v3: server-driven real progress bar ─────────────────────────────────
  if (isV3) {
    const pct = serverPercent ?? 2
    // Map queued → normalizing so the first step shows as active immediately on queue
    const effectiveStage = serverStage === "queued" ? "normalizing" : serverStage
    const currentStageIdx = V3_STAGES.findIndex((s) => s.key === effectiveStage)
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-5 min-h-[420px] text-gray-500 dark:text-gray-400",
          className,
        )}
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className={cn("h-8 w-8 animate-spin", accentClassName)} />
        <p className="text-xs text-muted-foreground">
          {t("elapsedSeconds", { seconds: elapsed })}
        </p>

        {/* Progress bar */}
        <div className="w-full max-w-xs">
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
            <span>{pct}%</span>
            <span>100%</span>
          </div>
          <div
            className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"
            role="progressbar"
            aria-label="Draft generation progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-valuetext={`${pct}% — ${V3_STAGES[currentStageIdx]?.label ?? "Preparing draft"}`}
          >
            <div
              className={cn("h-full rounded-full transition-all duration-700", "bg-indigo-500")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Stage checklist */}
        <div className="space-y-2.5 text-sm w-full max-w-xs">
          {V3_STAGES.map((stage, i) => {
            const done = currentStageIdx >= 0 ? i < currentStageIdx : false
            const current = i === currentStageIdx
            const pending = !done && !current
            return (
              <div
                key={stage.key}
                className={cn(
                  "flex items-center gap-2 transition-colors",
                  done || current ? "text-gray-800 dark:text-gray-200" : "text-gray-400 dark:text-gray-600",
                )}
              >
                {done ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : current ? (
                  <Loader2 className={cn("h-4 w-4 shrink-0 animate-spin", accentClassName)} />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-full border border-gray-300 dark:border-gray-600" />
                )}
                <span className={cn(pending && "opacity-60")}>{stage.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 min-h-[420px] text-gray-500 dark:text-gray-400",
        className,
      )}
      role="progressbar"
      aria-label="Draft generation progress"
      aria-valuemin={0}
      aria-valuemax={isV2 ? V2_STEP_LABELS.length : STEP_KEYS.length}
      aria-valuenow={stepIdx + 1}
      aria-valuetext={
        isV2
          ? V2_STEP_LABELS[stepIdx]
          : t(STEP_KEYS[stepIdx])
      }
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className={cn("h-8 w-8 animate-spin", accentClassName)} />
      <p className="text-xs text-muted-foreground">
        {t("elapsedSeconds", { seconds: elapsed })}
      </p>
      {elapsed >= 20 && (
        <p className="text-xs text-center text-muted-foreground max-w-xs">
          {isV2
            ? "v2 engine: sections generate in parallel with per-section verification."
            : isExpress
              ? "Express drafts usually finish in 15–45 seconds."
              : "Filing-grade pleadings: 60–120 seconds for statute checks and verification."}
        </p>
      )}
      {elapsed >= longWaitThreshold && (
        <p className="text-xs text-center text-muted-foreground max-w-xs">
          {isV2
            ? "Still working — targeted repair and final assembly in progress."
            : isExpress
              ? "Still working — finalizing your draft."
              : "Still working — enrichment and verification in progress."}
        </p>
      )}

      {isV2 ? (
        // v2 steps
        <div className="space-y-2.5 text-sm w-full max-w-xs">
          {V2_STEP_LABELS.map((label, i) => {
            const done = i < stepIdx
            const current = i === stepIdx
            const pending = i > stepIdx
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 transition-colors",
                  done || current ? "text-gray-800 dark:text-gray-200" : "text-gray-400 dark:text-gray-600",
                )}
              >
                {done ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : current ? (
                  <Loader2 className={cn("h-4 w-4 shrink-0 animate-spin", accentClassName)} />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-full border border-gray-300 dark:border-gray-600" />
                )}
                <span className={cn(pending && "opacity-60")}>{label}</span>
              </div>
            )
          })}
        </div>
      ) : (
        // v1 steps (unchanged)
        <div className="space-y-2.5 text-sm w-full max-w-xs">
          {STEP_KEYS.map((key, i) => {
            const done = i < stepIdx
            const current = i === stepIdx
            const pending = i > stepIdx
            return (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-2 transition-colors",
                  done || current ? "text-gray-800 dark:text-gray-200" : "text-gray-400 dark:text-gray-600",
                )}
              >
                {done ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : current ? (
                  <Loader2 className={cn("h-4 w-4 shrink-0 animate-spin", accentClassName)} />
                ) : (
                  <span className="h-4 w-4 shrink-0 rounded-full border border-gray-300 dark:border-gray-600" />
                )}
                <span className={cn(pending && "opacity-60")}>{t(key)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
