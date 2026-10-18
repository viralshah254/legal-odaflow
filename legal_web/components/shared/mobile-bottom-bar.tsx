"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface MobileBottomBarProps {
  children: ReactNode
  className?: string
  /** When true, bar is always visible. Default: only below xl. */
  alwaysVisible?: boolean
}

/**
 * Fixed bottom action bar with blur, border, and safe-area padding.
 * Hide on desktop with `xl:hidden` unless `alwaysVisible`.
 */
export function MobileBottomBar({
  children,
  className,
  alwaysVisible = false,
}: MobileBottomBarProps) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90",
        "px-4 pt-3 pb-4 pb-safe-bottom",
        !alwaysVisible && "xl:hidden",
        className,
      )}
    >
      {children}
    </div>
  )
}
