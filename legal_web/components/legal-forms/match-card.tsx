"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface MatchCardProps {
  children: ReactNode
  featured?: boolean
  className?: string
}

/** Shared visual container for a non-bundle drafting recommendation. */
export function MatchCard({ children, featured = false, className }: MatchCardProps) {
  return (
    <article
      className={cn(
        "space-y-3 rounded-xl border p-4 transition-colors hover:border-primary/30 hover:bg-muted/30",
        featured ? "border-primary/40 bg-primary/[0.03]" : "border-border",
        className,
      )}
    >
      {children}
    </article>
  )
}
