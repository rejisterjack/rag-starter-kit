-- ============================================================================
-- Vector Search SQL Templates
-- 
-- Raw SQL templates for complex vector operations that can't be expressed
-- easily through Prisma's query builder.
-- ============================================================================

-- ============================================================================
-- Cosine Similarity Search with Filters
-- ============================================================================

-- Basic cosine similarity search for a user's documents
-- Parameters: query_embedding (vector), user_id (text), top_k (int), min_score (float)
SELECT 
    dc.id as chunk_id,
    dc.content,
    dc.index as chunk_index,
    dc.page,
    dc.section,
    d.id as document_id,
    d.name as document_name,
    d.content_type as document_type,
    1 - (dc.embedding <=> $1::vector) as similarity_score
FROM document_chunks dc
JOIN documents d ON dc.document_id = d.id
WHERE d.user_id = $2
    AND d.status = 'COMPLETED'
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> $1::vector) > $4
ORDER BY dc.embedding <=> $1::vector
LIMIT $3;

-- ============================================================================
-- Hybrid Search (Vector + Full-Text)
-- ============================================================================

-- Combine vector similarity with text search for better results
-- Parameters: query_embedding, user_id, search_query, top_k, vector_weight, text_weight
WITH vector_scores AS (
    SELECT 
        dc.id,
        1 - (dc.embedding <=> $1::vector) as vector_score
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE d.user_id = $2
        AND d.status = 'COMPLETED'
        AND dc.embedding IS NOT NULL
),
text_scores AS (
    SELECT 
        dc.id,
        ts_rank_cd(
            to_tsvector('english', dc.content),
            plainto_tsquery('english', $3)
        ) as text_score
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE d.user_id = $2
        AND d.status = 'COMPLETED'
        AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', $3)
),
combined_scores AS (
    SELECT 
        COALESCE(v.id, t.id) as id,
        COALESCE(v.vector_score, 0) * $5 as weighted_vector_score,
        COALESCE(t.text_score, 0) * $6 as weighted_text_score,
        COALESCE(v.vector_score, 0) * $5 + COALESCE(t.text_score, 0) * $6 as combined_score
    FROM vector_scores v
    FULL OUTER JOIN text_scores t ON v.id = t.id
)
SELECT 
    dc.id as chunk_id,
    dc.content,
    dc.index as chunk_index,
    dc.page,
    dc.section,
    d.id as document_id,
    d.name as document_name,
    cs.weighted_vector_score,
    cs.weighted_text_score,
    cs.combined_score
FROM combined_scores cs
JOIN document_chunks dc ON cs.id = dc.id
JOIN documents d ON dc.document_id = d.id
WHERE cs.combined_score > 0.1
ORDER BY cs.combined_score DESC
LIMIT $4;

-- ============================================================================
-- Aggregations by Document
-- ============================================================================

-- Get top chunks per document (useful for grouping results)
-- Parameters: query_embedding, user_id, chunks_per_document, min_score
WITH ranked_chunks AS (
    SELECT 
        dc.id as chunk_id,
        dc.content,
        dc.index,
        dc.page,
        d.id as document_id,
        d.name as document_name,
        1 - (dc.embedding <=> $1::vector) as similarity,
        ROW_NUMBER() OVER (
            PARTITION BY d.id 
            ORDER BY dc.embedding <=> $1::vector
        ) as rank_in_document
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE d.user_id = $2
        AND d.status = 'COMPLETED'
        AND dc.embedding IS NOT NULL
        AND 1 - (dc.embedding <=> $1::vector) > $4
)
SELECT *
FROM ranked_chunks
WHERE rank_in_document <= $3
ORDER BY similarity DESC;

-- ============================================================================
-- Semantic Clustering
-- ============================================================================

-- Find similar chunks within a document (for deduplication)
-- Parameters: document_id, similarity_threshold
SELECT 
    a.id as chunk_a_id,
    b.id as chunk_b_id,
    a.index as chunk_a_index,
    b.index as chunk_b_index,
    1 - (a.embedding <=> b.embedding) as similarity
FROM document_chunks a
JOIN document_chunks b ON a.document_id = b.document_id AND a.id < b.id
WHERE a.document_id = $1
    AND a.embedding IS NOT NULL
    AND b.embedding IS NOT NULL
    AND 1 - (a.embedding <=> b.embedding) > $2
ORDER BY similarity DESC;

-- ============================================================================
-- Time-Decayed Search
-- ============================================================================

-- Search with recency boost (more recent documents rank higher)
-- Parameters: query_embedding, user_id, top_k, decay_factor
SELECT 
    dc.id as chunk_id,
    dc.content,
    dc.index,
    d.id as document_id,
    d.name as document_name,
    d.created_at,
    1 - (dc.embedding <=> $1::vector) as base_similarity,
    (1 - (dc.embedding <=> $1::vector)) * 
        EXP(-$4 * EXTRACT(EPOCH FROM (NOW() - d.created_at)) / 86400) as time_weighted_score
FROM document_chunks dc
JOIN documents d ON dc.document_id = d.id
WHERE d.user_id = $2
    AND d.status = 'COMPLETED'
    AND dc.embedding IS NOT NULL
ORDER BY time_weighted_score DESC
LIMIT $3;

-- ============================================================================
-- Multi-Query Fusion
-- ============================================================================

