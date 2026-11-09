"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  buildDeepResearchSteps,
  buildFastResearchSteps,
  buildGuidanceResearchSteps,
  type ResearchProgressStep,
} from "@/lib/legal-research/research-query-hints"
import { CheckCircle2, Circle, Loader2 } from "lucide-react"

const DETAIL_ROTATION_MS = 1800
const PHASE_STALL_SECONDS = 20

export type ResearchJobPhase =
  | "queued"
  | "classifying"
  | "preflight"
  | "planning"
  | "retrieving"
  | "resolving"
  | "enriching"
  | "generating"
  | "verifying"
  | "citation_audit"
  | "finalizing"
  | "completed"

export interface LegalResearchProgressProps {
  active: boolean
  query?: string
  countryCode?: string
  researchMode?: "FAST" | "DEEP" | "GUIDANCE"
  isPriorContext?: boolean
  className?: string
  /** Slower step cadence for public landing teaser (~60s API calls). */
  pace?: "default" | "relaxed"
  /** Job finished — allow progress bar to reach 100%. */
  complete?: boolean
  /** Draft memo is already on screen — mark Draft complete. */
  hasDraft?: boolean
  /** Real backend phase (async jobs); overrides timer when set. */
  phase?: ResearchJobPhase
  /** Actionable backend message for the active stage. */
  phaseMessage?: string
}

