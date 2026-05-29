-- Enable pgvector and add embedding column + HNSW index for hybrid RAG search
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "EmbeddingChunk"
ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

CREATE INDEX IF NOT EXISTS "EmbeddingChunk_embedding_hnsw_idx"
ON "EmbeddingChunk"
USING hnsw ("embedding" vector_cosine_ops);
