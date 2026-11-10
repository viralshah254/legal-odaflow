"use client"

import { useCallback, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  PenLine,
  Shield,
  Sparkles,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { WorkspaceShell } from "@/components/shared/workspace-shell"
import { AutosaveIndicator } from "@/components/shared/autosave-indicator"
import { ProvenancePanel } from "@/components/shared/provenance-panel"
import { useAutosave } from "@/lib/hooks/use-autosave"
import { useWorkflowPoll } from "@/lib/hooks/use-workflow-poll"
import { apiFetch } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { SectionFeedbackWidget } from "@/components/drafting/SectionFeedbackWidget"

interface DraftSection {
  id: string
  sectionType: string
  title: string
  content: string | null
  status: "pending" | "generating" | "generated" | "failed_verification" | "repaired" | "edited" | "approved"
  version: number
  orderIndex: number
  modelUsed?: string | null
  sources?: Array<{
    id: string
    title: string
    citation?: string
    sourceUrl?: string
    jurisdiction?: string
    confidence: number
    treatmentStatus?: string
  }>
}

interface DraftWorkspace {
  id: string
  title: string
  status: string
  workflowRunId?: string
  costUsd?: number
  jurisdiction?: string
  documentType?: string
  sections: DraftSection[]
}

interface IndiaDraftingWorkspaceProps {
  matterId: string
  tenantId: string
  workspaceId: string
}

const sectionStatusConfig: Record<
  DraftSection["status"],
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-secondary text-secondary-foreground" },
  generating: { label: "Generating…", className: "bg-primary/10 text-primary" },
  generated: { label: "Generated", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  failed_verification: { label: "Needs Repair", className: "bg-destructive/10 text-destructive" },
  repaired: { label: "Repaired", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  edited: { label: "Edited", className: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
  approved: { label: "Approved", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
}

function SectionStatusBadge({ status }: { status: DraftSection["status"] }) {
  const cfg = sectionStatusConfig[status] ?? sectionStatusConfig.pending
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", cfg.className)}>
      {status === "generating" && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
      {status === "approved" && <CheckCircle2 className="h-3 w-3 mr-1" />}
      {status === "failed_verification" && <XCircle className="h-3 w-3 mr-1" />}
      {cfg.label}
    </span>
  )
}

function SectionEditor({
  section,
  onSave,
  onApprove,
  onGenerate,
  documentKind,
  jurisdiction,
}: {
  section: DraftSection
  onSave: (id: string, content: string) => Promise<void>
  onApprove: (id: string) => Promise<void>
  onGenerate: (id: string) => Promise<void>
  documentKind?: string
  jurisdiction?: string
}) {
  const [content, setContent] = useState(section.content ?? "")
  const [expanded, setExpanded] = useState(true)

  const saveSection = useCallback(
    async (value: string) => onSave(section.id, value),
    [section.id, onSave],
  )

  const { status: saveStatus, lastSavedAt, save } = useAutosave(content, saveSection, {
    debounceMs: 1500,
    enabled: section.status !== "approved",
  })

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b">
        <button
          type="button"
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="text-sm font-medium truncate">{section.title}</span>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <SectionStatusBadge status={section.status} />
          {section.version > 1 && (
            <span className="text-xs text-muted-foreground">v{section.version}</span>
          )}
          {section.status !== "approved" && (
            <AutosaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-3">
          {!section.content && section.status === "pending" ? (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-muted-foreground">No content yet for this section.</p>
              <Button size="sm" onClick={() => onGenerate(section.id)}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Generate
              </Button>
            </div>
          ) : section.status === "generating" ? (
            <div className="py-6 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Generating section…</span>
            </div>
          ) : (
            <>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[200px] font-mono text-sm resize-y"
                disabled={section.status === "approved"}
                placeholder="Section content…"
              />

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {section.status !== "approved" && (
                    <Button size="sm" variant="outline" onClick={() => void save()}>
                      <PenLine className="h-3.5 w-3.5 mr-1.5" />
                      Save
                    </Button>
                  )}
                  {(section.status === "generated" || section.status === "repaired" || section.status === "edited") && (
                    <Button size="sm" onClick={() => void onApprove(section.id)}>
                      <Shield className="h-3.5 w-3.5 mr-1.5" />
                      Approve
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {section.content && (
                    <SectionFeedbackWidget
                      sectionType={section.sectionType}
                      documentKind={documentKind ?? ""}
                      aiText={section.content}
                      jurisdiction={jurisdiction}
                      draftSectionV3Id={section.id}
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {section.sources && section.sources.length > 0 && (
            <div className="pt-2">
              <ProvenancePanel items={section.sources} title="Section Sources" collapsible />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function IndiaDraftingWorkspace({
  matterId,
  tenantId,
  workspaceId,
}: IndiaDraftingWorkspaceProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [rightPanel, setRightPanel] = useState<"provenance" | "sections">("sections")

  // Fetch workspace + sections
  const { data: workspace, isLoading } = useQuery({
    queryKey: ["platform-draft-workspace", workspaceId, tenantId],
    queryFn: () =>
      apiFetch<DraftWorkspace>(
        `/platform/drafting/workspaces/${workspaceId}?tenantId=${tenantId}`,
      ),
    refetchInterval: (query) => {
      const data = query.state.data as DraftWorkspace | undefined
      const hasGenerating = data?.sections.some((s) => s.status === "generating")
      return hasGenerating ? 4000 : false
    },
  })

  // Poll workflow run for generation progress
  const { workflow, isPolling } = useWorkflowPoll(workspace?.workflowRunId, {
    pollIntervalMs: 3000,
    onComplete: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform-draft-workspace", workspaceId] })
    },
  })

  const wf = workflow as
    | { status?: string; stages?: Array<{ id: string; name: string; status: string }> }
    | null
    | undefined

  const stages = useMemo(
    () =>
      (wf?.stages ?? []).map((s) => ({
        id: s.id,
        label: s.name,
        status: s.status as "pending" | "running" | "completed" | "failed" | "skipped",
      })),
    [wf],
  )

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: ({ sectionId }: { sectionId: string }) =>
      apiFetch(`/platform/drafting/sections/${sectionId}/approve`, {
        method: "POST",
        body: JSON.stringify({ tenantId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform-draft-workspace", workspaceId] })
      toast({ title: "Section approved and locked." })
    },
  })

  // Save section content mutation
  const saveSectionMutation = useMutation({
    mutationFn: ({ sectionId, content }: { sectionId: string; content: string }) =>
      apiFetch(`/platform/drafting/sections/${sectionId}`, {
        method: "PATCH",
        body: JSON.stringify({ content, tenantId }),
      }),
  })

  // Generate section mutation
  const generateSectionMutation = useMutation({
    mutationFn: ({ sectionId }: { sectionId: string }) =>
      apiFetch(`/platform/drafting/sections/${sectionId}/generate`, {
        method: "POST",
        body: JSON.stringify({ tenantId }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform-draft-workspace", workspaceId] })
    },
  })

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ downloadUrl: string }>(
        `/platform/drafting/workspaces/${workspaceId}/export?tenantId=${tenantId}`,
        { method: "POST", body: JSON.stringify({ format: "docx" }) },
      ),
    onSuccess: (data) => {
      window.open(data.downloadUrl, "_blank")
    },
    onError: () => {
      toast({ title: "Export failed. Please try again.", variant: "destructive" })
    },
  })

  const handleSaveSection = useCallback(
    async (sectionId: string, content: string) => {
      await saveSectionMutation.mutateAsync({ sectionId, content })
    },
    [saveSectionMutation],
  )

  const handleApproveSection = useCallback(
    async (sectionId: string) => {
      await approveMutation.mutateAsync({ sectionId })
    },
    [approveMutation],
  )

  const handleGenerateSection = useCallback(
    async (sectionId: string) => {
      await generateSectionMutation.mutateAsync({ sectionId })
    },
    [generateSectionMutation],
  )

  const approvedCount = workspace?.sections.filter((s) => s.status === "approved").length ?? 0
  const totalSections = workspace?.sections.length ?? 0
  const progress = totalSections > 0 ? Math.round((approvedCount / totalSections) * 100) : 0

  const allSources = useMemo(
    () =>
      workspace?.sections.flatMap((s) => s.sources ?? []).slice(0, 30) ?? [],
    [workspace],
  )

  const provenanceItems = useMemo(
    () =>
      allSources.map((src) => ({
        id: src.id,
        title: src.title,
        citation: src.citation,
        sourceUrl: src.sourceUrl,
        jurisdiction: src.jurisdiction,
        confidence: src.confidence,
        treatmentStatus: src.treatmentStatus,
      })),
    [allSources],
  )

  const sortedSections = useMemo(
    () => [...(workspace?.sections ?? [])].sort((a, b) => a.orderIndex - b.orderIndex),
    [workspace],
  )

  const sidebarContent = (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-3">
        <button
          type="button"
          className={cn(
            "flex-1 text-xs py-1.5 px-2 rounded font-medium transition-colors",
            rightPanel === "sections"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
          onClick={() => setRightPanel("sections")}
        >
          Sections
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 text-xs py-1.5 px-2 rounded font-medium transition-colors",
            rightPanel === "provenance"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
          onClick={() => setRightPanel("provenance")}
        >
          Sources
        </button>
      </div>

      {rightPanel === "sections" && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Outline
          </p>
          {sortedSections.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-muted/50 text-sm"
            >
              <span className="truncate text-xs">{s.title}</span>
              <SectionStatusBadge status={s.status} />
            </div>
          ))}
          {sortedSections.length === 0 && (
            <p className="text-xs text-muted-foreground">No sections yet.</p>
          )}
        </div>
      )}

      {rightPanel === "provenance" && (
        <ProvenancePanel items={provenanceItems} title="All Sources" collapsible={false} />
      )}
    </div>
  )

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <WorkspaceShell
      title={workspace?.title ?? "Drafting Workspace"}
      workflowStatus={isPolling ? "running" : workspace?.status}
      stages={stages.length > 0 ? stages : undefined}
      progress={progress}
      costUsd={workspace?.costUsd}
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending || approvedCount === 0}
        >
          {exportMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          ) : (
            <Download className="h-3.5 w-3.5 mr-1.5" />
          )}
          Export
        </Button>
      }
      sidebar={sidebarContent}
    >
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {approvedCount} / {totalSections} sections approved
          </span>
          <Badge variant="outline" className="text-xs">
            {workspace?.jurisdiction ?? "General"}
          </Badge>
        </div>

        {sortedSections.map((section) => (
          <SectionEditor
            key={section.id}
            section={section}
            onSave={handleSaveSection}
            onApprove={handleApproveSection}
            onGenerate={handleGenerateSection}
            documentKind={workspace?.documentType}
            jurisdiction={workspace?.jurisdiction}
          />
        ))}

        {sortedSections.length === 0 && (
          <div className="py-16 flex flex-col items-center gap-3 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 opacity-30" />
            <p className="text-sm">No sections generated yet.</p>
          </div>
        )}
      </div>
    </WorkspaceShell>
  )
}

// Page-level wrapper that fetches the workspace ID from the matter
export function IndiaDraftingWorkspacePage({
  matterId,
  tenantId,
}: {
  matterId: string
  tenantId: string
}) {
  const { data: workspaceRef, isLoading } = useQuery({
    queryKey: ["platform-draft-workspace-ref", matterId, tenantId],
    queryFn: () =>
      apiFetch<{ workspaceId: string } | null>(
        `/platform/drafting/workspaces/by-matter/${matterId}?tenantId=${tenantId}`,
      ),
  })

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!workspaceRef?.workspaceId) {
    return (
      <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted-foreground">
        No drafting workspace found for this matter.
      </div>
    )
  }

  return (
    <IndiaDraftingWorkspace
      matterId={matterId}
      tenantId={tenantId}
      workspaceId={workspaceRef.workspaceId}
    />
  )
}
