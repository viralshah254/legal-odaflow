import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateWorkspaceDto,
  UpdateLayoutDto,
  AddDocumentDto,
  UpdatePaneStateDto,
  CreateAnnotationDto,
  UpdateAnnotationDto,
  CreateLinkDto,
  CreateCanvasNodeDto,
  UpdateCanvasNodeDto,
  ExtractToCanvasDto,
} from './smart-workspace.dto';

@Injectable()
export class SmartWorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Workspace lifecycle ────────────────────────────────────────────────────

  async getOrCreateForMatter(tenantId: string, matterId: string, userId: string) {
    const existing = await this.prisma.smartWorkspace.findFirst({
      where: { tenantId, matterId },
      include: this.defaultIncludes(),
    });
    if (existing) return existing;

    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      select: { title: true },
    });
    if (!matter) throw new NotFoundException('Matter not found');

    return this.prisma.smartWorkspace.create({
      data: {
        tenantId,
        matterId,
        title: `${matter.title} — Workspace`,
        createdBy: userId,
      },
      include: this.defaultIncludes(),
    });
  }

  async findOne(tenantId: string, workspaceId: string) {
    const ws = await this.prisma.smartWorkspace.findFirst({
      where: { id: workspaceId, tenantId },
      include: this.defaultIncludes(),
    });
    if (!ws) throw new NotFoundException('Workspace not found');
    return ws;
  }

  async listForMatter(tenantId: string, matterId: string) {
    return this.prisma.smartWorkspace.findMany({
      where: { tenantId, matterId },
      include: this.defaultIncludes(),
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(tenantId: string, userId: string, dto: CreateWorkspaceDto) {
    return this.prisma.smartWorkspace.create({
      data: {
        tenantId,
        matterId: dto.matterId,
        clientId: dto.clientId,
        title: dto.title,
        createdBy: userId,
      },
      include: this.defaultIncludes(),
    });
  }

  async updateLayout(tenantId: string, workspaceId: string, dto: UpdateLayoutDto) {
    await this.assertOwnership(tenantId, workspaceId);
    return this.prisma.smartWorkspace.update({
      where: { id: workspaceId },
      data: { layoutJson: dto.layoutJson as Prisma.InputJsonValue },
    });
  }

  async delete(tenantId: string, workspaceId: string) {
    await this.assertOwnership(tenantId, workspaceId);
    await this.prisma.smartWorkspace.delete({ where: { id: workspaceId } });
    return { deleted: true };
  }

  // ── Workspace documents ────────────────────────────────────────────────────

  async addDocument(tenantId: string, workspaceId: string, dto: AddDocumentDto) {
    await this.assertOwnership(tenantId, workspaceId);
    const doc = await this.prisma.document.findFirst({
      where: { id: dto.documentId, tenantId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const maxOrder = await this.prisma.workspaceDocument.aggregate({
      where: { workspaceId },
      _max: { orderIndex: true },
    });
    const orderIndex = dto.orderIndex ?? (maxOrder._max.orderIndex ?? -1) + 1;

    return this.prisma.workspaceDocument.upsert({
      where: { workspaceId_documentId: { workspaceId, documentId: dto.documentId } },
      create: { workspaceId, documentId: dto.documentId, orderIndex },
      update: { orderIndex },
      include: {
        document: { select: { id: true, fileName: true, mimeType: true, fileUrl: true, extractedText: true } },
      },
    });
  }

  async removeDocument(tenantId: string, workspaceId: string, documentId: string) {
    await this.assertOwnership(tenantId, workspaceId);
    await this.prisma.workspaceDocument.delete({
      where: { workspaceId_documentId: { workspaceId, documentId } },
    });
    return { removed: true };
  }

  async updatePaneState(
    tenantId: string,
    workspaceId: string,
    documentId: string,
    dto: UpdatePaneStateDto,
  ) {
    await this.assertOwnership(tenantId, workspaceId);
    return this.prisma.workspaceDocument.update({
      where: { workspaceId_documentId: { workspaceId, documentId } },
      data: { paneState: dto.paneState as Prisma.InputJsonValue },
    });
  }

  // ── Annotations ────────────────────────────────────────────────────────────

  async listAnnotations(tenantId: string, workspaceId: string, documentId?: string) {
    await this.assertOwnership(tenantId, workspaceId);
    return this.prisma.documentAnnotation.findMany({
      where: { workspaceId, ...(documentId ? { documentId } : {}) },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createAnnotation(
    tenantId: string,
    workspaceId: string,
    userId: string,
    dto: CreateAnnotationDto,
  ) {
    await this.assertOwnership(tenantId, workspaceId);
    return this.prisma.documentAnnotation.create({
      data: {
        workspaceId,
        documentId: dto.documentId,
        type: dto.type,
        anchor: dto.anchor as object,
        content: dto.content as object | undefined,
        color: dto.color ?? '#FDE68A',
        createdBy: userId,
      },
    });
  }

  async updateAnnotation(
    tenantId: string,
    workspaceId: string,
    annotationId: string,
    dto: UpdateAnnotationDto,
  ) {
    await this.assertOwnership(tenantId, workspaceId);
    return this.prisma.documentAnnotation.update({
      where: { id: annotationId },
      data: {
        ...(dto.content !== undefined && { content: dto.content as object }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.aiMetadata !== undefined && { aiMetadata: dto.aiMetadata as object }),
      },
    });
  }

  async deleteAnnotation(tenantId: string, workspaceId: string, annotationId: string) {
    await this.assertOwnership(tenantId, workspaceId);
    await this.prisma.documentAnnotation.delete({ where: { id: annotationId } });
    return { deleted: true };
  }

  // ── Links ──────────────────────────────────────────────────────────────────

  async listLinks(tenantId: string, workspaceId: string) {
    await this.assertOwnership(tenantId, workspaceId);
    return this.prisma.workspaceLink.findMany({ where: { workspaceId } });
  }

  async createLink(tenantId: string, workspaceId: string, dto: CreateLinkDto) {
    await this.assertOwnership(tenantId, workspaceId);
    return this.prisma.workspaceLink.create({
      data: {
        workspaceId,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        style: dto.style as object | undefined,
      },
    });
  }

  async deleteLink(tenantId: string, workspaceId: string, linkId: string) {
    await this.assertOwnership(tenantId, workspaceId);
    await this.prisma.workspaceLink.delete({ where: { id: linkId } });
    return { deleted: true };
  }

  // ── Canvas nodes ───────────────────────────────────────────────────────────

  async listCanvasNodes(tenantId: string, workspaceId: string) {
    await this.assertOwnership(tenantId, workspaceId);
    return this.prisma.canvasNode.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createCanvasNode(
    tenantId: string,
    workspaceId: string,
    userId: string,
    dto: CreateCanvasNodeDto,
  ) {
    await this.assertOwnership(tenantId, workspaceId);
    return this.prisma.canvasNode.create({
      data: {
        workspaceId,
        type: dto.type,
        positionX: dto.positionX,
        positionY: dto.positionY,
        width: dto.width ?? 280,
        height: dto.height,
        content: dto.content as object,
        linkedAnnotationIds: dto.linkedAnnotationIds ?? [],
        createdBy: userId,
      },
    });
  }

  async updateCanvasNode(
    tenantId: string,
    workspaceId: string,
    nodeId: string,
    dto: UpdateCanvasNodeDto,
  ) {
    await this.assertOwnership(tenantId, workspaceId);
    return this.prisma.canvasNode.update({
      where: { id: nodeId },
      data: {
        ...(dto.positionX !== undefined && { positionX: dto.positionX }),
        ...(dto.positionY !== undefined && { positionY: dto.positionY }),
        ...(dto.width !== undefined && { width: dto.width }),
        ...(dto.height !== undefined && { height: dto.height }),
        ...(dto.content !== undefined && { content: dto.content as object }),
        ...(dto.linkedAnnotationIds !== undefined && {
          linkedAnnotationIds: dto.linkedAnnotationIds,
        }),
      },
    });
  }

  async deleteCanvasNode(tenantId: string, workspaceId: string, nodeId: string) {
    await this.assertOwnership(tenantId, workspaceId);
    await this.prisma.canvasNode.delete({ where: { id: nodeId } });
    return { deleted: true };
  }

  // ── Extract-to-canvas (drag highlight to canvas) ───────────────────────────

  async extractToCanvas(
    tenantId: string,
    workspaceId: string,
    userId: string,
    dto: ExtractToCanvasDto,
  ) {
    await this.assertOwnership(tenantId, workspaceId);

    const annotation = await this.prisma.documentAnnotation.findFirst({
      where: { id: dto.annotationId, workspaceId },
    });
    if (!annotation) throw new NotFoundException('Annotation not found');

    const anchor = annotation.anchor as {
      quote?: string;
      page?: number;
    };

    const node = await this.prisma.canvasNode.create({
      data: {
        workspaceId,
        type: 'excerpt_card',
        positionX: dto.positionX ?? 600,
        positionY: dto.positionY ?? 100,
        width: 320,
        content: {
          quote: anchor.quote ?? '',
          documentId: annotation.documentId,
          page: anchor.page,
          annotationId: annotation.id,
          color: annotation.color,
        },
        linkedAnnotationIds: [annotation.id],
        createdBy: userId,
      },
    });

    // Auto-create a visual link from annotation to canvas node
    await this.prisma.workspaceLink.create({
      data: {
        workspaceId,
        sourceType: 'annotation',
        sourceId: annotation.id,
        targetType: 'canvas_node',
        targetId: node.id,
      },
    });

    return { node };
  }

  /** Pin a filed SavedResearch record onto the matter canvas (idempotent). */
  async pinSavedResearchToCanvas(
    tenantId: string,
    matterId: string,
    userId: string,
    payload: {
      savedResearchId: string;
      title: string;
      query: string;
      summary?: string;
      aiOutputId?: string | null;
    },
  ): Promise<void> {
    const workspace = await this.getOrCreateForMatter(tenantId, matterId, userId);
    const existingNodes = await this.prisma.canvasNode.findMany({
      where: { workspaceId: workspace.id, type: 'research_result' },
      select: { content: true },
    });
    const alreadyPinned = existingNodes.some((node) => {
      const content = node.content as { savedResearchId?: string } | null;
      return content?.savedResearchId === payload.savedResearchId;
    });
    if (alreadyPinned) return;

    const nodeCount = await this.prisma.canvasNode.count({
      where: { workspaceId: workspace.id },
    });

    await this.prisma.canvasNode.create({
      data: {
        workspaceId: workspace.id,
        type: 'research_result',
        positionX: 620,
        positionY: nodeCount * 130 + 40,
        width: 320,
        content: {
          title: payload.title,
          query: payload.query,
          summary: payload.summary ?? '',
          savedResearchId: payload.savedResearchId,
          aiOutputId: payload.aiOutputId ?? null,
        },
        linkedAnnotationIds: [],
        createdBy: userId,
      },
    });
  }

  // ── Evidence map (fixes missing backend route for evidence-map-view.tsx) ───

  async getEvidenceMap(tenantId: string, matterId: string) {
    const matter = await this.prisma.matter.findFirst({
      where: { id: matterId, tenantId },
      select: { matterGraph: true },
    });
    if (!matter) throw new NotFoundException('Matter not found');

    const matterGraph = (matter.matterGraph ?? {}) as {
      issues?: Array<{ id: string; title: string; description?: string }>;
      facts?: Array<{ id: string; text: string; sourceDocumentId?: string }>;
      evidence?: Array<{
        id: string;
        title: string;
        category?: string;
        sourceDocumentId?: string;
      }>;
      contradictions?: Array<{ factAId: string; factBId: string; severity: string }>;
    };

    const nodes: Array<{
      id: string;
      type: string;
      label: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }> = [];
    const edges: Array<{
      id: string;
      source: string;
      target: string;
      relation: string;
    }> = [];

    for (const issue of matterGraph.issues ?? []) {
      nodes.push({ id: `issue-${issue.id}`, type: 'issue', label: issue.title, description: issue.description });
    }
    for (const fact of matterGraph.facts ?? []) {
      nodes.push({ id: `fact-${fact.id}`, type: 'fact', label: fact.text.slice(0, 80) });
      if (fact.sourceDocumentId) {
        edges.push({
          id: `edge-fact-doc-${fact.id}`,
          source: `document-${fact.sourceDocumentId}`,
          target: `fact-${fact.id}`,
          relation: 'cites',
        });
      }
    }
    for (const ev of matterGraph.evidence ?? []) {
      nodes.push({
        id: `evidence-${ev.id}`,
        type: 'element',
        label: ev.title,
        metadata: { category: ev.category, sourceDocumentId: ev.sourceDocumentId },
      });
      if (ev.sourceDocumentId) {
        nodes.push({ id: `document-${ev.sourceDocumentId}`, type: 'document', label: ev.sourceDocumentId });
        edges.push({
          id: `edge-ev-doc-${ev.id}`,
          source: `document-${ev.sourceDocumentId}`,
          target: `evidence-${ev.id}`,
          relation: 'cites',
        });
      }
    }

    // Deduplicate document nodes
    const seen = new Set<string>();
    const deduped = nodes.filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });

    return {
      nodes: deduped,
      edges,
      contradictions: matterGraph.contradictions ?? [],
    };
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private async assertOwnership(tenantId: string, workspaceId: string) {
    const ws = await this.prisma.smartWorkspace.findFirst({
      where: { id: workspaceId, tenantId },
      select: { id: true },
    });
    if (!ws) throw new ForbiddenException('Workspace not found or access denied');
    return ws;
  }

  private defaultIncludes() {
    return {
      workspaceDocs: {
        orderBy: { orderIndex: 'asc' as const },
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              mimeType: true,
              fileUrl: true,
              extractedText: true,
              createdAt: true,
            },
          },
        },
      },
    };
  }
}
