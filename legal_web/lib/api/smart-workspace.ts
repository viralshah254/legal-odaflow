import { apiFetch } from "@/lib/api/client"

export interface SmartWorkspace {
  id: string
  tenantId: string
  matterId?: string
  clientId?: string
  title: string
  layoutJson: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
  workspaceDocs: WorkspaceDoc[]
}

export interface WorkspaceDoc {
  id: string
  workspaceId: string
  documentId: string
  orderIndex: number
  paneState?: Record<string, unknown>
  document: {
    id: string
    fileName: string
    mimeType?: string
    fileUrl: string
    extractedText?: string
    createdAt: string
  }
}

export interface DocumentAnnotation {
  id: string
  workspaceId: string
  documentId: string
  type: "highlight" | "note" | "excerpt" | "ink"
  anchor: {
    startOffset: number
    endOffset: number
    page?: number
    bbox?: { x: number; y: number; width: number; height: number }
    quote: string
  }
  content?: Record<string, unknown>
  color: string
  createdBy: string
  aiMetadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface WorkspaceLink {
  id: string
  workspaceId: string
  sourceType: "annotation" | "canvas_node"
  sourceId: string
  targetType: "annotation" | "canvas_node"
  targetId: string
  style?: Record<string, unknown>
}

export interface CanvasNode {
  id: string
  workspaceId: string
  type: "note" | "excerpt_card" | "timeline" | "image" | "research_result" | "ink"
  positionX: number
  positionY: number
  width: number
  height?: number
  content: Record<string, unknown>
  linkedAnnotationIds: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

// ── Workspace ─────────────────────────────────────────────────────────────

export async function getOrCreateMatterWorkspace(
  tenantId: string,
  matterId: string,
): Promise<SmartWorkspace> {
  return apiFetch(`/matters/${matterId}/smart-workspace`, { tenantId })
}

export async function getWorkspace(tenantId: string, workspaceId: string): Promise<SmartWorkspace> {
  return apiFetch(`/smart-workspaces/${workspaceId}`, { tenantId })
}

export async function updateWorkspaceLayout(
  tenantId: string,
  workspaceId: string,
  layoutJson: Record<string, unknown>,
): Promise<void> {
  return apiFetch(`/smart-workspaces/${workspaceId}/layout`, {
    method: "PATCH",
    body: JSON.stringify({ layoutJson }),
    tenantId,
  })
}

// ── Documents ─────────────────────────────────────────────────────────────

export async function addDocumentToWorkspace(
  tenantId: string,
  workspaceId: string,
  documentId: string,
): Promise<WorkspaceDoc> {
  return apiFetch(`/smart-workspaces/${workspaceId}/documents`, {
    method: "POST",
    body: JSON.stringify({ documentId }),
    tenantId,
  })
}

export async function removeDocumentFromWorkspace(
  tenantId: string,
  workspaceId: string,
  documentId: string,
): Promise<void> {
  return apiFetch(`/smart-workspaces/${workspaceId}/documents/${documentId}`, {
    method: "DELETE",
    tenantId,
  })
}

// ── Annotations ───────────────────────────────────────────────────────────

export async function listAnnotations(
  tenantId: string,
  workspaceId: string,
  documentId?: string,
): Promise<DocumentAnnotation[]> {
  const qs = documentId ? `?documentId=${documentId}` : ""
  return apiFetch(`/smart-workspaces/${workspaceId}/annotations${qs}`, { tenantId })
}

export async function createAnnotation(
  tenantId: string,
  workspaceId: string,
  payload: {
    documentId: string
    type: DocumentAnnotation["type"]
    anchor: DocumentAnnotation["anchor"]
    content?: Record<string, unknown>
    color?: string
  },
): Promise<DocumentAnnotation> {
  return apiFetch(`/smart-workspaces/${workspaceId}/annotations`, {
    method: "POST",
    body: JSON.stringify(payload),
    tenantId,
  })
}

export async function updateAnnotation(
  tenantId: string,
  workspaceId: string,
  annotationId: string,
  patch: { content?: Record<string, unknown>; color?: string; aiMetadata?: Record<string, unknown> },
): Promise<DocumentAnnotation> {
  return apiFetch(`/smart-workspaces/${workspaceId}/annotations/${annotationId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    tenantId,
  })
}

export async function deleteAnnotation(
  tenantId: string,
  workspaceId: string,
  annotationId: string,
): Promise<void> {
  return apiFetch(`/smart-workspaces/${workspaceId}/annotations/${annotationId}`, {
    method: "DELETE",
    tenantId,
  })
}

// ── Links ─────────────────────────────────────────────────────────────────

export async function listLinks(tenantId: string, workspaceId: string): Promise<WorkspaceLink[]> {
  return apiFetch(`/smart-workspaces/${workspaceId}/links`, { tenantId })
}

export async function createLink(
  tenantId: string,
  workspaceId: string,
  payload: Omit<WorkspaceLink, "id" | "workspaceId">,
): Promise<WorkspaceLink> {
  return apiFetch(`/smart-workspaces/${workspaceId}/links`, {
    method: "POST",
    body: JSON.stringify(payload),
    tenantId,
  })
}

export async function deleteLink(
  tenantId: string,
  workspaceId: string,
  linkId: string,
): Promise<void> {
  return apiFetch(`/smart-workspaces/${workspaceId}/links/${linkId}`, {
    method: "DELETE",
    tenantId,
  })
}

// ── Canvas nodes ──────────────────────────────────────────────────────────

export async function listCanvasNodes(tenantId: string, workspaceId: string): Promise<CanvasNode[]> {
  return apiFetch(`/smart-workspaces/${workspaceId}/canvas-nodes`, { tenantId })
}

export async function createCanvasNode(
  tenantId: string,
  workspaceId: string,
  payload: Pick<CanvasNode, "type" | "positionX" | "positionY" | "content"> & {
    width?: number
    height?: number
    linkedAnnotationIds?: string[]
  },
): Promise<CanvasNode> {
  return apiFetch(`/smart-workspaces/${workspaceId}/canvas-nodes`, {
    method: "POST",
    body: JSON.stringify(payload),
    tenantId,
  })
}

export async function updateCanvasNode(
  tenantId: string,
  workspaceId: string,
  nodeId: string,
  patch: Partial<Pick<CanvasNode, "positionX" | "positionY" | "width" | "height" | "content" | "linkedAnnotationIds">>,
): Promise<CanvasNode> {
  return apiFetch(`/smart-workspaces/${workspaceId}/canvas-nodes/${nodeId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    tenantId,
  })
}

export async function deleteCanvasNode(
  tenantId: string,
  workspaceId: string,
  nodeId: string,
): Promise<void> {
  return apiFetch(`/smart-workspaces/${workspaceId}/canvas-nodes/${nodeId}`, {
    method: "DELETE",
    tenantId,
  })
}

export async function extractToCanvas(
  tenantId: string,
  workspaceId: string,
  annotationId: string,
  position?: { positionX?: number; positionY?: number },
): Promise<{ node: CanvasNode }> {
  return apiFetch(`/smart-workspaces/${workspaceId}/extract-to-canvas`, {
    method: "POST",
    body: JSON.stringify({ annotationId, ...position }),
    tenantId,
  })
}
