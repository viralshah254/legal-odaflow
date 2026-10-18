import { Injectable, NotFoundException } from '@nestjs/common';
import { KnowledgeGraphEdge, KnowledgeGraphNode, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class KnowledgeGraphService {
  constructor(private readonly prisma: PrismaService) {}

  async findNode(canonicalId: string): Promise<KnowledgeGraphNode | null> {
    return this.prisma.knowledgeGraphNode.findUnique({ where: { canonicalId } });
  }

  async getIssueElements(issueCanonicalId: string): Promise<KnowledgeGraphNode[]> {
    const issue = await this.findNode(issueCanonicalId);
    if (!issue) throw new NotFoundException(`Node not found: ${issueCanonicalId}`);

    const edges = await this.prisma.knowledgeGraphEdge.findMany({
      where: { sourceId: issue.id, edgeType: 'HAS_ELEMENT', status: 'active' },
      include: { target: true },
    });

    return edges.map((e) => e.target);
  }

  async getCaseTreatment(
    caseCanonicalId: string,
  ): Promise<{ treatedAs: string; byCase: string }[]> {
    const caseNode = await this.findNode(caseCanonicalId);
    if (!caseNode) throw new NotFoundException(`Case node not found: ${caseCanonicalId}`);

    const treatmentEdgeTypes = ['OVERRULES', 'DISTINGUISHES', 'FOLLOWS'];
    const edges = await this.prisma.knowledgeGraphEdge.findMany({
      where: {
        targetId: caseNode.id,
        edgeType: { in: treatmentEdgeTypes },
        status: 'active',
      },
      include: { source: true },
    });

    return edges.map((e) => ({
      treatedAs: e.edgeType,
      byCase: e.source.canonicalId,
    }));
  }

  async getRemedyRequirements(remedyCanonicalId: string): Promise<{
    evidence: KnowledgeGraphNode[];
    procedures: KnowledgeGraphNode[];
  }> {
    const remedy = await this.findNode(remedyCanonicalId);
    if (!remedy) throw new NotFoundException(`Remedy node not found: ${remedyCanonicalId}`);

    const [evidenceEdges, procedureEdges] = await Promise.all([
      this.prisma.knowledgeGraphEdge.findMany({
        where: { sourceId: remedy.id, edgeType: 'REQUIRES_EVIDENCE', status: 'active' },
        include: { target: true },
      }),
      this.prisma.knowledgeGraphEdge.findMany({
        where: { sourceId: remedy.id, edgeType: 'REQUIRES_PROCEDURE', status: 'active' },
        include: { target: true },
      }),
    ]);

    return {
      evidence: evidenceEdges.map((e) => e.target),
      procedures: procedureEdges.map((e) => e.target),
    };
  }

  async searchNodes(
    query: string,
    nodeType?: string,
    jurisdiction?: string,
  ): Promise<KnowledgeGraphNode[]> {
    return this.prisma.knowledgeGraphNode.findMany({
      where: {
        status: 'active',
        ...(nodeType ? { nodeType } : {}),
        ...(jurisdiction ? { jurisdiction } : {}),
        label: { contains: query, mode: 'insensitive' },
      },
      take: 20,
      orderBy: { confidence: 'desc' },
    });
  }

  async addNode(
    node: Omit<KnowledgeGraphNode, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<KnowledgeGraphNode> {
    return this.prisma.knowledgeGraphNode.upsert({
      where: { canonicalId: node.canonicalId },
      update: {
        label: node.label,
        metadata: node.metadata ?? Prisma.JsonNull,
        confidence: node.confidence,
        status: node.status,
      },
      create: {
        canonicalId: node.canonicalId,
        nodeType: node.nodeType,
        label: node.label,
        jurisdiction: node.jurisdiction,
        metadata: node.metadata ?? Prisma.JsonNull,
        validFrom: node.validFrom,
        validTo: node.validTo,
        confidence: node.confidence,
        status: node.status,
      },
    });
  }

  async addEdge(edge: {
    sourceCanonicalId: string;
    targetCanonicalId: string;
    edgeType: string;
    metadata?: Record<string, unknown>;
  }): Promise<KnowledgeGraphEdge> {
    const [source, target] = await Promise.all([
      this.prisma.knowledgeGraphNode.findUnique({ where: { canonicalId: edge.sourceCanonicalId } }),
      this.prisma.knowledgeGraphNode.findUnique({ where: { canonicalId: edge.targetCanonicalId } }),
    ]);

    if (!source) throw new NotFoundException(`Source node not found: ${edge.sourceCanonicalId}`);
    if (!target) throw new NotFoundException(`Target node not found: ${edge.targetCanonicalId}`);

    return this.prisma.knowledgeGraphEdge.upsert({
      where: { sourceId_targetId_edgeType: { sourceId: source.id, targetId: target.id, edgeType: edge.edgeType } },
      update: { metadata: (edge.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull },
      create: {
        sourceId: source.id,
        targetId: target.id,
        edgeType: edge.edgeType,
        metadata: (edge.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }

  async traverseGraph(
    fromCanonicalId: string,
    edgeTypes: string[],
    depth: number,
  ): Promise<{ nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] }> {
    const visited = new Set<string>();
    const resultNodes: KnowledgeGraphNode[] = [];
    const resultEdges: KnowledgeGraphEdge[] = [];

    const startNode = await this.findNode(fromCanonicalId);
    if (!startNode) throw new NotFoundException(`Node not found: ${fromCanonicalId}`);

    await this.dfs(startNode, edgeTypes, depth, visited, resultNodes, resultEdges);

    return { nodes: resultNodes, edges: resultEdges };
  }

  private async dfs(
    node: KnowledgeGraphNode,
    edgeTypes: string[],
    remainingDepth: number,
    visited: Set<string>,
    resultNodes: KnowledgeGraphNode[],
    resultEdges: KnowledgeGraphEdge[],
  ): Promise<void> {
    if (visited.has(node.id) || remainingDepth <= 0) return;
    visited.add(node.id);
    resultNodes.push(node);

    const edges = await this.prisma.knowledgeGraphEdge.findMany({
      where: {
        sourceId: node.id,
        edgeType: edgeTypes.length > 0 ? { in: edgeTypes } : undefined,
        status: 'active',
      },
      include: { target: true },
    });

    for (const edge of edges) {
      resultEdges.push(edge);
      await this.dfs(edge.target, edgeTypes, remainingDepth - 1, visited, resultNodes, resultEdges);
    }
  }

  async seedInitialData(): Promise<void> {
    type SeedNode = Omit<Parameters<typeof this.addNode>[0], never>;
    const seeds: SeedNode[] = [
      { canonicalId: 'jurisdiction:IN', nodeType: 'jurisdiction', label: 'India', jurisdiction: 'IN', metadata: null, validFrom: null, validTo: null, publishedAt: null, verifiedAt: null, verifiedBy: null, confidence: 1.0, status: 'active' },
      { canonicalId: 'jurisdiction:US', nodeType: 'jurisdiction', label: 'United States', jurisdiction: 'US', metadata: null, validFrom: null, validTo: null, publishedAt: null, verifiedAt: null, verifiedBy: null, confidence: 1.0, status: 'active' },
      { canonicalId: 'court:IN:SC', nodeType: 'court', label: 'Supreme Court of India', jurisdiction: 'IN', metadata: { binding: true, tier: 1 }, validFrom: null, validTo: null, publishedAt: null, verifiedAt: null, verifiedBy: null, confidence: 1.0, status: 'active' },
      { canonicalId: 'court:US:SCOTUS', nodeType: 'court', label: 'Supreme Court of the United States', jurisdiction: 'US', metadata: { binding: true, tier: 1 }, validFrom: null, validTo: null, publishedAt: null, verifiedAt: null, verifiedBy: null, confidence: 1.0, status: 'active' },
      { canonicalId: 'statute:IN:IPC:1860', nodeType: 'statute', label: 'Indian Penal Code, 1860', jurisdiction: 'IN', metadata: null, validFrom: new Date('1860-01-01'), validTo: null, publishedAt: null, verifiedAt: null, verifiedBy: null, confidence: 1.0, status: 'active' },
      { canonicalId: 'statute:IN:BNSS:2023', nodeType: 'statute', label: 'Bharatiya Nagarik Suraksha Sanhita, 2023', jurisdiction: 'IN', metadata: null, validFrom: new Date('2024-07-01'), validTo: null, publishedAt: null, verifiedAt: null, verifiedBy: null, confidence: 1.0, status: 'active' },
    ];

    for (const seed of seeds) {
      await this.addNode(seed);
    }

    // Seed edges
    await this.addEdge({ sourceCanonicalId: 'court:IN:SC', targetCanonicalId: 'jurisdiction:IN', edgeType: 'APPLIES_IN' });
    await this.addEdge({ sourceCanonicalId: 'statute:IN:IPC:1860', targetCanonicalId: 'jurisdiction:IN', edgeType: 'APPLIES_IN' });
    await this.addEdge({ sourceCanonicalId: 'statute:IN:BNSS:2023', targetCanonicalId: 'jurisdiction:IN', edgeType: 'APPLIES_IN' });
    await this.addEdge({ sourceCanonicalId: 'statute:IN:BNSS:2023', targetCanonicalId: 'statute:IN:IPC:1860', edgeType: 'SUPERSEDES' });
  }
}
