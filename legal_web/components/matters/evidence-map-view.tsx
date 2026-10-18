"use client"

import { useCallback, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { AlertTriangle, FileText, Layers, Link2, Scale, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { apiFetch } from "@/lib/api/client"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────

type NodeType = "issue" | "fact" | "document" | "element" | "contradiction"

interface MapNode {
  id: string
  type: NodeType
  label: string
  description?: string
  status?: string
  confidence?: number
  severity?: "low" | "medium" | "high" | "critical"
  metadata?: Record<string, unknown>
}

interface MapEdge {
  id: string
  source: string
  target: string
  relation: "supports" | "contradicts" | "cites" | "linked_to" | "element_of"
}

interface EvidenceMapData {
  nodes: MapNode[]
  edges: MapEdge[]
  contradictions: Array<{ factAId: string; factBId: string; severity: string }>
}

// ── Node color / icon map ──────────────────────────────────────────────────

const nodeConfig: Record<
  NodeType,
  { color: string; bg: string; border: string; icon: React.FC<{ className?: string }> }
> = {
  issue: {
    color: "text-indigo-700 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/50",
    border: "border-indigo-200 dark:border-indigo-800",
    icon: Scale,
  },
  fact: {
    color: "text-sky-700 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-950/50",
    border: "border-sky-200 dark:border-sky-800",
    icon: Layers,
  },
  document: {
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: FileText,
  },
  element: {
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/50",
    border: "border-amber-200 dark:border-amber-800",
    icon: Link2,
  },
  contradiction: {
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/50",
    border: "border-red-200 dark:border-red-800",
    icon: AlertTriangle,
  },
}

// ── Node card ──────────────────────────────────────────────────────────────

function NodeCard({
  node,
  hasContradiction,
  selected,
  onClick,
}: {
  node: MapNode
  hasContradiction: boolean
  selected: boolean
  onClick: () => void
}) {
  const cfg = nodeConfig[node.type]
  const Icon = cfg.icon

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "w-full text-left rounded-lg border p-3 transition-all hover:shadow-sm",
        cfg.bg,
        cfg.border,
        selected ? "ring-2 ring-primary shadow-md" : "hover:ring-1 hover:ring-border",
        hasContradiction ? "ring-2 ring-red-400" : "",
      )}
    >
      <div className="flex items-start gap-2">
        <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", cfg.color)} />
        <div className="flex-1 min-w-0">
          <p className={cn("text-xs font-semibold truncate", cfg.color)}>{node.label}</p>
          {node.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{node.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {node.status && (
              <span className="text-xs bg-secondary text-secondary-foreground rounded px-1.5 py-0.5">
                {node.status}
              </span>
            )}
            {hasContradiction && (
              <span className="inline-flex items-center gap-1 text-xs bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 rounded px-1.5 py-0.5">
                <AlertTriangle className="h-2.5 w-2.5" />
                Contradiction
              </span>
            )}
            {node.confidence !== undefined && (
              <span className="text-xs text-muted-foreground">
                {Math.round(node.confidence * 100)}% confidence
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Detail drawer ──────────────────────────────────────────────────────────

function NodeDetailDrawer({
  node,
  connectedNodes,
  contradictions,
  onClose,
  closeLabel,
}: {
  node: MapNode
  connectedNodes: MapNode[]
  contradictions: Array<{ factAId: string; factBId: string; severity: string }>
  onClose: () => void
  closeLabel: string
}) {
  const cfg = nodeConfig[node.type]
  const Icon = cfg.icon

  const myContradictions = contradictions.filter(
    (c) => c.factAId === node.id || c.factBId === node.id,
  )

  return (
    <div className="rounded-xl border bg-card shadow-lg flex flex-col max-h-[70vh] overflow-hidden">
      <div className={cn("flex items-center justify-between gap-2 px-4 py-3 border-b", cfg.bg)}>
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn("h-4 w-4 shrink-0", cfg.color)} />
          <span className="text-sm font-semibold truncate">{node.label}</span>
          <Badge variant="outline" className="text-xs capitalize">
            {node.type}
          </Badge>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {node.description && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Description
            </p>
            <p className="text-sm">{node.description}</p>
          </div>
        )}

        {node.status && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Status
            </p>
            <Badge variant="secondary" className="capitalize">
              {node.status}
            </Badge>
          </div>
        )}

        {myContradictions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-2">
              Contradictions ({myContradictions.length})
            </p>
            <div className="space-y-2">
              {myContradictions.map((c, i) => (
                <div
                  key={i}
                  className="rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    <span className="text-xs font-medium text-red-700 dark:text-red-400 capitalize">
                      {c.severity} severity
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Conflicts with: {c.factAId === node.id ? c.factBId : c.factAId}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {connectedNodes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Connected ({connectedNodes.length})
            </p>
            <div className="space-y-1">
              {connectedNodes.map((n) => {
                const c = nodeConfig[n.type]
                const NIcon = c.icon
                return (
                  <div key={n.id} className={cn("flex items-center gap-2 rounded px-2 py-1.5", c.bg)}>
                    <NIcon className={cn("h-3.5 w-3.5 shrink-0", c.color)} />
                    <span className="text-xs truncate">{n.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Legend ─────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex items-center gap-3 flex-wrap text-xs">
      {(Object.entries(nodeConfig) as [NodeType, (typeof nodeConfig)[NodeType]][]).map(([type, cfg]) => {
        const Icon = cfg.icon
        return (
          <div key={type} className="flex items-center gap-1.5">
            <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
            <span className="text-muted-foreground capitalize">{type}</span>
          </div>
        )
      })}
      <div className="flex items-center gap-1.5">
        <div className="h-3 w-3 rounded-full ring-2 ring-red-400" />
        <span className="text-muted-foreground">Has contradiction</span>
      </div>
    </div>
  )
}

// ── Column layout map ───────────────────────────────────────────────────────

const COLUMN_ORDER: NodeType[] = ["issue", "element", "fact", "document", "contradiction"]

// ── Main component ─────────────────────────────────────────────────────────

export function EvidenceMapView({
  matterId,
  tenantId,
}: {
  matterId: string
  tenantId: string
}) {
  const t = useTranslations("matters")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: mapData, isLoading } = useQuery({
    queryKey: ["evidence-map", matterId, tenantId],
    queryFn: () =>
      apiFetch<EvidenceMapData>(
        `/platform/matter-intelligence/evidence-map/${matterId}?tenantId=${tenantId}`,
      ),
  })

  const nodesByType = useMemo(() => {
    const map: Record<NodeType, MapNode[]> = {
      issue: [],
      fact: [],
      document: [],
      element: [],
      contradiction: [],
    }
    for (const node of mapData?.nodes ?? []) {
      map[node.type]?.push(node)
    }
    return map
  }, [mapData])

  const contradictionNodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const c of mapData?.contradictions ?? []) {
      ids.add(c.factAId)
      ids.add(c.factBId)
    }
    return ids
  }, [mapData])

  const selectedNode = useMemo(
    () => mapData?.nodes.find((n) => n.id === selectedId) ?? null,
    [mapData, selectedId],
  )

  const connectedNodeIds = useMemo(() => {
    if (!selectedId || !mapData) return new Set<string>()
    const ids = new Set<string>()
    for (const edge of mapData.edges) {
      if (edge.source === selectedId) ids.add(edge.target)
      if (edge.target === selectedId) ids.add(edge.source)
    }
    return ids
  }, [selectedId, mapData])

  const connectedNodes = useMemo(
    () => mapData?.nodes.filter((n) => connectedNodeIds.has(n.id)) ?? [],
    [mapData, connectedNodeIds],
  )

  const handleSelect = useCallback(
    (id: string) => setSelectedId((prev) => (prev === id ? null : id)),
    [],
  )

  const totalContradictions = mapData?.contradictions.length ?? 0
  const totalNodes = mapData?.nodes.length ?? 0

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t("workspace.evidenceMap")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("workspace.evidenceMapDescription")}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <span>{t("workspace.nodeCount", { count: totalNodes })}</span>
          {totalContradictions > 0 && (
            <span className="font-medium text-red-600">
              {totalContradictions} contradiction{totalContradictions !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !mapData || totalNodes === 0 ? (
        <div className="py-20 text-center text-muted-foreground text-sm space-y-2">
          <Layers className="h-8 w-8 opacity-30 mx-auto" />
          <p>No evidence map data yet.</p>
          <p className="text-xs">Add facts, issues, and documents to this matter to build the evidence map.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Legend />

          {totalContradictions > 0 && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">
                <strong>{totalContradictions} contradiction{totalContradictions !== 1 ? "s" : ""}</strong> detected.
                Nodes with red rings require review.
              </p>
              <Button size="sm" variant="outline" className="ml-auto shrink-0 text-red-700 border-red-300 hover:bg-red-50 dark:border-red-700 dark:text-red-400">
                Review
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {COLUMN_ORDER.map((type) => {
              const nodes = nodesByType[type]
              if (nodes.length === 0) return null
              const cfg = nodeConfig[type]
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <cfg.icon className={cn("h-3.5 w-3.5", cfg.color)} />
                    <p className={cn("text-xs font-semibold uppercase tracking-wide", cfg.color)}>
                      {type}s ({nodes.length})
                    </p>
                  </div>
                  {nodes.map((node) => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      hasContradiction={contradictionNodeIds.has(node.id)}
                      selected={selectedId === node.id}
                      onClick={() => handleSelect(node.id)}
                    />
                  ))}
                </div>
              )
            })}
          </div>

          {selectedNode && (
            <div className="mt-4">
              <NodeDetailDrawer
                node={selectedNode}
                connectedNodes={connectedNodes}
                contradictions={mapData?.contradictions ?? []}
                onClose={() => setSelectedId(null)}
                closeLabel={t("workspace.closeEvidenceDetails")}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
