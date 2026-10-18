"use client"

import { cn } from "@/lib/utils"
import {
  Scale,
  BookOpen,
  Gavel,
  Database,
  Globe,
  TrendingUp,
  FileText,
  Building2,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export type KnowledgeSource =
  | "statutes"
  | "case_law"
  | "regulations"
  | "firm_vault"
  | "web"
  | "edgar"
  | "tax"
  | "contracts"

export interface KnowledgeSourceDef {
  id: KnowledgeSource
  label: string
  icon: React.ElementType
  tooltip: string
  /** ISO-3166 codes that have meaningful content for this source. Omit = all jurisdictions. */
  countries?: string[]
  /** Hidden until a backend retrieval connector exists. */
  implemented?: boolean
}

export const ALL_KNOWLEDGE_SOURCES: KnowledgeSourceDef[] = [
  {
    id: "statutes",
    label: "Statutes",
    icon: Scale,
    tooltip: "Primary legislation, acts & codes",
  },
  {
    id: "case_law",
    label: "Case law",
    icon: Gavel,
    tooltip: "Published court judgments and precedents",
  },
  {
    id: "regulations",
    label: "Regulations",
    icon: FileText,
    tooltip: "Delegated legislation, rules, and regulatory guidance",
  },
  {
    id: "firm_vault",
    label: "Firm vault",
    icon: Database,
    tooltip: "Your firm's uploaded matters, documents, and precedents",
  },
  {
    id: "web",
    label: "Web",
    icon: Globe,
    tooltip: "Live web search for recent news and commentary",
  },
  {
    id: "edgar",
    label: "EDGAR",
    icon: TrendingUp,
    tooltip: "SEC filings: 10-K, 8-K, S-1, proxy statements",
    countries: ["US"],
    implemented: false,
  },
  {
    id: "tax",
    label: "Tax law",
    icon: Building2,
    tooltip: "Tax statutes, rulings, and OECD guidance",
    implemented: false,
  },
  {
    id: "contracts",
    label: "Precedents",
    icon: BookOpen,
    tooltip: "Market standard contracts and clause benchmarks",
    implemented: false,
  },
]

interface KnowledgeSourcePickerProps {
  selected: KnowledgeSource[]
  onChange: (sources: KnowledgeSource[]) => void
  countryCode?: string
  className?: string
  /** Render as compact icon-only row (no labels) */
  compact?: boolean
  auto?: boolean
  onAutoChange?: (auto: boolean) => void
  recommended?: KnowledgeSource[]
}

/** Harvey-style "Choose knowledge source" chip row for research and copilot. */
export function KnowledgeSourcePicker({
  selected,
  onChange,
  countryCode,
  className,
  compact = false,
  auto = false,
  onAutoChange,
  recommended = DEFAULT_KNOWLEDGE_SOURCES,
}: KnowledgeSourcePickerProps) {
  const visibleSources = ALL_KNOWLEDGE_SOURCES.filter(
    (s) =>
      s.implemented !== false &&
      (!s.countries || !countryCode || s.countries.includes(countryCode.toUpperCase())),
  )

  function toggle(id: KnowledgeSource) {
    if (selected.includes(id)) {
      // Keep at least one source selected
      if (selected.length === 1) return
      onChange(selected.filter((s) => s !== id))
    } else {
      onChange([...selected, id])
    }
  }

  if (compact) {
    return (
      <TooltipProvider>
        <div className={cn("flex items-center gap-1 flex-wrap", className)}>
          {visibleSources.map((src) => {
            const Icon = src.icon
            const active = selected.includes(src.id)
            return (
              <Tooltip key={src.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => toggle(src.id)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-all",
                      active
                        ? "border-primary/60 bg-primary/10 text-primary shadow-sm"
                        : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted hover:border-border",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="font-medium">{src.label}</p>
                  <p className="text-xs text-muted-foreground">{src.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <div className={cn("space-y-2", className)}>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Knowledge sources
        </p>
        {onAutoChange && (
          <button
            type="button"
            onClick={() => onAutoChange(!auto)}
            aria-pressed={auto}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
              auto
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/60 bg-muted/30 text-muted-foreground",
            )}
          >
            Auto · {recommended.map(sourceLabel).join(", ")}
          </button>
        )}
        <div className="flex flex-wrap gap-1.5">
          {visibleSources.map((src) => {
            const Icon = src.icon
            const active = selected.includes(src.id)
            return (
              <Tooltip key={src.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => toggle(src.id)}
                    disabled={auto}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                      (auto ? recommended.includes(src.id) : active)
                        ? "border-primary/50 bg-primary/10 text-primary shadow-sm"
                        : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border",
                    )}
                  >
                    <Icon className="h-3 w-3 shrink-0" />
                    {src.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs text-muted-foreground">{src.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}

/** Resolve API-ready source filter string from selected sources. */
export function resolveKnowledgeSources(
  selected: KnowledgeSource[],
): string[] {
  return selected
}

/** Default sources (always start with primary legal corpus). */
export const DEFAULT_KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  "statutes",
  "case_law",
  "regulations",
]

export function sourceLabel(source: KnowledgeSource): string {
  return ALL_KNOWLEDGE_SOURCES.find((candidate) => candidate.id === source)?.label ?? source
}

export function recommendedKnowledgeSources(
  taskKind: string,
  query: string,
): KnowledgeSource[] {
  if (taskKind === "SECTION_LOOKUP") return ["statutes"]
  const sources: KnowledgeSource[] = ["statutes", "case_law", "web"]
  if (/\b(?:regulation|regulations|rules|regulator|notification|circular|tax|gst)\b/i.test(query)) {
    sources.push("regulations")
  }
  return [...new Set(sources)]
}

const KNOWLEDGE_SOURCE_IDS = new Set<KnowledgeSource>(
  ALL_KNOWLEDGE_SOURCES.map((s) => s.id),
)

export function parseKnowledgeSourcesParam(param: string | null | undefined): KnowledgeSource[] {
  if (!param?.trim()) return DEFAULT_KNOWLEDGE_SOURCES
  const parsed = param
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is KnowledgeSource => KNOWLEDGE_SOURCE_IDS.has(s as KnowledgeSource))
  return parsed.length > 0 ? parsed : DEFAULT_KNOWLEDGE_SOURCES
}

export function serializeKnowledgeSourcesParam(sources: KnowledgeSource[]): string {
  return sources.join(",")
}
