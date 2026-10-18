import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { KnowledgeGraphService } from './knowledge-graph.service';

interface ExtractedEntity {
  canonicalId: string;
  nodeType: 'case' | 'statute' | 'principle' | 'concept' | 'party' | 'court' | 'issue' | 'remedy';
  label: string;
  jurisdiction?: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

interface ExtractedRelation {
  sourceCanonicalId: string;
  targetCanonicalId: string;
  edgeType: string;
  metadata?: Record<string, unknown>;
}

interface ExtractionResult {
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
  nodesCreated: number;
  edgesCreated: number;
}

/**
 * Extracts legal entities and relationships from documents/text
 * and ingests them into the Knowledge Graph.
 */
@Injectable()
export class KgEntityExtractorService {
  private readonly logger = new Logger(KgEntityExtractorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kgService: KnowledgeGraphService,
    @Optional() private readonly llm: LlmCompletionService | null,
  ) {}

  /**
   * Extract entities from a LegalSearchDocument and ingest into KG.
   */
  async ingestFromLegalDocument(documentId: string): Promise<ExtractionResult> {
    const doc = await this.prisma.legalSearchDocument.findUnique({ where: { id: documentId } });
    if (!doc) return { entities: [], relations: [], nodesCreated: 0, edgesCreated: 0 };

    const text = doc.rawText ?? `${doc.title} ${doc.citation ?? ''}`;
    const jurisdiction = doc.jurisdiction;

    return this.extractAndIngest(text, jurisdiction, {
      sourceDocumentId: documentId,
      sourceType: doc.documentType ?? 'case_law',
      citation: doc.citation ?? undefined,
    });
  }

  /**
   * Extract entities from free-form legal text.
   */
  async extractAndIngest(
    text: string,
    jurisdiction: string,
    context?: Record<string, unknown>,
  ): Promise<ExtractionResult> {
    if (!this.llm) {
      return { entities: [], relations: [], nodesCreated: 0, edgesCreated: 0 };
    }

    const { entities, relations } = await this.extractWithLlm(text, jurisdiction);

    let nodesCreated = 0;
    let edgesCreated = 0;

    // Ingest entities
    for (const entity of entities) {
      try {
        await this.kgService.addNode({
          canonicalId: entity.canonicalId,
          nodeType: entity.nodeType,
          label: entity.label,
          jurisdiction: entity.jurisdiction ?? jurisdiction,
          confidence: entity.confidence,
          status: 'active',
          metadata: { ...entity.metadata, ...context } as any,
          validFrom: null,
          validTo: null,
          publishedAt: null,
          verifiedAt: null,
          verifiedBy: null,
        });
        nodesCreated++;
      } catch (err) {
        this.logger.warn(`Failed to add KG node ${entity.canonicalId}: ${String(err)}`);
      }
    }

    // Ingest relations
    for (const relation of relations) {
      try {
        await this.kgService.addEdge({
          sourceCanonicalId: relation.sourceCanonicalId,
          targetCanonicalId: relation.targetCanonicalId,
          edgeType: relation.edgeType,
          metadata: relation.metadata,
        });
        edgesCreated++;
      } catch {
        // Skip if nodes don't exist yet
      }
    }

    this.logger.log(
      `KG ingestion: ${nodesCreated} nodes, ${edgesCreated} edges for jurisdiction ${jurisdiction}`,
    );

    return { entities, relations, nodesCreated, edgesCreated };
  }

