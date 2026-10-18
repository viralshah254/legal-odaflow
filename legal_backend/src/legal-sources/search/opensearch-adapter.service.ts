import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HybridSearchResult } from './hybrid-search.service';

/**
 * OpenSearch adapter for legal authority search.
 * When ENABLE_OPENSEARCH=true, this service connects to an OpenSearch cluster
 * and provides BM25 + kNN hybrid search over ingested legal authorities.
 *
 * Falls back gracefully to empty results when OpenSearch is not configured.
 */
@Injectable()
export class OpenSearchAdapterService {
  private readonly logger = new Logger(OpenSearchAdapterService.name);
  private readonly enabled: boolean;
  private readonly host: string | undefined;
  private readonly indexName = 'legal-authorities';
  private readonly firmIndexName = 'firm-entities';

  constructor(private readonly configService: ConfigService) {
    const explicit = configService.get<string>('ENABLE_OPENSEARCH');
    const host = configService.get<string>('OPENSEARCH_URL');
    this.host = host;
    this.enabled =
      explicit === 'true' || (explicit !== 'false' && Boolean(host?.trim()));
  }

  get isEnabled(): boolean {
    return this.enabled && Boolean(this.host);
  }

  /**
   * Index a legal authority document into OpenSearch.
   */
  async indexAuthority(doc: {
    id: string;
    title: string;
    citation: string | null;
    fullText: string | null;
    summary: string | null;
    holding: string | null;
    sourceName: string;
    countryCode: string;
    jurisdiction: string | null;
    authorityType: string;
    practiceAreas: string[];
    sourceUrl: string | null;
    embeddingVector?: number[];
  }): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const body = JSON.stringify({
        id: doc.id,
        title: doc.title,
        citation: doc.citation,
        text: [doc.fullText, doc.summary, doc.holding].filter(Boolean).join('\n'),
        summary: doc.summary,
        holding: doc.holding,
        source_name: doc.sourceName,
        country_code: doc.countryCode,
        jurisdiction: doc.jurisdiction,
        authority_type: doc.authorityType,
        practice_areas: doc.practiceAreas,
        source_url: doc.sourceUrl,
        ...(doc.embeddingVector ? { embedding: doc.embeddingVector } : {}),
      });

