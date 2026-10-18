"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  Search,
} from "lucide-react"

export type ChangeType = "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED"
export type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | "NONE"

export interface TabularReviewRow {
  clauseName: string
  docAText: string | null
  docBText: string | null
  changeType: ChangeType
  riskLevel: RiskLevel
  riskDetail: string | null
  recommendation: string | null
}

export interface TabularReviewResult {
  rows: TabularReviewRow[]
  summary: string
  totalClauses: number
  changedClauses: number
  highRiskClauses: number
  creditsUsed: number
  modelName: string
}

const CHANGE_CONFIG: Record<ChangeType, { label: string; color: string; icon: React.FC<{ className?: string }> }> = {
  ADDED: { label: "Added", color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400", icon: PlusCircle },
  REMOVED: { label: "Removed", color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400", icon: MinusCircle },
  MODIFIED: { label: "Modified", color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400", icon: RefreshCw },
  UNCHANGED: { label: "Unchanged", color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
}

const RISK_CONFIG: Record<RiskLevel, { label: string; variant: "destructive" | "outline" | "secondary" | "default" }> = {
  HIGH: { label: "High risk", variant: "destructive" },
  MEDIUM: { label: "Medium", variant: "outline" },
  LOW: { label: "Low", variant: "secondary" },
  NONE: { label: "—", variant: "secondary" },
}

function exportToCSV(rows: TabularReviewRow[], docAName: string, docBName: string) {
  const headers = ["Clause", "Change", "Risk", docAName, docBName, "Risk Detail", "Recommendation"]
  const escape = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) =>
      [
        escape(r.clauseName),
        escape(r.changeType),
        escape(r.riskLevel),
        escape(r.docAText),
        escape(r.docBText),
        escape(r.riskDetail),
        escape(r.recommendation),
      ].join(","),
    ),
  ]
  const blob = new Blob([lines.join("\n")], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "tabular-review.csv"
  a.click()
  URL.revokeObjectURL(url)
}

type FilterChange = "ALL" | ChangeType
type FilterRisk = "ALL" | RiskLevel
type SortField = "clauseName" | "changeType" | "riskLevel"

interface Props {
  result: TabularReviewResult
  docAName?: string
  docBName?: string
}

export function TabularReviewTable({ result, docAName = "Document A", docBName = "Document B" }: Props) {
  const [filterChange, setFilterChange] = useState<FilterChange>("ALL")
  const [filterRisk, setFilterRisk] = useState<FilterRisk>("ALL")
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("riskLevel")
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const RISK_ORDER: Record<RiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 }
  const CHANGE_ORDER: Record<ChangeType, number> = { MODIFIED: 0, ADDED: 1, REMOVED: 2, UNCHANGED: 3 }

  const filtered = useMemo(() => {
    return result.rows
      .filter((r) => {
        if (filterChange !== "ALL" && r.changeType !== filterChange) return false
        if (filterRisk !== "ALL" && r.riskLevel !== filterRisk) return false
        if (search && !r.clauseName.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .sort((a, b) => {
        if (sortField === "clauseName") return a.clauseName.localeCompare(b.clauseName)
        if (sortField === "changeType") return CHANGE_ORDER[a.changeType] - CHANGE_ORDER[b.changeType]
        return RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel]
      })
  }, [result.rows, filterChange, filterRisk, search, sortField])

  const toggleRow = (i: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          <span><span className="font-semibold">{result.totalClauses}</span> clauses</span>
          <span><span className="font-semibold text-amber-600 dark:text-amber-400">{result.changedClauses}</span> changed</span>
          <span><span className="font-semibold text-destructive">{result.highRiskClauses}</span> high risk</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs"
            placeholder="Search clauses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={filterChange} onValueChange={(v) => setFilterChange(v as FilterChange)}>
          <SelectTrigger className="h-8 text-xs w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All changes</SelectItem>
            <SelectItem value="MODIFIED">Modified</SelectItem>
            <SelectItem value="ADDED">Added</SelectItem>
            <SelectItem value="REMOVED">Removed</SelectItem>
            <SelectItem value="UNCHANGED">Unchanged</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterRisk} onValueChange={(v) => setFilterRisk(v as FilterRisk)}>
          <SelectTrigger className="h-8 text-xs w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All risks</SelectItem>
            <SelectItem value="HIGH">High risk</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
          <SelectTrigger className="h-8 text-xs w-32">
            <ArrowDownUp className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="riskLevel">Sort by risk</SelectItem>
            <SelectItem value="changeType">Sort by change</SelectItem>
            <SelectItem value="clauseName">Sort by name</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => exportToCSV(filtered, docAName, docBName)}
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        {/* Header row */}
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_2fr_2fr] bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
          <span>Clause</span>
          <span>Change</span>
          <span>Risk</span>
          <span>{docAName}</span>
          <span>{docBName}</span>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No clauses match the current filters.
          </div>
        )}

        {filtered.map((row, i) => {
          const { icon: ChangeIcon, color: changeColor, label: changeLabel } = CHANGE_CONFIG[row.changeType]
          const { label: riskLabel, variant: riskVariant } = RISK_CONFIG[row.riskLevel]
          const isExpanded = expandedRows.has(i)

          return (
            <div
              key={i}
              className={cn(
                "border-b last:border-0",
                row.riskLevel === "HIGH" && "border-l-2 border-l-destructive",
                row.riskLevel === "MEDIUM" && "border-l-2 border-l-amber-500",
              )}
            >
              {/* Main row */}
              <div
                className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_2fr_2fr] gap-2 md:gap-0 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleRow(i)}
              >
                {/* Clause name */}
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-sm font-medium">{row.clauseName}</span>
                </div>

                {/* Change type */}
                <div className="flex items-center gap-1">
                  <span className={cn("inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border", changeColor)}>
                    <ChangeIcon className="h-3 w-3" />
                    <span className="hidden sm:inline">{changeLabel}</span>
                  </span>
                </div>

                {/* Risk level */}
                <div className="flex items-center">
                  {row.riskLevel !== "NONE" ? (
                    <Badge variant={riskVariant} className="text-[11px] flex items-center gap-1">
                      {row.riskLevel === "HIGH" && <AlertTriangle className="h-3 w-3" />}
                      {riskLabel}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">{riskLabel}</span>
                  )}
                </div>

                {/* Doc A text */}
                <div className="text-xs text-muted-foreground line-clamp-2 pr-2">
                  {row.docAText ?? <span className="italic">—</span>}
                </div>

                {/* Doc B text */}
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {row.docBText ?? <span className="italic">—</span>}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (row.riskDetail || row.recommendation) && (
                <div className="px-6 pb-4 space-y-3 bg-muted/20">
                  <Separator />
                  {row.docAText && (
                    <div className="grid md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{docAName}</p>
                        <p className="text-xs leading-relaxed">{row.docAText}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{docBName}</p>
                        <p className="text-xs leading-relaxed">{row.docBText ?? "—"}</p>
                      </div>
                    </div>
                  )}
                  {row.riskDetail && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive mb-1">Risk detail</p>
                      <p className="text-xs leading-relaxed">{row.riskDetail}</p>
                    </div>
                  )}
                  {row.recommendation && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary mb-1">Recommendation</p>
                      <p className="text-xs leading-relaxed">{row.recommendation}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
