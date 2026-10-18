export interface SearchDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, unknown>;
}

export interface SearchGateway {
  index(indexName: string, documents: SearchDocument[]): Promise<void>;
  search(
    indexName: string,
    query: string,
    filters?: Record<string, unknown>,
    limit?: number,
  ): Promise<SearchResult[]>;
  delete(indexName: string, ids: string[]): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean }>;
}

export const SEARCH_GATEWAY = Symbol('SEARCH_GATEWAY');