      const url = `${this.host}/${this.indexName}/_doc/${doc.id}`;
      const resp = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!resp.ok) {
        this.logger.warn(`OpenSearch index failed for ${doc.id}: ${resp.status}`);
      }
    } catch (e) {
      this.logger.error(`OpenSearch indexAuthority error: ${e}`);
    }
  }

  /**
   * BM25 keyword search over the legal-authorities index.
   */
  async search(params: {
    query: string;
    countryCode: string;
    practiceArea?: string;
    practiceAreas?: string[];
    jurisdiction?: string;
    authorityType?: string;
    limit?: number;
  }): Promise<HybridSearchResult[]> {
    if (!this.isEnabled) return [];

    const limit = params.limit ?? 10;
    const mustFilters: unknown[] = [
      { term: { country_code: params.countryCode.toUpperCase() } },
    ];
    if (params.jurisdiction) {
      mustFilters.push({ term: { jurisdiction: params.jurisdiction } });
    }
    if (params.practiceAreas?.length) {
      mustFilters.push({ terms: { practice_areas: params.practiceAreas } });
    } else if (params.practiceArea) {
      mustFilters.push({ term: { practice_areas: params.practiceArea } });
    }
    if (params.authorityType) {
      mustFilters.push({ term: { authority_type: params.authorityType } });
    }

    const osQuery = {
      size: limit,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: params.query,
                fields: ['title^3', 'citation^2', 'text', 'holding', 'summary'],
                type: 'best_fields',
              },
            },
          ],
          filter: mustFilters,
        },
      },
    };

    try {
      const url = `${this.host}/${this.indexName}/_search`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(osQuery),
      });

      if (!resp.ok) {
        this.logger.warn(`OpenSearch search failed: ${resp.status}`);
        return [];
      }

      const data = (await resp.json()) as {
        hits: {
          hits: Array<{
            _id: string;
            _score: number;
            _source: {
              title: string;
              citation: string | null;
              source_name: string;
              summary: string | null;
              source_url: string | null;
              holding: string | null;
              country_code: string;
              jurisdiction: string | null;
              authority_type: string;
            };
          }>;
        };
      };

      return (data.hits?.hits ?? []).map((hit) => ({
        id: hit._id,
        title: hit._source.title,
        citation: hit._source.citation,
        sourceName: hit._source.source_name,
        summary: hit._source.summary,
        sourceUrl: hit._source.source_url,
        holding: hit._source.holding,
        countryCode: hit._source.country_code,
        jurisdiction: hit._source.jurisdiction,
        authorityType: hit._source.authority_type,
        score: hit._score,
      }));
    } catch (e) {
      this.logger.error(`OpenSearch search error: ${e}`);
      return [];
    }
  }

  /**
   * Ensure the legal-authorities index exists with correct mappings.
   * Call once at bootstrap when OpenSearch is enabled.
   */
  async ensureIndex(): Promise<void> {
    if (!this.isEnabled) return;

    const url = `${this.host}/${this.indexName}`;
    try {
      const check = await fetch(url, { method: 'HEAD' });
      if (check.ok) return; // already exists

      const mappings = {
        settings: { number_of_shards: 1, number_of_replicas: 0 },
        mappings: {
          properties: {
            title: { type: 'text', analyzer: 'english' },
            citation: { type: 'keyword' },
            text: { type: 'text', analyzer: 'english' },
            summary: { type: 'text', analyzer: 'english' },
            holding: { type: 'text', analyzer: 'english' },
            source_name: { type: 'keyword' },
            country_code: { type: 'keyword' },
            jurisdiction: { type: 'keyword' },
            authority_type: { type: 'keyword' },
            practice_areas: { type: 'keyword' },
            source_url: { type: 'keyword', index: false },
            embedding: {
              type: 'knn_vector',
              dimension: 1536,
              method: { name: 'hnsw', space_type: 'innerproduct', engine: 'faiss' },
            },
          },
        },
      };

      const create = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappings),
      });

      if (create.ok) {
        this.logger.log(`OpenSearch index "${this.indexName}" created.`);
      } else {
        this.logger.warn(`OpenSearch index creation failed: ${create.status}`);
      }
    } catch (e) {
      this.logger.error(`OpenSearch ensureIndex error: ${e}`);
    }
  }

  async indexFirmEntity(doc: {
    id: string;
    tenantId: string;
    entityType: 'matter' | 'client' | 'document' | 'task';
    title: string;
    subtitle?: string | null;
    body?: string | null;
    matterId?: string | null;
    clientId?: string | null;
  }): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const body = JSON.stringify({
        tenant_id: doc.tenantId,
        entity_type: doc.entityType,
        title: doc.title,
        subtitle: doc.subtitle ?? '',
        body: doc.body ?? '',
        matter_id: doc.matterId,
        client_id: doc.clientId,
      });

      const url = `${this.host}/${this.firmIndexName}/_doc/${doc.entityType}-${doc.id}`;
      const resp = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!resp.ok) {
        this.logger.warn(`OpenSearch firm index failed for ${doc.id}: ${resp.status}`);
      }
    } catch (e) {
      this.logger.error(`OpenSearch indexFirmEntity error: ${e}`);
    }
  }

  async deleteFirmEntity(
    entityType: string,
    entityId: string,
  ): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const url = `${this.host}/${this.firmIndexName}/_doc/${entityType}-${entityId}`;
      await fetch(url, { method: 'DELETE' });
    } catch (e) {
      this.logger.error(`OpenSearch deleteFirmEntity error: ${e}`);
    }
  }

  async searchFirmEntities(params: {
    tenantId: string;
    query: string;
    limit?: number;
  }): Promise<{
    matters: Array<{ id: string; title: string; caseNumber: string | null; status: string }>;
    clients: Array<{ id: string; name: string; email: string | null; clientCode: string }>;
    documents: Array<{
      id: string;
      fileName: string;
      matterId: string | null;
      clientId: string | null;
      clientName: string | null;
      clientCode: string | null;
    }>;
    tasks: Array<{ id: string; title: string; status: string; matterId: string | null }>;
  }> {
    const empty = {
      matters: [],
      clients: [],
      documents: [],
      tasks: [],
    };
    if (!this.isEnabled) return empty;

    const limit = params.limit ?? 8;
    const osQuery = {
      size: limit * 4,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: params.query,
                fields: ['title^3', 'subtitle^2', 'body'],
                type: 'best_fields',
              },
            },
          ],
          filter: [{ term: { tenant_id: params.tenantId } }],
        },
      },
    };

    try {
      const url = `${this.host}/${this.firmIndexName}/_search`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(osQuery),
      });

      if (!resp.ok) {
        this.logger.warn(`OpenSearch firm search failed: ${resp.status}`);
        return empty;
      }

      const data = (await resp.json()) as {
        hits: {
          hits: Array<{
            _source: {
              entity_type: string;
              title: string;
              subtitle?: string;
              matter_id?: string | null;
              client_id?: string | null;
            };
            _id: string;
          }>;
        };
      };

      const matters: Array<{
        id: string;
        title: string;
        caseNumber: string | null;
        status: string;
      }> = [];
      const clients: Array<{
        id: string;
        name: string;
        email: string | null;
        clientCode: string;
      }> = [];
      const documents: Array<{
        id: string;
        fileName: string;
        matterId: string | null;
        clientId: string | null;
        clientName: string | null;
        clientCode: string | null;
      }> = [];
      const tasks: Array<{
        id: string;
        title: string;
        status: string;
        matterId: string | null;
      }> = [];

      for (const hit of data.hits?.hits ?? []) {
        const id = hit._id.replace(/^[^-]+-/, '');
        const type = hit._source.entity_type;
        if (type === 'matter' && matters.length < limit) {
          matters.push({
            id,
            title: hit._source.title,
            caseNumber: hit._source.subtitle ?? null,
            status: 'OPEN',
          });
        } else if (type === 'client' && clients.length < limit) {
          clients.push({
            id,
            name: hit._source.title,
            email: null,
            clientCode: hit._source.subtitle ?? '',
          });
        } else if (type === 'document' && documents.length < limit) {
          documents.push({
            id,
            fileName: hit._source.title,
            matterId: hit._source.matter_id ?? null,
            clientId: hit._source.client_id ?? null,
            clientName: null,
            clientCode: null,
          });
        } else if (type === 'task' && tasks.length < limit) {
          tasks.push({
            id,
            title: hit._source.title,
            status: hit._source.subtitle ?? 'TODO',
            matterId: hit._source.matter_id ?? null,
          });
        }
      }

      return { matters, clients, documents, tasks };
    } catch (e) {
      this.logger.error(`OpenSearch firm search error: ${e}`);
      return empty;
    }
  }

  async ensureFirmIndex(): Promise<void> {
    if (!this.isEnabled) return;

    const url = `${this.host}/${this.firmIndexName}`;
    try {
      const check = await fetch(url, { method: 'HEAD' });
      if (check.ok) return;

      const mappings = {
        settings: { number_of_shards: 1, number_of_replicas: 0 },
        mappings: {
          properties: {
            tenant_id: { type: 'keyword' },
            entity_type: { type: 'keyword' },
            title: { type: 'text', analyzer: 'english' },
            subtitle: { type: 'text' },
            body: { type: 'text', analyzer: 'english' },
            matter_id: { type: 'keyword' },
            client_id: { type: 'keyword' },
          },
        },
      };

      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappings),
      });
    } catch (e) {
      this.logger.error(`OpenSearch ensureFirmIndex error: ${e}`);
    }
  }
}