export function LegalResearchProgress({
  active,
  query = "",
  countryCode = "IN",  // default kept for backwards compat
  researchMode = "FAST",
  isPriorContext = false,
  className,
  complete = false,
  hasDraft = false,
  phase,
  phaseMessage,
}: LegalResearchProgressProps) {
  const tProgress = useTranslations("marketing.home.researchProgress")

  const translateStep = useCallback(
    (key: string, params?: Record<string, string | number | undefined>) =>
      tProgress(
        key as Parameters<typeof tProgress>[0],
        params as Record<string, string | number | Date>,
      ),
    [tProgress],
  )

  const steps = useMemo<ResearchProgressStep[]>(() => {
    if (researchMode === "DEEP") return buildDeepResearchSteps(query, countryCode, translateStep)
    if (researchMode === "GUIDANCE") {
      return buildGuidanceResearchSteps(query, countryCode, translateStep)
    }
    return buildFastResearchSteps(query, countryCode, translateStep)
  }, [query, countryCode, researchMode, translateStep])

  const [stepIdx, setStepIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [detailRotation, setDetailRotation] = useState(0)
  const [phaseStallSeconds, setPhaseStallSeconds] = useState(0)
  const lastPhaseRef = useRef<ResearchJobPhase | undefined>(undefined)
  const lastPhaseChangeAtRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!active) {
      setStepIdx(0)
      setElapsed(0)
      setDetailRotation(0)
      return
    }

    setStepIdx(0)
    setElapsed(0)
    setDetailRotation(0)

    const ticker = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(ticker)
  }, [active, query, researchMode])

  useEffect(() => {
    // Without a server phase, report waiting rather than inventing completed work.
    if (active && !phase) setStepIdx(0)
  }, [active, phase])

  useEffect(() => {
    if (!active || !phase) return
    const indexOf = (id: string, fallback: number) => {
      const found = steps.findIndex((step) => step.id === id)
      return found >= 0 ? found : fallback
    }
    const readyIdx = indexOf("ready", steps.length - 1)
    const draftIdx = indexOf("draft", 1)
    const selfCheckIdx = indexOf("selfcheck", draftIdx + 1)
    const phaseMap: Partial<Record<ResearchJobPhase, number>> = {
      queued: 0,
      classifying: 0,
      preflight: 0,
      planning: 0,
      retrieving: indexOf("retrieve", 0),
      resolving: indexOf("retrieve", 0),
      enriching: indexOf("retrieve", 0),
      generating: draftIdx,
      verifying: researchMode === "DEEP" ? selfCheckIdx : indexOf("finalize", Math.max(0, readyIdx - 1)),
      citation_audit: indexOf("finalize", Math.max(0, readyIdx - 1)),
      finalizing: indexOf("finalize", Math.max(0, readyIdx - 1)),
      completed: readyIdx,
    }
    let next = phaseMap[phase] ?? 0
    if (hasDraft) {
      const draftIdx = steps.findIndex((step) => step.id === "draft")
      if (draftIdx >= 0) next = Math.max(next, draftIdx + 1)
    }
    setStepIdx(Math.min(next, Math.max(0, steps.length - 1)))
  }, [active, phase, steps, researchMode, hasDraft])

  useEffect(() => {
    if (!active || !phase) {
      setPhaseStallSeconds(0)
      return
    }
    if (phase !== lastPhaseRef.current) {
      lastPhaseRef.current = phase
      lastPhaseChangeAtRef.current = Date.now()
      setPhaseStallSeconds(0)
    }
    const interval = setInterval(() => {
      setPhaseStallSeconds(Math.floor((Date.now() - lastPhaseChangeAtRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [active, phase])

  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => {
      setDetailRotation((d) => d + 1)
    }, DETAIL_ROTATION_MS)
    return () => clearInterval(interval)
  }, [active, stepIdx])

  if (!active) return null

  const rawProgress = phase ? Math.round((stepIdx / Math.max(1, steps.length - 1)) * 100) : 0
  const progressCap = hasDraft && !complete ? 95 : 90
  const progress = complete ? 100 : Math.min(rawProgress, progressCap)
  const activeStep = steps[stepIdx]

  const activeDetail = (() => {
    if (phaseMessage) return phaseMessage
    if (!phase) return tProgress("waitingForServer")
    if (!activeStep) return undefined
    const rotating = activeStep.rotatingDetails
    if (rotating?.length) {
      return rotating[detailRotation % rotating.length]
    }
    return activeStep.detail
  })()

  return (
    <div
      className={cn("rounded-xl border bg-card p-4 space-y-3 shadow-sm animate-fade-in", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
          </span>
          <p className="text-sm font-semibold truncate">
            {isPriorContext ? tProgress("refiningTitle") : tProgress("runningTitle")}
          </p>
          <Badge variant="secondary" className="text-xs px-1.5 py-0 shrink-0">
            {researchMode === "DEEP"
              ? tProgress("modeVerified")
              : researchMode === "GUIDANCE"
                ? tProgress("modeGuidance")
                : tProgress("modeFast")}
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground tabular-nums">{elapsed}s</span>

        </div>
      </div>

      {query.trim() && (
        <p className="text-xs text-muted-foreground truncate border-l-2 border-primary/30 pl-2">
          {query.trim()}
        </p>
      )}

      {phase && phaseStallSeconds >= PHASE_STALL_SECONDS && !complete && (
        <p className="text-xs text-muted-foreground bg-muted/40 border rounded-md px-3 py-2">
          {tProgress("phaseStallNote")}
        </p>
      )}

      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-1 bg-primary rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-0.5 max-h-[min(22rem,50vh)] overflow-y-auto pr-1">
        {steps.map((step, i) => {
          const isDone = i < stepIdx
          const isActive = i === stepIdx
          const detail =
            isActive && activeDetail
              ? activeDetail
              : isDone
                ? step.detail
                : undefined

          return (
            <div
              key={`${step.label}-${i}`}
              className={cn(
                "flex gap-3 items-start px-2 py-1.5 rounded-lg transition-colors duration-300",
                isActive && "bg-primary/5",
              )}
            >
              <div className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center">
                {isDone && <CheckCircle2 className="w-4 h-4 text-primary" />}
                {isActive && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                {!isDone && !isActive && <Circle className="w-4 h-4 text-muted-foreground/25" />}
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm transition-colors duration-300",
                    isDone && "text-muted-foreground/60",
                    isActive && "font-medium text-foreground",
                    !isDone && !isActive && "text-muted-foreground/40",
                  )}
                >
                  {step.label}
                </p>
                {detail && (
                  <p
                    key={isActive ? `${detail}-${detailRotation}` : detail}
                    className={cn(
                      "text-xs text-muted-foreground mt-0.5",
                      isActive && "animate-fade-in",
                    )}
                  >
                    {detail}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
