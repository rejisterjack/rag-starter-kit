-- ============================================
-- Vector Search Setup for RAG Starter Kit
-- ============================================
-- Run this after initial migration to set up vector indexes

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verify extensions are installed
SELECT 
    extname,
    extversion,
    extnamespace::regnamespace as schema
FROM pg_extension 
WHERE extname IN ('vector', 'pg_trgm');

-- ============================================
-- HNSW Index for Fast Vector Search
-- ============================================
-- Best for: Datasets < 1M vectors
-- Pros: Fastest query times, incremental builds
-- Cons: Higher memory usage, slower builds

DROP INDEX IF EXISTS idx_document_chunk_embedding_hnsw;

CREATE INDEX idx_document_chunk_embedding_hnsw 
ON "document_chunks" 
USING hnsw (embedding vector_cosine_ops) 
WITH (
    m = 16,              -- Number of bi-directional links per element (2-100)
    ef_construction = 64 -- Size of dynamic candidate list (4-1000)
);

-- Alternative: IVFFlat Index
-- ============================================
-- Best for: Large datasets > 1M vectors
-- Pros: Lower memory usage, faster builds
-- Cons: Requires training, slower queries

-- DROP INDEX IF EXISTS idx_document_chunk_embedding_ivf;
-- 
-- CREATE INDEX idx_document_chunk_embedding_ivf 
-- ON "document_chunks" 
-- USING ivfflat (embedding vector_cosine_ops) 
-- WITH (lists = 100);  -- Number of clusters (sqrt of row count is good starting point)

-- ============================================
-- Additional Performance Indexes
-- ============================================

-- Composite index for workspace + status queries
CREATE INDEX IF NOT EXISTS idx_documents_workspace_status 
ON "documents" (workspace_id, status) 
WHERE status IN ('PROCESSING', 'FAILED');

-- Full-text search index on document chunks (using trigram)
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_trgm 
ON "document_chunks" 
USING gin (content gin_trgm_ops);

-- Index for conversation ordering
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_last_message 
ON "conversations" (workspace_id, last_message_at DESC NULLS LAST);

-- ============================================
-- Query Examples
-- ============================================

-- Example 1: Vector similarity search (top 5 most similar chunks)
-- Replace '[...]' with your actual embedding array
/*
SELECT 
    c.id,
    c.content,
    c.metadata,
    d.name as document_name,
    1 - (c.embedding <=> '[0.1, 0.2, ...]'::vector) as similarity
FROM "document_chunks" c
JOIN "documents" d ON c.document_id = d.id
WHERE c.workspace_id = 'your-workspace-id'
ORDER BY c.embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
*/

-- Example 2: Hybrid search (vector + text)
/*
WITH vector_results AS (
    SELECT 
        c.id,
        c.content,
        c.document_id,
        1 - (c.embedding <=> '[...]'::vector) as vector_score
    FROM "document_chunks" c
    WHERE c.workspace_id = 'your-workspace-id'
    ORDER BY c.embedding <=> '[...]'::vector
    LIMIT 20
),
text_results AS (
    SELECT 
        c.id,
        c.content,
        c.document_id,
        similarity(c.content, 'your search query') as text_score
    FROM "document_chunks" c
    WHERE c.workspace_id = 'your-workspace-id'
        AND c.content % 'your search query'
    ORDER BY text_score DESC
    LIMIT 20
)
SELECT 
    COALESCE(v.id, t.id) as id,
    COALESCE(v.content, t.content) as content,
    COALESCE(v.vector_score, 0) * 0.7 + 
    COALESCE(t.text_score, 0) * 0.3 as combined_score
FROM vector_results v
FULL OUTER JOIN text_results t ON v.id = t.id
ORDER BY combined_score DESC
LIMIT 5;
*/

-- ============================================
-- Maintenance
-- ============================================

-- Check index sizes
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE tablename = 'document_chunks'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Analyze tables for better query planning
ANALYZE "document_chunks";
ANALYZE "documents";
ANALYZE "conversations";
