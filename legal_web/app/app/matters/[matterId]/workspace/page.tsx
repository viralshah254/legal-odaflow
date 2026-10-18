"use client"

import { useState, useCallback, useRef } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/ui/empty-state"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  StickyNote,
  Loader2,
  Search,
  Download,
  FileText,
  LayoutGrid,
  MoreHorizontal,
  AlertTriangle,
} from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"
import {
  getOrCreateMatterWorkspace,
  addDocumentToWorkspace,
  removeDocumentFromWorkspace,
  createAnnotation,
  createCanvasNode,
  updateCanvasNode,
  deleteCanvasNode,
  createLink,
  extractToCanvas,
  listAnnotations,
  listCanvasNodes,
  listLinks,
  type DocumentAnnotation,
  type CanvasNode,
} from "@/lib/api/smart-workspace"
import { listTenantDocuments } from "@/lib/api/documents"
import { getMatter } from "@/lib/api/matters"
import { listSavedResearch } from "@/lib/api/ai"
import { DocSidebar } from "@/components/smart-workspace/doc-sidebar"
import { FiledResearchSidebar } from "@/components/smart-workspace/filed-research-sidebar"
import { OcrBanner } from "@/components/smart-workspace/ocr-banner"
import { AiSelectionToolbar } from "@/components/smart-workspace/ai-selection-toolbar"
import { WorkspaceCanvas } from "@/components/smart-workspace/workspace-canvas"
import { CrossDocSearch } from "@/components/smart-workspace/cross-doc-search"
import { CrossPaneLinksOverlay } from "@/components/smart-workspace/cross-pane-links"
import { getApiBaseUrl } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-media-query"
import { MatterInlineCopilot } from "@/components/matters/matter-inline-copilot"
import { MatterWorkspaceShell } from "@/components/matters/matter-workspace-shell"
import { queryKeys } from "@/lib/api/query-keys"
import type { ApiMatter } from "@/lib/api/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import "@/components/smart-workspace/workspace.css"

const PdfViewer = dynamic(
  () => import("@/components/smart-workspace/pdf-viewer").then((m) => ({ default: m.PdfViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  },
)

interface TextSelection {
  quote: string
  startOffset: number
  endOffset: number
  page: number
  rect: DOMRect
}

export default function SmartWorkspacePage() {
  const params = useParams()
  const matterId = params.matterId as string
  const { activeTenantId } = useTenant()

  const { data: matter, isLoading, isError, refetch } = useApiData(
    queryKeys.matters.detail(activeTenantId, matterId),
    {
      apiFn: () => getMatter(activeTenantId!, matterId),
      enabled: !!activeTenantId && !!matterId,
    },
  )

  if (isLoading || !activeTenantId) {
    return <PageSkeleton />
  }

  if (isError || !matter) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Could not load this matter"
        description="The research canvas is temporarily unavailable."
        actionLabel="Retry"
        onAction={() => void refetch()}
      />
    )
  }

  return (
    <MatterWorkspaceShell
      matter={matter}
      tenantId={activeTenantId}
      showIntelligenceSidebar={false}
    >
      <SmartWorkspaceContent
        matterId={matterId}
        tenantId={activeTenantId}
        matter={matter}
      />
    </MatterWorkspaceShell>
  )
}

