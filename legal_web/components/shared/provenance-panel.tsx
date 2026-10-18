"use client"

import { useState } from "react"
import { ExternalLink, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { ConfidenceBadge } from "./confidence-badge"

interface ProvenanceItem {
  id: string
  title: string
  citation?: string
  sourceUrl?: string
  jurisdiction?: string
  confidence: number
  treatmentStatus?: string
}

interface ProvenancePanelProps {
  items: ProvenanceItem[]
  title?: string
  collapsible?: boolean
}

function TreatmentBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    overruled: 'bg-destructive/10 text-destructive',
    distinguished: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    followed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    approved: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  }
  const cls = map[status.toLowerCase()] ?? 'bg-secondary text-secondary-foreground'
  const showWarning = ['overruled', 'distinguished'].includes(status.toLowerCase())
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium capitalize", cls)}>
      {showWarning && <AlertTriangle className="h-3 w-3" />}
      {status}
    </span>
  )
}

export function ProvenancePanel({ items, title = "Sources", collapsible = false }: ProvenancePanelProps) {
  const [open, setOpen] = useState(!collapsible)

  return (
    <div className="rounded-lg border bg-card text-card-foreground">
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-between px-4 py-3 text-sm font-medium",
          collapsible ? "cursor-pointer hover:bg-muted/50" : "cursor-default",
        )}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{items.length} source{items.length !== 1 ? 's' : ''}</span>
          {collapsible && (open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
        </span>
      </button>

      {open && (
        <ul className="divide-y divide-border border-t">
          {items.map((item) => (
            <li key={item.id} id={item.id} className="scroll-mt-24 px-4 py-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug truncate">{item.title}</p>
                  {item.citation && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.citation}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <ConfidenceBadge confidence={item.confidence} />
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Open source"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {item.jurisdiction && (
                  <span className="rounded px-1.5 py-0.5 text-xs bg-secondary text-secondary-foreground">
                    {item.jurisdiction}
                  </span>
                )}
                {item.treatmentStatus && (
                  <TreatmentBadge status={item.treatmentStatus} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