  private async extractWithLlm(
    text: string,
    jurisdiction: string,
  ): Promise<{ entities: ExtractedEntity[]; relations: ExtractedRelation[] }> {
    const systemPrompt = `You are a legal knowledge graph extractor. Extract entities and relationships from the legal text.

Entity types:
- case: Court case (include citation if available)
- statute: Legislation (include section if applicable)
- principle: Legal principle or doctrine
- concept: Legal concept or term of art
- party: Party to a case/dispute
- court: Court name
- issue: Legal issue or question
- remedy: Remedy sought or granted

Relationship types:
- CITES: case/statute cites another case/statute
- FOLLOWS: case follows precedent
- OVERRULES: case overrules earlier case
- DISTINGUISHES: case distinguishes earlier case
- APPLIES: case/party applies a statute
- ESTABLISHES: case establishes principle
- REQUIRES: remedy requires a condition
- HAS_ISSUE: matter has legal issue
- JURISDICTION: entity applies in jurisdiction

Respond ONLY with JSON:
{
  "entities": [{ "id": "unique_id", "nodeType": "...", "label": "...", "citation": "...", "confidence": 0.9 }],
  "relations": [{ "sourceId": "...", "targetId": "...", "edgeType": "..." }]
}

Use snake_case IDs. Max 12 entities and 15 relations.`;

    const userPrompt = `JURISDICTION: ${jurisdiction}

LEGAL TEXT:
${text.slice(0, 5000)}

Extract entities and relationships.`;

    try {
      const result = await this.llm!.complete({
        modelName: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        maxTokens: 2000,
      });

      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { entities: [], relations: [] };

      const parsed = JSON.parse(jsonMatch[0]) as {
        entities: Array<{
          id: string;
          nodeType: string;
          label: string;
          citation?: string;
          confidence?: number;
        }>;
        relations: Array<{
          sourceId: string;
          targetId: string;
          edgeType: string;
        }>;
      };

      const entities: ExtractedEntity[] = (parsed.entities ?? []).map((e) => ({
        canonicalId: `${jurisdiction.toLowerCase()}:${e.nodeType}:${e.id.replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`,
        nodeType: e.nodeType as ExtractedEntity['nodeType'],
        label: e.label,
        jurisdiction,
        confidence: e.confidence ?? 0.8,
        metadata: e.citation ? { citation: e.citation } : undefined,
      }));

      const entityIdMap = Object.fromEntries(
        (parsed.entities ?? []).map((e, idx) => [e.id, entities[idx]?.canonicalId ?? '']),
      );

      const relations: ExtractedRelation[] = (parsed.relations ?? [])
        .filter((r) => entityIdMap[r.sourceId] && entityIdMap[r.targetId])
        .map((r) => ({
          sourceCanonicalId: entityIdMap[r.sourceId],
          targetCanonicalId: entityIdMap[r.targetId],
          edgeType: r.edgeType,
        }));

      return { entities, relations };
    } catch (err) {
      this.logger.warn(`LLM entity extraction failed: ${String(err)}`);
      return { entities: [], relations: [] };
    }
  }

  /**
   * Batch process all unprocessed legal documents to build the KG.
   * Designed to be called from a cron or worker.
   */
  async batchIngestDocuments(limit = 20): Promise<{ processed: number; totalNodes: number; totalEdges: number }> {
    // Process active docs with raw text. KG node upsert is idempotent so
    // re-processing is safe; use checksum comparison to skip unchanged docs.
    const docs = await this.prisma.legalSearchDocument.findMany({
      where: {
        status: 'active',
        rawText: { not: null },
      },
      take: limit,
      orderBy: { authorityWeight: 'desc' },
    });

    // Skip docs already in the knowledge graph (check by citation/canonicalId)
    const existingNodes = await this.prisma.knowledgeGraphNode.findMany({
      where: { jurisdiction: { not: '' } },
      select: { canonicalId: true },
    }).catch(() => [] as { canonicalId: string }[]);
    const ingestedIds = new Set(existingNodes.map((n) => n.canonicalId));

    const pending = docs.filter((d) => !ingestedIds.has(d.canonicalId));

    let totalNodes = 0;
    let totalEdges = 0;

    for (const doc of pending) {
      const result = await this.ingestFromLegalDocument(doc.id);
      totalNodes += result.nodesCreated;
      totalEdges += result.edgesCreated;
    }

    this.logger.log(`Batch KG ingestion: ${pending.length} docs, ${totalNodes} nodes, ${totalEdges} edges`);
    return { processed: pending.length, totalNodes, totalEdges };
  }
}
