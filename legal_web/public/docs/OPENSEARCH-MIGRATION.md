# OpenSearch Migration Path (Prompt 48)

**Current:** PostgreSQL + pgvector for hybrid legal/firm search.  
**Target:** OpenSearch for high-scale full-text + vector at Series B scale.

## Phase 1 — Dual-write (implemented, env-gated)
- Set `ENABLE_OPENSEARCH=true`, `OPENSEARCH_URL`, and optional auth vars in production when ready
- BullMQ `search.index` worker indexes matters/clients/documents/tasks on create/update (matters wired; extend hooks as needed)
- `SearchService.unifiedSearch()` reads OpenSearch when enabled, falls back to Prisma ILIKE
- Legal authority corpus indexing unchanged in `OpenSearchAdapterService`

## Phase 2 — Cutover
- Reindex job from PostgreSQL embeddings table
- Feature flag `SEARCH_PROVIDER=opensearch` per tenant
- Monitor latency vs pgvector in Grafana

## Phase 3 — Decommission pgvector for full-text
- Keep pgvector for small tenants / dev
- OpenSearch primary for tenants >10k documents

**Env vars:** `OPENSEARCH_URL`, `OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD`, `OPENSEARCH_INDEX_PREFIX`
