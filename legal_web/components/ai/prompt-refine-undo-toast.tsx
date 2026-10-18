"use client"

import { Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

const UNDO_WINDOW_SECONDS = 10

export interface PromptRefineUndoToastContentProps {
  seconds: number
  className?: string
}

export function PromptRefineUndoToastContent({
  seconds,
  className,
}: PromptRefineUndoToastContentProps) {
  const t = useTranslations("promptRefine")
  const progress = Math.max(0, Math.min(100, (seconds / UNDO_WINDOW_SECONDS) * 100))

  return (
    <div className={cn("flex gap-3 pr-6", className)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
        <Sparkles className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="space-y-1">
          <p className="text-sm font-semibold leading-snug text-foreground">
            {t("autoFilledTitle")}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("autoFilledDescription", { seconds })}
          </p>
        </div>
        <div className="space-y-1">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={seconds}
            aria-valuemin={0}
            aria-valuemax={UNDO_WINDOW_SECONDS}
            aria-label={t("autoFillCountdownAria", { seconds })}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
            {t("autoFillHint")}
          </p>
        </div>
      </div>
    </div>
  )
}

export const PROMPT_REFINE_TOAST_CLASS =
  "prompt-refine-toast flex-col items-stretch gap-0 space-x-0 border-primary/15 bg-card/95 p-4 shadow-xl ring-1 ring-primary/10 backdrop-blur-sm sm:max-w-[380px]"
