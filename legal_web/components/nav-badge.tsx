"use client"

import { cn } from "@/lib/utils"

interface NavBadgeProps {
  count?: number | null
  /** Visual emphasis: "default" muted, "urgent" destructive */
  variant?: "default" | "urgent"
  className?: string
}

/** Small count pill for sidebar nav items. Hidden at 0/undefined, caps at 9+. */
export function NavBadge({ count, variant = "default", className }: NavBadgeProps) {
  if (!count || count <= 0) return null
  const label = count > 9 ? "9+" : String(count)

  return (
    <span
      className={cn(
        "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-none shrink-0",
        variant === "urgent"
          ? "bg-destructive text-destructive-foreground"
          : "bg-primary/15 text-primary",
        className,
      )}
      aria-label={`${count} items`}
    >
      {label}
    </span>
  )
}
