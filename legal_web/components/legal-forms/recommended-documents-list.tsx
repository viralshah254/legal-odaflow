"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface RecommendedDocumentsListProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

/**
 * Provides a single visual boundary for the documents selected for a matter.
 * The individual document rows remain intentionally flexible: they may be
 * curated AI drafts, official forms, or generated documents.
 */
export function RecommendedDocumentsList({
  title,
  description,
  children,
  className,
}: RecommendedDocumentsListProps) {
  return (
    <section className={cn("space-y-3 rounded-xl border border-primary/25 bg-primary/[0.03] p-4", className)}>
      <header>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  )
}
