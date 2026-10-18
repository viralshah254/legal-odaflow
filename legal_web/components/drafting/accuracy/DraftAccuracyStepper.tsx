"use client"

import { useTranslations } from "next-intl"
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react"
import type { DraftVerificationAudit } from "@/lib/api/draft-verification"

type StepStatus = "pass" | "warn" | "fail"

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
  if (status === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
  return <XCircle className="h-3.5 w-3.5 text-red-500" />
}

interface DraftAccuracyStepperProps {
  verification: DraftVerificationAudit
}

export function DraftAccuracyStepper({ verification }: DraftAccuracyStepperProps) {
  const t = useTranslations("drafting.accuracy")

  const steps: Array<{ id: string; label: string; status: StepStatus }> = [
    {
      id: "statutes",
      label: t("stepStatutes"),
      status:
        verification.corrections.length > 0 || verification.sectionChecks.anyCorrections
          ? "warn"
          : "pass",
    },
    {
      id: "citations",
      label: t("stepCitations"),
      status:
        verification.strippedCitations.length > 0 ||
        verification.citationWarnings.some((w) => /unverifiable/i.test(w))
          ? "fail"
          : verification.citationWarnings.length > 0
            ? "warn"
            : "pass",
    },
    {
      id: "cases",
      label: t("stepCases"),
      status: verification.similarCases.length >= 2 ? "pass" : "warn",
    },
    {
      id: "procedural",
      label: t("stepProcedural"),
      status: verification.proceduralWarnings.length > 0 ? "warn" : "pass",
    },
    {
      id: "completeness",
      label: t("stepCompleteness"),
      status: verification.completenessGaps.length > 0 ? "warn" : "pass",
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
      {steps.map((step) => (
        <div
          key={step.id}
          className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/50 px-2 py-1.5"
        >
          <StepIcon status={step.status} />
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  )
}
