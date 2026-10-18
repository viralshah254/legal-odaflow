"use client"

import { cn } from "@/lib/utils"

export type DraftMobileTab = "form" | "draft"

interface DraftMobileTabBarProps {
  active: DraftMobileTab
  onChange: (tab: DraftMobileTab) => void
  draftReady?: boolean
  formLabel?: string
  draftLabel?: string
  className?: string
}

/**
 * Sticky Form / Draft tab switcher for split-pane drafting flows on mobile.
 * Hidden at `xl` where the two-column layout takes over.
 */
export function DraftMobileTabBar({
  active,
  onChange,
  draftReady = false,
  formLabel = "Form",
  draftLabel = "Draft",
  className,
}: DraftMobileTabBarProps) {
  return (
    <div
      className={cn(
        "xl:hidden sticky top-0 z-20 -mx-4 px-4 pt-1 pb-2 bg-background/95 backdrop-blur border-b border-border mb-4 flex gap-1",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange("form")}
        className={cn(
          "flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors",
          active === "form"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        {formLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange("draft")}
        className={cn(
          "flex-1 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-colors",
          active === "draft"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        {draftLabel}
        {draftReady ? " ✓" : ""}
      </button>
    </div>
  )
}
