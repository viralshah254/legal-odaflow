"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  SearchCode,
  FileText,
  Shield,
  Scale,
  TrendingUp,
  Eye,
  Zap,
  Clock,
  ChevronRight,
  Sparkles,
  BookOpen,
  Gavel,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export interface WorkflowDefinition {
  id: string
  label: string
  description: string
  icon: React.ElementType
  practiceAreas?: string[]
  agentId?: string
  href?: string
  action?: "research" | "draft" | "review" | "analyze" | "diligence"
  estimatedTime?: string
  badge?: string
}

export const VERTICAL_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "clause-extract",
    label: "Clause extraction",
    description: "Extract and categorize key clauses from uploaded documents.",
    icon: FileText,
    action: "review",
    agentId: "diligence-agent",
    estimatedTime: "2–4 min",
    badge: "Popular",
  },
  {
    id: "rep-warranty-summary",
    label: "Rep & warranty summary",
    description: "Summarize representations, warranties, and carve-outs for M&A review.",
    icon: Shield,
    action: "review",
    agentId: "diligence-agent",
    practiceAreas: ["Corporate", "M&A"],
    estimatedTime: "3–5 min",
  },
  {
    id: "regulatory-memo",
    label: "Regulatory memo",
    description: "Generate a compliance memo on applicable regulations for this matter.",
    icon: Scale,
    action: "draft",
    agentId: "research-agent",
    estimatedTime: "5–8 min",
  },
  {
    id: "compare-playbook",
    label: "Compare to firm playbook",
    description: "Check document clauses against your firm's standard positions.",
    icon: BookOpen,
    action: "review",
    agentId: "diligence-agent",
    estimatedTime: "2–3 min",
    badge: "New",
  },
  {
    id: "diligence-red-flags",
    label: "Diligence red flags",
    description: "Surface risk flags, missing exhibits, and unusual provisions.",
    icon: Eye,
    action: "diligence",
    agentId: "diligence-agent",
    estimatedTime: "4–6 min",
    badge: "Popular",
  },
  {
    id: "citation-audit",
    label: "Citation audit",
    description: "Verify every case citation for good law status and binding weight.",
    icon: Gavel,
    action: "analyze",
    agentId: "research-agent",
    estimatedTime: "2–3 min",
  },
  {
    id: "outcome-preview",
    label: "Outcome preview",
    description: "AI-generated probabilistic outcome analysis for this matter.",
    icon: TrendingUp,
    action: "analyze",
    agentId: "outcome-analyzer",
    estimatedTime: "3–5 min",
    badge: "Beta",
  },
]

interface WorkflowSuggestionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  matterId?: string
  /** Context hint — shown as the trigger ("Upload" or "Matter opened"). */
  trigger?: "upload" | "matter-open" | "manual"
  /** Filter by practice area. */
  practiceArea?: string
  onWorkflowSelect?: (workflow: WorkflowDefinition) => void
  tenantId?: string
}

function WorkflowCard({
  workflow,
  matterId,
  onSelect,
}: {
  workflow: WorkflowDefinition
  matterId?: string
  onSelect?: () => void
}) {
  const Icon = workflow.icon

  const href = workflow.href ?? buildWorkflowHref(workflow, matterId)

  return (
    <div className="rounded-xl border p-4 hover:shadow-md hover:border-primary/30 transition-all bg-card group">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{workflow.label}</p>
            {workflow.badge && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary">
                {workflow.badge}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {workflow.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {workflow.estimatedTime && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {workflow.estimatedTime}
              </span>
            )}
            {workflow.practiceAreas?.map((pa) => (
              <Badge key={pa} variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                {pa}
              </Badge>
            ))}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 text-xs h-8 gap-1.5 group-hover:border-primary/40 group-hover:text-primary transition-colors"
          asChild={!!href}
          onClick={!href ? onSelect : undefined}
        >
          {href ? (
            <Link href={href}>
              Run
              <ChevronRight className="h-3 w-3" />
            </Link>
          ) : (
            <span>
              Run
              <ChevronRight className="h-3 w-3" />
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}

function buildWorkflowHref(workflow: WorkflowDefinition, matterId?: string): string {
  const base = matterId ? `/app/matters/${matterId}` : "/app"
  switch (workflow.action) {
    case "research":
      return `/app/research${matterId ? `?matterId=${matterId}` : ""}`
    case "draft":
      return matterId ? `${base}/drafting` : "/app/documents"
    case "review":
    case "diligence":
      return matterId ? `/app/vault?matterId=${matterId}` : "/app/vault"
    case "analyze":
      return matterId ? `${base}` : "/app/copilot"
    default:
      return "/app/copilot"
  }
}

/**
 * Harvey-style "Run a workflow" collapse sheet.
 * Surfaces 5–7 vertical workflows with last-used + suggested ordering.
 * Triggered on document upload or matter open.
 */
export function WorkflowSuggestionSheet({
  open,
  onOpenChange,
  matterId,
  trigger = "manual",
  practiceArea,
  onWorkflowSelect,
}: WorkflowSuggestionSheetProps) {
  const [search, setSearch] = useState("")

  const triggerLabel =
    trigger === "upload"
      ? "Document uploaded — run a workflow"
      : trigger === "matter-open"
        ? "Matter opened — run a workflow"
        : "Choose a workflow"

  const filtered = VERTICAL_WORKFLOWS.filter((w) => {
    if (search && !w.label.toLowerCase().includes(search.toLowerCase())) return false
    if (practiceArea && w.practiceAreas?.length && !w.practiceAreas.includes(practiceArea)) return false
    return true
  })

  const popular = filtered.filter((w) => w.badge === "Popular")
  const rest = filtered.filter((w) => w.badge !== "Popular")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-base">{triggerLabel}</SheetTitle>
              <SheetDescription className="text-xs">
                AI workflows that run on your matter or document.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Search */}
        <div className="relative mb-4">
          <SearchCode className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter workflows…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-muted/30 py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        {/* Popular workflows */}
        {popular.length > 0 && !search && (
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Popular
              </p>
            </div>
            <div className="space-y-2">
              {popular.map((w) => (
                <WorkflowCard
                  key={w.id}
                  workflow={w}
                  matterId={matterId}
                  onSelect={() => {
                    onWorkflowSelect?.(w)
                    onOpenChange(false)
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* All workflows */}
        {rest.length > 0 && (
          <div className="space-y-2">
            {!search && popular.length > 0 && (
              <>
                <Separator />
                <div className="flex items-center gap-2 pt-2">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    All workflows
                  </p>
                </div>
              </>
            )}
            <div className="space-y-2">
              {(search ? filtered : rest).map((w) => (
                <WorkflowCard
                  key={w.id}
                  workflow={w}
                  matterId={matterId}
                  onSelect={() => {
                    onWorkflowSelect?.(w)
                    onOpenChange(false)
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <SearchCode className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No workflows match "{search}"</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
