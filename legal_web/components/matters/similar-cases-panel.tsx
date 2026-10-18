"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Scale,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Bot,
} from "lucide-react"
import {
  type MatterAnalysisRun,
  listSimilarCases,
  runSimilarCases,
  deleteSimilarCasesRun,
} from "@/lib/api/matter-analysis"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useToast } from "@/hooks/use-toast"
import { SimilarCasesPanel as ResearchSimilarCasesPanel } from "@/components/research/similar-cases-panel"
import type { SimilarCase } from "@/lib/api/types"

interface SimilarCasesPanelProps {
  matterId: string
  initialRuns?: MatterAnalysisRun[]
}

function structuredSimilarCases(run: MatterAnalysisRun): SimilarCase[] | null {
  if (!run.structuredOutput || typeof run.structuredOutput !== "object") return null
  const value = (run.structuredOutput as { similarCases?: unknown }).similarCases
  return Array.isArray(value) ? value as SimilarCase[] : null
}

function RunCard({
  run,
  onDelete,
}: {
  run: MatterAnalysisRun
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <div className="flex items-start justify-between gap-3 px-4 py-3 bg-muted/30">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-sm font-semibold truncate">{run.title ?? "Similar Cases"}</h3>
            {run.trigger === "auto" && (
              <span className="text-[10px] font-medium bg-primary/10 text-primary rounded-full px-2 py-0.5 shrink-0 flex items-center gap-1">
                <Bot className="h-2.5 w-2.5" />
                Auto
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(run.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(run.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {expanded && structuredSimilarCases(run) && (
        <div className="px-4 py-4">
          <ResearchSimilarCasesPanel similarCases={structuredSimilarCases(run) ?? []} defaultOpen />
        </div>
      )}
      {expanded && !structuredSimilarCases(run) && run.contentMarkdown && (
        <div className="px-4 py-4">
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(run.contentMarkdown) }}
          />
        </div>
      )}
    </div>
  )
}

/** Minimal markdown → HTML converter for display purposes */
function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^\| (.+) \|$/gm, (line) => {
      const cells = line.split("|").filter(Boolean)
      return `<tr>${cells.map((c) => `<td class="border px-2 py-1">${c.trim()}</td>`).join("")}</tr>`
    })
    .replace(/(<tr>.*<\/tr>\n?)+/gs, (table) => `<table class="w-full text-xs border-collapse mb-3">${table}</table>`)
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/gs, (list) => `<ul class="list-disc list-inside space-y-1 mb-3">${list}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hHuUtT])/gm, "")
}

export function SimilarCasesPanel({ matterId, initialRuns = [] }: SimilarCasesPanelProps) {
  const { activeTenantId } = useTenant()
  const { toast } = useToast()
  const [runs, setRuns] = useState<MatterAnalysisRun[]>(initialRuns)
  const [loading, setLoading] = useState(false)
  const [focusPrompt, setFocusPrompt] = useState("")
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleRun = async () => {
    setLoading(true)
    try {
      const run = await runSimilarCases(activeTenantId!, matterId, focusPrompt ? { focusPrompt } : undefined)
      setRuns((prev) => [run, ...prev])
      setFocusPrompt("")
      toast({ title: "Similar cases analysis complete", description: "New analysis added above." })
    } catch {
      toast({ title: "Analysis failed", description: "Could not run similar cases. Try again.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (runId: string) => {
    setDeleting(runId)
    try {
      await deleteSimilarCasesRun(activeTenantId!, matterId, runId)
      setRuns((prev) => prev.filter((r) => r.id !== runId))
    } catch {
      toast({ title: "Delete failed", variant: "destructive" })
    } finally {
      setDeleting(null)
    }
  }

  const loadHistory = async () => {
    try {
      const data = await listSimilarCases(activeTenantId!, matterId)
      setRuns(data)
    } catch {
      // silent
    }
  }

  // Load on first render if no initial data
  useState(() => {
    if (initialRuns.length === 0) {
      void loadHistory()
    }
  })

  return (
    <div className="space-y-4">
      {/* Run panel */}
      <div className="border border-border rounded-xl p-4 bg-card space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              Similar Cases
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI-powered case law research scoped to this matter&apos;s facts and jurisdiction.
            </p>
          </div>
          <Button onClick={handleRun} disabled={loading} size="sm" className="shrink-0">
            {loading ? (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            {loading ? "Analyzing…" : "Run Analysis"}
          </Button>
        </div>
        <input
          value={focusPrompt}
          onChange={(e) => setFocusPrompt(e.target.value)}
          placeholder="Optional: focus on specific sections, issues, or arguments…"
          className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/50 placeholder:text-muted-foreground/60"
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" />
          Analysis uses matter facts, issues, and jurisdiction context.
        </div>
      </div>

      {/* History */}
      {runs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          No similar cases analyses yet. Run one above.
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <div key={run.id} className={cn(deleting === run.id && "opacity-50 pointer-events-none")}>
              <RunCard run={run} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
