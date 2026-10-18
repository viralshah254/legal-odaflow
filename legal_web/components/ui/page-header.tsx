import * as React from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  /** Right-side action slot (buttons, filters, etc.) */
  actions?: React.ReactNode
  className?: string
  /** Optional badge/chip rendered after the title */
  badge?: React.ReactNode
}

/**
 * Consistent page header used across all main app pages.
 * Strong visual anchor: large bold title, description, actions, and a
 * gradient accent line at the bottom.
 */
export function PageHeader({
  title,
  description,
  actions,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("relative mb-7", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[1.65rem] font-bold tracking-tight text-foreground leading-tight">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-xl">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>
      {/* Gradient accent line */}
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-primary/50 via-primary/20 to-transparent" />
    </div>
  )
}
