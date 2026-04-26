-- Migration: fix_embedding_dimensions
-- Changes document_chunks.embedding from vector(1536) to vector(768)
-- to match the default embedding provider (Google text-embedding-004)

-- Drop existing vector index
DROP INDEX IF EXISTS document_chunks_embedding_idx;

-- Alter the embedding column dimension
ALTER TABLE "document_chunks"
  ALTER COLUMN "embedding" TYPE vector(768);

-- Recreate the vector index with HNSW (better for smaller datasets)
CREATE INDEX "document_chunks_embedding_idx"
  ON "document_chunks"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
