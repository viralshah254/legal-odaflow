"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { getActionContextPrompt } from "@/lib/drafting/action-context-prompts"

interface ActionContextRefineBlockProps {
  nextBestAction?: string
  recommendedActions?: string[]
  actionNotes: Record<string, string>
  onActionNotesChange: (updater: (prev: Record<string, string>) => Record<string, string>) => void
  className?: string
}

export function ActionContextRefineBlock({
  nextBestAction,
  recommendedActions = [],
  actionNotes,
  onActionNotesChange,
  className,
}: ActionContextRefineBlockProps) {
  const [expandedActions, setExpandedActions] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    if (nextBestAction) initial.add(nextBestAction)
    return initial
  })

  const actionsToShow = [
    ...(nextBestAction ? [nextBestAction] : []),
    ...recommendedActions.filter((a) => a !== nextBestAction),
  ]

  if (actionsToShow.length === 0) return null

  const toggleExpanded = (action: string) => {
    setExpandedActions((prev) => {
      const next = new Set(prev)
      if (next.has(action)) next.delete(action)
      else next.add(action)
      return next
    })
  }

  const setNote = (action: string, value: string) => {
    onActionNotesChange((prev) => ({ ...prev, [action]: value }))
  }

  return (
    <ul className={cn("space-y-1.5", className)}>
      {actionsToShow.map((action) => {
        const prompt = getActionContextPrompt(action)
        const expanded = expandedActions.has(action)
        const isPrimary = action === nextBestAction
        const hasNote = Boolean(actionNotes[action]?.trim())

        return (
          <li
            key={action}
            className={cn(
              "rounded-lg border overflow-hidden",
              isPrimary
                ? "border-primary/25 bg-primary/5"
                : "border-border/60 bg-background/40",
            )}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
              onClick={() => toggleExpanded(action)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {hasNote && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                )}
                <p className={cn("text-sm leading-snug truncate", isPrimary ? "font-medium" : "text-muted-foreground")}>
                  {action}
                </p>
              </div>
              {expanded
                ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            </button>

            {expanded && (
              <div className="border-t border-border/40 px-3 pb-3 pt-2.5 space-y-1.5">
                {prompt ? (
                  <>
                    <p className="text-xs font-medium text-foreground/80">{prompt.label}</p>
                    <Textarea
                      value={actionNotes[action] ?? ""}
                      onChange={(e) => setNote(action, e.target.value)}
                      rows={3}
                      placeholder={prompt.placeholder}
                      className="text-sm resize-y min-h-[72px]"
                    />
                  </>
                ) : (
                  <Textarea
                    value={actionNotes[action] ?? ""}
                    onChange={(e) => setNote(action, e.target.value)}
                    rows={3}
                    placeholder={`Additional context for: ${action}`}
                    className="text-sm resize-y min-h-[72px]"
                  />
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
