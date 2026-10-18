"use client"
import { useState } from "react"
import { ArrowRight, Check, Loader2, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { PlanQuestion } from "@/lib/api/consumers"
import { IntakeAnalysisProgress } from "./intake-analysis-progress"

interface RefinementSidePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  questions: PlanQuestion[]
  onSubmit: (answers: Record<string, string | string[]>) => void
  isSubmitting?: boolean
}

export function RefinementSidePanel({
  open,
  onOpenChange,
  questions,
  onSubmit,
  isSubmitting = false,
}: RefinementSidePanelProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [otherText, setOtherText] = useState<Record<string, string>>({})

  const handleChipToggle = (questionId: string, option: string, isMulti: boolean) => {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[questionId])
        ? (prev[questionId] as string[])
        : prev[questionId]
          ? [prev[questionId] as string]
          : []

      if (isMulti) {
        const isSelected = cur.includes(option)
        return { ...prev, [questionId]: isSelected ? cur.filter((v) => v !== option) : [...cur, option] }
      }
      // Single select: toggle off if already selected
      const isSelected = cur.includes(option)
      return { ...prev, [questionId]: isSelected ? [] : [option] }
    })
  }

  const handleAllOfAbove = (questionId: string, options: string[]) => {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : []
      const allSelected = cur.length === options.length
      return { ...prev, [questionId]: allSelected ? [] : [...options] }
    })
  }

  const buildFinalAnswers = (): Record<string, string | string[]> => {
    const merged: Record<string, string | string[]> = {}

    for (const q of questions) {
      if (q.type === "text") {
        const text = otherText[q.id] ?? ""
        if (text) merged[q.id] = text
      } else {
        const selected = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : answers[q.id] ? [answers[q.id] as string] : []
        const extra = otherText[q.id] ?? ""
        if (selected.length > 0) {
          merged[q.id] = extra && !selected.includes(extra) ? [...selected, extra] : selected
        } else if (extra) {
          merged[q.id] = [extra]
        }
      }
    }

    return merged
  }

  const handleSubmit = () => {
    onSubmit(buildFinalAnswers())
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col p-0 gap-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-2 text-primary">
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            <SheetTitle className="text-base">Refine your analysis</SheetTitle>
          </div>
          <SheetDescription>
            Answer {questions.length} targeted question{questions.length !== 1 ? "s" : ""} for more specific guidance
          </SheetDescription>
        </SheetHeader>

        {isSubmitting ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <IntakeAnalysisProgress active hasDocuments={false} variant="preview" className="w-full" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {questions.map((q, idx) => {
                const selectedArr = Array.isArray(answers[q.id])
                  ? (answers[q.id] as string[])
                  : answers[q.id]
                    ? [answers[q.id] as string]
                    : []
                const qType = q.type === "text" ? "text" : "multi"

                return (
                  <div
                    key={q.id}
                    className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center mt-0.5 leading-none">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground leading-snug">
                            {q.text}
                          </span>
                          {selectedArr.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-primary/15 text-primary rounded-full px-2 py-0.5 shrink-0">
                              <Check className="h-2.5 w-2.5" />
                              {selectedArr.length} selected
                            </span>
                          )}
                        </div>
                        {qType !== "text" && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">Select all that apply</p>
                        )}
                      </div>
                    </div>

                    {qType === "text" && (
                      <Textarea
                        rows={2}
                        className="resize-none text-sm"
                        placeholder="Describe in your own words…"
                        value={otherText[q.id] ?? ""}
                        onChange={(e) =>
                          setOtherText((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                      />
                    )}

                    {qType === "multi" && (
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap gap-2">
                          {q.options.map((opt) => {
                            const isSelected = selectedArr.includes(opt)
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleChipToggle(q.id, opt, true)}
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border transition-all",
                                  isSelected
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                                    : "bg-background/80 border-border/70 text-foreground/80 hover:border-primary/50 hover:bg-primary/8 hover:text-foreground",
                                )}
                              >
                                {isSelected && <Check className="h-3 w-3 shrink-0" />}
                                {opt}
                              </button>
                            )
                          })}
                          {q.allowAllOfAbove && (
                            <button
                              type="button"
                              onClick={() => handleAllOfAbove(q.id, q.options)}
                              className={cn(
                                "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-dashed transition-all",
                                selectedArr.length === q.options.length
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background/80 border-border/70 text-foreground/80 hover:border-primary/50 hover:bg-primary/8",
                              )}
                            >
                              All of the above
                            </button>
                          )}
                        </div>
                        {selectedArr.length > 0 && (
                          <Textarea
                            rows={2}
                            className="resize-none text-sm mt-1"
                            placeholder="Add more context (optional)…"
                            value={otherText[q.id] ?? ""}
                            onChange={(e) =>
                              setOtherText((prev) => ({ ...prev, [q.id]: e.target.value }))
                            }
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="shrink-0 border-t px-6 py-4">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full group"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Refining analysis…
                  </>
                ) : (
                  <>
                    Refine analysis
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
