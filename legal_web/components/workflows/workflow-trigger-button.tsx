"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"
import { WorkflowSuggestionSheet } from "./workflow-suggestion-sheet"
import type { WorkflowDefinition } from "./workflow-suggestion-sheet"
import { cn } from "@/lib/utils"

interface WorkflowTriggerButtonProps {
  matterId?: string
  practiceArea?: string
  trigger?: "upload" | "matter-open" | "manual"
  onWorkflowSelect?: (workflow: WorkflowDefinition) => void
  variant?: "button" | "fab"
  className?: string
  /** Controlled open state — when provided the parent manages open/close. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Floating "Run a workflow" button that opens the WorkflowSuggestionSheet.
 * Drop into any matter or document page to enable the expand→collapse workflow pattern.
 */
export function WorkflowTriggerButton({
  matterId,
  practiceArea,
  trigger = "manual",
  onWorkflowSelect,
  variant = "button",
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: WorkflowTriggerButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = (val: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(val)
    } else {
      setInternalOpen(val)
    }
  }

  if (variant === "fab") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full",
            "bg-primary text-primary-foreground shadow-lg px-4 py-2.5 text-sm font-semibold",
            "hover:bg-primary/90 transition-all hover:shadow-xl hover:scale-105 active:scale-95",
            className,
          )}
        >
          <Sparkles className="h-4 w-4" />
          Run a workflow
        </button>
        <WorkflowSuggestionSheet
          open={open}
          onOpenChange={setOpen}
          matterId={matterId}
          trigger={trigger}
          practiceArea={practiceArea}
          onWorkflowSelect={onWorkflowSelect}
        />
      </>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn("gap-1.5", className)}
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Run a workflow
      </Button>
      <WorkflowSuggestionSheet
        open={open}
        onOpenChange={setOpen}
        matterId={matterId}
        trigger={trigger}
        practiceArea={practiceArea}
        onWorkflowSelect={onWorkflowSelect}
      />
    </>
  )
}
