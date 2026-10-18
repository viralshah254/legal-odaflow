"use client"

import { useState } from "react"
import { ChevronDown, MessageSquareText } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

function splitUserProblem(text: string): { problem: string; hasContract: boolean } {
  const trimmed = text.trim()
  const contractStart = trimmed.search(
    /\n\s*(SOFTWARE IMPLEMENTATION|THIS AGREEMENT|AGREEMENT dated|WITNESSETH|PARTIES:|WHEREAS\b)/i,
  )
  const problem = (contractStart > 40 ? trimmed.slice(0, contractStart) : trimmed)
    .replace(/\s+/g, " ")
    .trim()
  return {
    problem: problem.slice(0, 160) + (problem.length > 160 ? "…" : ""),
    hasContract: contractStart > 40 || trimmed.length > 400,
  }
}

export function ResearchPromptPanel({
  query,
  defaultOpen = false,
}: {
  query: string
  defaultOpen?: boolean
}) {
  const t = useTranslations("matters")
  const [open, setOpen] = useState(defaultOpen)
  const trimmed = query.trim()
  if (!trimmed) return null
  const { problem, hasContract } = splitUserProblem(trimmed)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-start gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-left hover:bg-muted/35 transition-colors"
        >
          <MessageSquareText className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("researchPromptTitle")}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                  open ? "rotate-180" : ""
                }`}
              />
            </div>
            {!open && (
              <p className="text-sm text-foreground line-clamp-2 leading-relaxed">
                {problem}
                {hasContract ? " · Show attached contract" : ""}
              </p>
            )}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-b-lg border border-t-0 bg-muted/10 px-4 pb-4 pt-3">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{trimmed}</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
