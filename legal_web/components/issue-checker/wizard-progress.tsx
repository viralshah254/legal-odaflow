"use client"

import { useTranslations } from "next-intl"
import { Check } from "lucide-react"
import { useIssueCheckerLabels } from "@/lib/i18n/use-issue-checker-labels"
import { cn } from "@/lib/utils"

type WizardProgressVariant = "full" | "compact" | "mobile"

export function WizardProgress({
  step,
  title,
  variant = "full",
}: {
  step: number
  title?: string
  variant?: WizardProgressVariant
}) {
  const t = useTranslations("issueChecker")
  const { steps } = useIssueCheckerLabels()
  const heading = title ?? t("title")

  if (variant === "compact") {
    return (
      <div className="rounded-lg border bg-card p-4 shadow-sm space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Step {step + 1} of {steps.length}
        </p>
        {steps.map((label, index) => {
          const done = index < step
          const active = index === step
          return (
            <div
              key={label}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                active && "bg-primary/5",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  done && "bg-primary text-primary-foreground",
                  active && !done && "bg-primary/15 text-primary ring-1 ring-primary/30",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "truncate",
                  active ? "font-semibold text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/70",
                )}
              >
                {label}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  const progressBar = (
    <div className="flex gap-1">
      {steps.map((_, index) => (
        <div
          key={index}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-all duration-300",
            index < step ? "bg-primary" : index === step ? "bg-primary/70" : "bg-muted",
          )}
        />
      ))}
    </div>
  )

  if (variant === "mobile") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {t("stepProgress", { current: step + 1, total: steps.length, label: steps[step] ?? "" })}
        </p>
        {progressBar}
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold">{heading}</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("stepProgress", { current: step + 1, total: steps.length, label: steps[step] ?? "" })}
      </p>
      {progressBar}
    </div>
  )
}