-- Combine results from multiple query embeddings (e.g., query expansion)
-- Parameters: query_embeddings (array of vectors), user_id, top_k
WITH query_scores AS (
    SELECT 
        dc.id,
        dc.document_id,
        MAX(1 - (dc.embedding <=> q.embedding)) as max_similarity,
        AVG(1 - (dc.embedding <=> q.embedding)) as avg_similarity
    FROM document_chunks dc
    CROSS JOIN UNNEST($1::vector[]) as q(embedding)
    JOIN documents d ON dc.document_id = d.id
    WHERE d.user_id = $2
        AND d.status = 'COMPLETED'
        AND dc.embedding IS NOT NULL
    GROUP BY dc.id, dc.document_id
)
SELECT 
    dc.id as chunk_id,
    dc.content,
    dc.index,
    d.id as document_id,
    d.name as document_name,
    qs.max_similarity,
    qs.avg_similarity,
    (qs.max_similarity + qs.avg_similarity) / 2 as fused_score
FROM query_scores qs
JOIN document_chunks dc ON qs.id = dc.id
JOIN documents d ON qs.document_id = d.id
ORDER BY fused_score DESC
LIMIT $3;

-- ============================================================================
-- Vector Statistics Queries
-- ============================================================================

-- Get vector distribution statistics
-- Parameters: user_id
SELECT 
    d.id as document_id,
    d.name as document_name,
    COUNT(dc.id) as total_chunks,
    COUNT(dc.embedding) as chunks_with_embeddings,
    AVG(embedding_norm(dc.embedding)) as avg_vector_norm,
    STDDEV(embedding_norm(dc.embedding)) as stddev_vector_norm
FROM documents d
LEFT JOIN document_chunks dc ON d.id = dc.document_id
WHERE d.user_id = $1
GROUP BY d.id, d.name;

-- Find documents with missing embeddings
-- Parameters: user_id
SELECT 
    d.id as document_id,
    d.name as document_name,
    d.status,
    COUNT(dc.id) as total_chunks,
    COUNT(CASE WHEN dc.embedding IS NULL THEN 1 END) as missing_embeddings
FROM documents d
LEFT JOIN document_chunks dc ON d.id = dc.document_id
WHERE d.user_id = $1
GROUP BY d.id, d.name, d.status
HAVING COUNT(CASE WHEN dc.embedding IS NULL THEN 1 END) > 0;

-- ============================================================================
-- Index Optimization Queries
-- ============================================================================

-- Get index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_stat_user_indexes
WHERE indexname LIKE '%hnsw%' OR indexname LIKE '%ivfflat%'
ORDER BY idx_scan DESC;

-- Check for duplicate or redundant indexes
SELECT 
    t.tablename,
    array_agg(i.indexname) as indexes
FROM pg_indexes t
JOIN pg_indexes i ON t.tablename = i.tablename
WHERE i.indexname LIKE '%hnsw%' OR i.indexname LIKE '%ivfflat%'
GROUP BY t.tablename
HAVING COUNT(*) > 1;

-- ============================================================================
-- Maintenance Queries
-- ============================================================================

-- Find and remove exact duplicate embeddings
-- (Use with caution - verify results first!)
WITH duplicates AS (
    SELECT 
        document_id,
        embedding,
        array_agg(id ORDER BY created_at DESC) as ids,
        COUNT(*) as count
    FROM document_chunks
    WHERE embedding IS NOT NULL
    GROUP BY document_id, embedding
    HAVING COUNT(*) > 1
)
-- SELECT query to preview duplicates
SELECT 
    document_id,
    count as duplicate_count,
    ids as duplicate_ids,
    ids[1] as keep_id,
    ids[2:] as remove_ids
FROM duplicates;

-- Delete old chunks (for data retention policies)
-- Parameters: user_id, older_than_date
DELETE FROM document_chunks
WHERE id IN (
    SELECT dc.id
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE d.user_id = $1
        AND dc.created_at < $2
);

-- Vacuum and analyze (run periodically for performance)
VACUUM ANALYZE document_chunks;

-- ============================================================================
-- Advanced Filtering Queries
-- ============================================================================

-- Search within specific page range
-- Parameters: query_embedding, user_id, document_id, min_page, max_page, top_k
SELECT 
    dc.id as chunk_id,
    dc.content,
    dc.page,
    d.name as document_name,
    1 - (dc.embedding <=> $1::vector) as similarity
FROM document_chunks dc
JOIN documents d ON dc.document_id = d.id
WHERE d.user_id = $2
    AND d.id = $3
    AND dc.page BETWEEN $4 AND $5
    AND dc.embedding IS NOT NULL
ORDER BY dc.embedding <=> $1::vector
LIMIT $6;

-- Search with section filtering
-- Parameters: query_embedding, user_id, section_prefix, top_k
SELECT 
    dc.id as chunk_id,
    dc.content,
    dc.section,
    d.name as document_name,
    1 - (dc.embedding <=> $1::vector) as similarity
FROM document_chunks dc
JOIN documents d ON dc.document_id = d.id
WHERE d.user_id = $2
    AND dc.section LIKE $3 || '%'
    AND dc.embedding IS NOT NULL
ORDER BY dc.embedding <=> $1::vector
LIMIT $4;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Create helper function for embedding norm (if not exists)
CREATE OR REPLACE FUNCTION embedding_norm(v vector)
RETURNS float AS $$
BEGIN
    RETURN sqrt(v <#> v);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function for batch similarity computation
CREATE OR REPLACE FUNCTION batch_similarity(
    query_embedding vector,
    chunk_ids uuid[]
)
RETURNS TABLE(chunk_id uuid, similarity float) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dc.id,
        1 - (dc.embedding <=> query_embedding) as similarity
    FROM document_chunks dc
    WHERE dc.id = ANY(chunk_ids)
        AND dc.embedding IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE;