function SmartWorkspaceContent({
  matterId,
  tenantId,
  matter,
}: {
  matterId: string
  tenantId: string
  matter: ApiMatter
}) {
  const t = useTranslations("matters")
  const qc = useQueryClient()

  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)
  const [selection, setSelection] = useState<TextSelection | null>(null)
  const [pdfFullscreen, setPdfFullscreen] = useState(false)
  const [canvasFullscreen, setCanvasFullscreen] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const isMobile = useIsMobile()
  const [mobileTab, setMobileTab] = useState<"docs" | "pdf" | "canvas">("pdf")
  const workspaceContainerRef = useRef<HTMLDivElement>(null)

  const { data: workspace, isLoading: wsLoading, isError: wsError, error: wsErrorObj, refetch: refetchWorkspace } = useQuery({
    queryKey: ["smart-workspace", matterId, tenantId],
    queryFn: () => getOrCreateMatterWorkspace(tenantId, matterId),
    enabled: !!matterId && !!tenantId,
  })

  const workspaceId = workspace?.id
  const workspaceDocs = workspace?.workspaceDocs ?? []

  const { data: annotations = [] } = useQuery({
    queryKey: ["workspace-annotations", workspaceId, tenantId],
    queryFn: () => listAnnotations(tenantId, workspaceId!),
    enabled: !!workspaceId && !!tenantId,
  })

  const { data: canvasNodes = [] } = useQuery({
    queryKey: ["workspace-canvas-nodes", workspaceId, tenantId],
    queryFn: () => listCanvasNodes(tenantId, workspaceId!),
    enabled: !!workspaceId && !!tenantId,
  })

  const { data: links = [] } = useQuery({
    queryKey: ["workspace-links", workspaceId, tenantId],
    queryFn: () => listLinks(tenantId, workspaceId!),
    enabled: !!workspaceId && !!tenantId,
  })

  const { data: matterDocs = [] } = useQuery({
    queryKey: queryKeys.matters.documents(tenantId, matterId),
    queryFn: () => listTenantDocuments(tenantId, { matterId }),
    enabled: !!matterId && !!tenantId,
  })

  const { data: filedResearch = [], isLoading: filedResearchLoading } = useQuery({
    queryKey: queryKeys.research.saved(tenantId, { matterId }),
    queryFn: () => listSavedResearch(tenantId, { matterId }),
    enabled: !!tenantId && !!matterId,
  })

  const addDoc = useMutation({
    mutationFn: (documentId: string) => addDocumentToWorkspace(tenantId, workspaceId!, documentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["smart-workspace", matterId, tenantId] }),
  })

  const removeDoc = useMutation({
    mutationFn: (documentId: string) => removeDocumentFromWorkspace(tenantId, workspaceId!, documentId),
    onSuccess: (_, documentId) => {
      if (activeDocumentId === documentId) setActiveDocumentId(null)
      qc.invalidateQueries({ queryKey: ["smart-workspace", matterId, tenantId] })
    },
  })

  const createAnn = useMutation({
    mutationFn: (payload: Parameters<typeof createAnnotation>[2]) =>
      createAnnotation(tenantId, workspaceId!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-annotations", workspaceId, tenantId] }),
  })

  const createNode = useMutation({
    mutationFn: (payload: Parameters<typeof createCanvasNode>[2]) =>
      createCanvasNode(tenantId, workspaceId!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-canvas-nodes", workspaceId, tenantId] }),
  })

  const updateNode = useMutation({
    mutationFn: ({ nodeId, patch }: { nodeId: string; patch: Parameters<typeof updateCanvasNode>[3] }) =>
      updateCanvasNode(tenantId, workspaceId!, nodeId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-canvas-nodes", workspaceId, tenantId] }),
  })

  const deleteNode = useMutation({
    mutationFn: (nodeId: string) => deleteCanvasNode(tenantId, workspaceId!, nodeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-canvas-nodes", workspaceId, tenantId] }),
  })

  const createLk = useMutation({
    mutationFn: (payload: Parameters<typeof createLink>[2]) =>
      createLink(tenantId, workspaceId!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace-links", workspaceId, tenantId] }),
  })

  const extractCanvas = useMutation({
    mutationFn: ({ annotationId, x, y }: { annotationId: string; x?: number; y?: number }) =>
      extractToCanvas(tenantId, workspaceId!, annotationId, { positionX: x, positionY: y }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-canvas-nodes", workspaceId, tenantId] })
      qc.invalidateQueries({ queryKey: ["workspace-links", workspaceId, tenantId] })
    },
  })

  const handleHighlight = useCallback(
    async (sel: TextSelection, color: string) => {
      if (!activeDocumentId) return
      const ann = await createAnn.mutateAsync({
        documentId: activeDocumentId,
        type: "highlight",
        anchor: {
          startOffset: sel.startOffset,
          endOffset: sel.endOffset,
          page: sel.page,
          quote: sel.quote,
        },
        color,
      })
      setSelection(null)
      return ann
    },
    [activeDocumentId, createAnn],
  )

  const handleAddNote = useCallback(
    async (sel: TextSelection, text: string) => {
      if (!activeDocumentId) return
      const ann = await createAnn.mutateAsync({
        documentId: activeDocumentId,
        type: "note",
        anchor: { startOffset: sel.startOffset, endOffset: sel.endOffset, page: sel.page, quote: sel.quote },
        content: { text },
        color: "#BBF7D0",
      })
      await extractCanvas.mutateAsync({ annotationId: ann.id, x: 620, y: canvasNodes.length * 120 + 40 })
      setSelection(null)
    },
    [activeDocumentId, createAnn, extractCanvas, canvasNodes.length],
  )

  const handleAddNewNote = useCallback(async () => {
    await createNode.mutateAsync({
      type: "note",
      positionX: 620,
      positionY: canvasNodes.length * 130 + 40,
      content: { text: "" },
    })
  }, [createNode, canvasNodes.length])

  const handleAddNode = useCallback(
    async (params: { type: string; positionX: number; positionY: number; content?: Record<string, unknown> }) => {
      await createNode.mutateAsync({
        type: params.type as Parameters<typeof createCanvasNode>[2]["type"],
        positionX: params.positionX,
        positionY: params.positionY,
        content: params.content ?? { text: "" },
      })
    },
    [createNode],
  )

  const focusResearchOnCanvas = useCallback(
    (savedResearchId: string) => {
      const node = canvasNodes.find(
        (n: CanvasNode) =>
          n.type === "research_result" &&
          (n.content as { savedResearchId?: string })?.savedResearchId === savedResearchId,
      )
      setCanvasFullscreen(false)
      setPdfFullscreen(false)
      setMobileTab("canvas")
      if (node) {
        requestAnimationFrame(() => {
          document.getElementById(`canvas-node-${node.id}`)?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          })
        })
      }
    },
    [canvasNodes],
  )

  const activeDoc = workspaceDocs.find((d) => d.documentId === activeDocumentId)
  const docAnnotations = annotations.filter((a) => a.documentId === activeDocumentId)

  if (wsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[420px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (wsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {wsErrorObj instanceof Error ? wsErrorObj.message : t("workspace.researchUnavailable")}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetchWorkspace()}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-[calc(100vh-14rem)] min-h-[480px] bg-[#0f1117] rounded-lg border border-white/8 overflow-hidden pb-20">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/8 bg-black/40 backdrop-blur shrink-0">
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-white/70 hover:text-white hover:bg-white/8" asChild>
            <Link href={`/app/matters/${matterId}?hub=1`} aria-label={t("workspace.backToMatter")}>
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("workspace.backToMatter")}
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-5 bg-white/10" />
          <h1 className="text-sm font-semibold truncate max-w-xs text-white/90">
            {matter.title ?? workspace?.title ?? t("workspace.researchCanvas")}
            <span className="ml-2 font-normal text-white/45">· {t("workspace.researchCanvas")}</span>
          </h1>
          <div className="flex-1" />
          <div className="hidden md:flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => void handleAddNewNote()}
                >
                  <StickyNote className="h-3.5 w-3.5" />
                  Add Note
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add a blank note to the canvas</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-7 gap-1.5 border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
                    showSearch && "bg-indigo-500/20 border-indigo-400/30 text-indigo-300",
                  )}
                  onClick={() => setShowSearch((v) => !v)}
                  aria-pressed={showSearch}
                >
                  <Search className="h-3.5 w-3.5" />
                  Search
                </Button>
              </TooltipTrigger>
              <TooltipContent>Search across all workspace documents</TooltipContent>
            </Tooltip>
            {workspaceId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={`${getApiBaseUrl()}/smart-workspaces/${workspaceId}/export`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="h-7 gap-1.5 border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white">
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </Button>
                  </a>
                </TooltipTrigger>
                <TooltipContent>Export workspace as Markdown</TooltipContent>
              </Tooltip>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="md:hidden h-10 w-10 p-0 border-white/10 bg-white/5 text-white/70"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handleAddNewNote()}>
                <StickyNote className="h-4 w-4 mr-2" /> Add Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowSearch((v) => !v)}>
                <Search className="h-4 w-4 mr-2" /> Search
              </DropdownMenuItem>
              {workspaceId && (
                <DropdownMenuItem asChild>
                  <a
                    href={`${getApiBaseUrl()}/smart-workspaces/${workspaceId}/export`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-4 w-4 mr-2" /> Export
                  </a>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isMobile && (
          <div className="flex shrink-0 border-b border-white/8 bg-black/40" role="tablist" aria-label={t("workspace.researchPanes")}>
            {(
              [
                { id: "docs" as const, label: "Docs", icon: FileText },
                { id: "pdf" as const, label: "PDF", icon: FileText },
                { id: "canvas" as const, label: "Canvas", icon: LayoutGrid },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMobileTab(id)}
                role="tab"
                aria-selected={mobileTab === id}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] text-xs font-medium transition-colors",
                  mobileTab === id
                    ? "text-white border-b-2 border-indigo-400 bg-white/5"
                    : "text-white/40 hover:text-white/70",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        )}

        <div ref={workspaceContainerRef} className="flex flex-1 min-h-0 relative">
          <CrossPaneLinksOverlay
            workspaceRef={workspaceContainerRef}
            links={links}
            annotations={annotations}
          />

          {!pdfFullscreen && !canvasFullscreen && (
            <div
              className={cn(
                "flex flex-col shrink-0 border-r border-white/8 bg-black/20",
                isMobile
                  ? mobileTab === "docs"
                    ? "w-full"
                    : "hidden"
                  : "w-52",
              )}
            >
              <DocSidebar
                workspaceDocs={workspaceDocs}
                activeDocumentId={activeDocumentId ?? undefined}
                availableDocs={matterDocs as Array<{ id: string; fileName: string; mimeType?: string; createdAt: string }>}
                onSelectDocument={setActiveDocumentId}
                onAddDocument={(docId) => addDoc.mutate(docId)}
                onRemoveDocument={(docId) => removeDoc.mutate(docId)}
                className="flex-1 overflow-hidden min-h-0"
              />
              <FiledResearchSidebar
                items={filedResearch}
                loading={filedResearchLoading}
                onFocusOnCanvas={focusResearchOnCanvas}
              />
              {showSearch && workspaceId && (
                <CrossDocSearch
                  workspaceId={workspaceId}
                  tenantId={tenantId}
                  onJumpToHit={(hit) => {
                    setActiveDocumentId(hit.documentId)
                    setShowSearch(false)
                  }}
                  className="h-72 border-t border-white/8"
                />
              )}
            </div>
          )}

          {!canvasFullscreen && (
            <div
              className={cn(
                "flex flex-col border-r border-white/8 relative",
                isMobile && mobileTab !== "pdf" && "hidden",
                pdfFullscreen || isMobile ? "flex-1" : "flex-1 max-w-[55%]",
              )}
            >
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/8 bg-black/20 shrink-0">
                <span className="text-xs text-white/40 truncate max-w-[200px]">
                  {activeDoc?.document?.fileName ?? "Select a document"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-white/40 hover:text-white/80"
                  onClick={() => setPdfFullscreen((v) => !v)}
                  aria-label={pdfFullscreen ? t("workspace.exitFullscreen") : t("workspace.enterFullscreen")}
                >
                  {pdfFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>
              </div>

              {activeDoc?.document && (
                <OcrBanner
                  documentId={activeDoc.documentId}
                  fileName={activeDoc.document.fileName}
                  mimeType={activeDoc.document.mimeType}
                  extractedText={activeDoc.document.extractedText}
                  className="mx-3 mt-2 shrink-0"
                />
              )}

              <div className="relative flex-1 min-h-0 bg-[#1a1b26]">
                {activeDoc?.document ? (
                  <PdfViewer
                    fileUrl={activeDoc.document.fileUrl}
                    documentId={activeDocumentId!}
                    annotations={docAnnotations}
                    onSelection={setSelection}
                    onAnnotationClick={(ann: DocumentAnnotation) => {
                      const link = links.find(
                        (l) => l.sourceType === "annotation" && l.sourceId === ann.id,
                      )
                      if (link) {
                        document.getElementById(`canvas-node-${link.targetId}`)?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        })
                      }
                    }}
                    className="h-full"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-white/20 gap-3 p-8">
                    <p className="text-sm text-center">
                      Select a document from the sidebar to open it here.
                    </p>
                    {workspaceDocs.length === 0 && (
                      <p className="text-xs text-center">
                        Use the + button in the sidebar to add matter documents to this workspace.
                      </p>
                    )}
                  </div>
                )}

                {selection && activeDocumentId && workspaceId && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="pointer-events-auto">
                      <AiSelectionToolbar
                        selection={selection}
                        workspaceId={workspaceId}
                        documentId={activeDocumentId}
                        matterId={matterId}
                        tenantId={tenantId}
                        onHighlight={handleHighlight}
                        onAddNote={handleAddNote}
                        onAddToCanvas={async (annId) => {
                          await extractCanvas.mutateAsync({ annotationId: annId })
                          setSelection(null)
                        }}
                        onClose={() => setSelection(null)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!pdfFullscreen && (
            <div
              className={cn(
                "flex flex-col",
                isMobile && mobileTab !== "canvas" && "hidden",
                "flex-1",
              )}
            >
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/8 bg-black/20 shrink-0">
                <span className="text-xs text-white/30">
                  {canvasNodes.length} node{canvasNodes.length !== 1 ? "s" : ""} · double-click to add note
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-white/40 hover:text-white/80"
                  onClick={() => setCanvasFullscreen((v) => !v)}
                  aria-label={canvasFullscreen ? t("workspace.exitFullscreen") : t("workspace.enterFullscreen")}
                >
                  {canvasFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </Button>
              </div>
              <WorkspaceCanvas
                canvasNodes={canvasNodes}
                links={links}
                onNodeMove={(nodeId, x, y) => updateNode.mutate({ nodeId, patch: { positionX: x, positionY: y } })}
                onNodeDelete={(nodeId) => deleteNode.mutate(nodeId)}
                onNodeContentChange={(nodeId, content) => updateNode.mutate({ nodeId, patch: { content } })}
                onAddNode={handleAddNode}
                onCreateLink={(sourceId, targetId) =>
                  createLk.mutate({
                    sourceType: "canvas_node",
                    sourceId,
                    targetType: "canvas_node",
                    targetId,
                  })
                }
                className="flex-1"
              />
            </div>
          )}
        </div>

        <MatterInlineCopilot
          matterId={matterId}
          clientId={matter.clientId ?? undefined}
        />
      </div>
    </TooltipProvider>
  )
}
