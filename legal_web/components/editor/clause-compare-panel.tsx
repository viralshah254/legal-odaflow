"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { apiFetch } from "@/lib/api/client"
import {
  BookOpen,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Scale,
  Database,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

interface FirmPrecedentHit {
  id: string
  sourceType: string
  content: string
  score: number
  title?: string
  matterId?: string | null
}

interface ClauseCompareResult {
  firmPrecedents: FirmPrecedentHit[]
  clauseKind: string | null
  marketPosition: string
  redFlags: string[]
}

interface ClauseComparePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clauseText: string
  clauseKind?: string
  practiceArea?: string
  jurisdiction?: string
  tenantId?: string
}

/**
 * Slide-over panel that compares a draft clause against firm precedents and
 * surfaces market-position analysis and red flags.
 */
export function ClauseComparePanel({
  open,
  onOpenChange,
  clauseText,
  clauseKind,
  practiceArea,
  jurisdiction,
  tenantId,
}: ClauseComparePanelProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ClauseCompareResult | null>(null)

  const runCompare = async () => {
    if (!clauseText.trim() || loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await apiFetch<ClauseCompareResult>("/firm-memory/clause-compare", {
        method: "POST",
        tenantId,
        body: { clauseText, clauseKind, practiceArea, jurisdiction },
      })
      setResult(res)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Scale className="h-4 w-4 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-base">Clause compare</SheetTitle>
              <SheetDescription className="text-xs">
                Compare this clause against firm precedents and market standards.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Selected clause preview */}
        <div className="rounded-lg border bg-muted/30 p-3 mb-4 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Draft clause
          </p>
          <p className="text-xs leading-relaxed line-clamp-6">{clauseText}</p>
          {clauseKind && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-1">
              {clauseKind}
            </Badge>
          )}
        </div>

        {!result && (
          <Button
            className="w-full gap-2 mb-4"
            onClick={() => void runCompare()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BookOpen className="h-4 w-4" />
            )}
            {loading ? "Comparing…" : "Compare to firm precedents"}
          </Button>
        )}

        {result && (
          <div className="space-y-4">
            {/* Market position */}
            <div className="rounded-lg border p-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Market position</p>
              </div>
              <p className="text-sm text-muted-foreground">{result.marketPosition}</p>
            </div>

            {/* Red flags */}
            {result.redFlags.length > 0 && (
              <div className="rounded-lg border border-amber-200/60 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Red flags</p>
                </div>
                <ul className="space-y-1">
                  {result.redFlags.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                      <X className="h-3 w-3 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Firm precedents */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Database className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Firm precedents</p>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {result.firmPrecedents.length}
                </Badge>
              </div>
              {result.firmPrecedents.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No matching precedents in firm memory. Upload approved work product to build your library.
                </p>
              ) : (
                result.firmPrecedents.map((hit) => (
                  <div key={hit.id} className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{hit.title ?? hit.sourceType}</p>
                        <p className="text-xs text-muted-foreground line-clamp-3 mt-0.5">{hit.content}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                        {(hit.score * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    {hit.matterId && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        Matter: {hit.matterId.slice(0, 8)}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => void runCompare()}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Re-run compare
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
