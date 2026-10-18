"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type DraftWizardStep = "input" | "context_review" | "results"

interface DraftWizardStepsProps {
  currentStep: DraftWizardStep
}

const steps: Array<{ id: DraftWizardStep; label: string }> = [
  { id: "input", label: "Describe" },
  { id: "context_review", label: "Confirm facts" },
  { id: "results", label: "Choose documents" },
]

export function DraftWizardSteps({ currentStep }: DraftWizardStepsProps) {
  const currentIndex = steps.findIndex((step) => step.id === currentStep)

  return (
    <ol className="flex items-center gap-2" aria-label="Drafting progress">
      {steps.map((step, index) => {
        const complete = index < currentIndex
        const current = index === currentIndex

        return (
          <li key={step.id} className="flex min-w-0 items-center gap-2">
            {index > 0 && <span aria-hidden className="h-px w-4 bg-border sm:w-8" />}
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                current && "border-primary bg-primary text-primary-foreground",
                complete && "border-primary/30 bg-primary/10 text-primary",
                !current && !complete && "border-border bg-background text-muted-foreground",
              )}
              aria-current={current ? "step" : undefined}
            >
              {complete ? <Check className="h-3 w-3" /> : <span>{index + 1}</span>}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
