"use client"

import { OpenCopilotButton } from "@/components/copilot/open-copilot-button"
import { cn } from "@/lib/utils"

interface PageCopilotActionsProps {
  className?: string
  label?: string
}

/** Standard CRM page header action: opens the Copilot drawer with current URL context. */
export function PageCopilotActions({ className, label }: PageCopilotActionsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <OpenCopilotButton label={label} />
    </div>
  )
}
