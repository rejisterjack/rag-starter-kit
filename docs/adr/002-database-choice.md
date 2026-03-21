# ADR 002: PostgreSQL + pgvector for Data Storage

## Status

**Accepted** - March 2024

## Context

We needed a database solution that supports:

- Relational data (users, workspaces, documents)
- Vector storage for embeddings (768+ dimensions)
- Full-text search for hybrid RAG
- ACID transactions
- Scalability

## Decision

We chose **PostgreSQL 16** with **pgvector** extension.

## Alternatives Considered

### 1. MongoDB + Atlas Vector Search

| Pros | Cons |
|------|------|
| Document model flexibility | No ACID transactions across documents |
| Built-in vector search | Less mature vector performance |
| Easy scaling | No native full-text search integration |

**Verdict**: Rejected - need strong consistency and hybrid search.

### 2. Pinecone (Dedicated Vector DB)

| Pros | Cons |
|------|------|
| Optimized for vectors | Separate system to maintain |
| Fast similarity search | No relational data support |
| Managed service | Additional cost |

**Verdict**: Rejected - would require two databases, adds complexity.

### 3. Supabase (PostgreSQL + pgvector)

| Pros | Cons |
|------|------|
| Managed PostgreSQL | Vendor lock-in concerns |
| Built-in auth | Less control |
| Real-time subscriptions | Self-hosting limitations |

**Verdict**: Rejected - we wanted full control over schema and auth.

### 4. ChromaDB

| Pros | Cons |
|------|------|
| Designed for LLM apps | No relational features |
| Easy embeddings | Not production-ready |
| In-memory option | Limited persistence options |

**Verdict**: Rejected - not suitable for production relational data.

### 5. Weaviate

| Pros | Cons |
|------|------|
| GraphQL interface | Learning curve |
| Vector + BM25 search | Additional infrastructure |
| Modular AI integrations | Smaller community |

**Verdict**: Rejected - overkill for our use case.

## Why PostgreSQL + pgvector

### 1. **Unified Data Store**

```sql
-- Relational and vector data in one query
SELECT 
  d.id,
  d.name,
  d.metadata,
  c.content,
  1 - (c.embedding <=> query_embedding) as similarity
FROM documents d
JOIN chunks c ON d.id = c.document_id
WHERE 1 - (c.embedding <=> query_embedding) > 0.7
ORDER BY similarity DESC
LIMIT 5;
```

### 2. **Hybrid Search (Vector + Full-Text)**

```sql
WITH vector_results AS (
  SELECT 
    chunk_id,
    1 - (embedding <=> query_embedding) as vector_score
  FROM chunks
  ORDER BY embedding <=> query_embedding
  LIMIT 20
),
keyword_results AS (
  SELECT 
    chunk_id,
    ts_rank(search_vector, query) as keyword_score
  FROM chunks
  WHERE search_vector @@ plainto_tsquery('english', query_text)
  ORDER BY keyword_score DESC
  LIMIT 20
)
SELECT 
  chunk_id,
  (COALESCE(v.vector_score, 0) * 0.7 + 
   COALESCE(k.keyword_score, 0) * 0.3) as hybrid_score
FROM vector_results v
FULL OUTER JOIN keyword_results k USING (chunk_id)
ORDER BY hybrid_score DESC;
```

### 3. **ACID Compliance**

```typescript
// Transaction safety across document + chunks
await prisma.$transaction([
  prisma.document.create({ data: documentData }),
  prisma.chunk.createMany({ data: chunks }),
  prisma.embedding.createMany({ data: embeddings }),
]);
```

### 4. **Scalability**

| Feature | Implementation |
|---------|----------------|
| Indexing | ivfflat and hnsw indexes |
| Partitioning | Native table partitioning |
| Sharding | Citus or manual sharding |
| Replication | Streaming replication |

### 5. **Prisma ORM Integration**

```typescript
// Type-safe database access
const similarChunks = await prisma.$queryRaw<Chunk[]>`
  SELECT id, content, 1 - (embedding <=> ${embedding}::vector) as similarity
  FROM chunks
  WHERE workspace_id = ${workspaceId}
  ORDER BY embedding <=> ${embedding}::vector
  LIMIT ${topK}
`;
```

## Schema Design

```prisma
// Key models
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Document {
  id        String   @id @default(cuid())
  name      String
  workspaceId String
  metadata  Json?
  chunks    Chunk[]
  createdAt DateTime @default(now())
  
  @@index([workspaceId])
}

model Chunk {
  id          String    @id @default(cuid())
  documentId  String
  content     String
  embedding   Unsupported("vector(768)")?
  searchVector Unsupported("tsvector")?
  
  @@index([documentId])
}
```

## Performance Characteristics

### Vector Search

| Dataset Size | Query Time | Index |
|--------------|------------|-------|
| 10K vectors | <10ms | ivfflat |
| 100K vectors | <50ms | ivfflat |
| 1M vectors | <100ms | hnsw |
| 10M vectors | <200ms | hnsw + partitioning |

### Index Types

```sql
-- ivfflat - faster build, less accurate
CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- hnsw - slower build, more accurate, faster query
CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

## Migration Strategy

### From Separate Vector DB

```typescript
// 1. Enable pgvector
await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;

// 2. Add embedding column
await prisma.$executeRaw`ALTER TABLE chunks ADD COLUMN embedding vector(768)`;

// 3. Migrate data from external DB
const embeddings = await pinecone.listVectors();
for (const batch of chunks(embeddings, 100)) {
  await prisma.$executeRaw`
    UPDATE chunks 
    SET embedding = ${batch.embedding}::vector
    WHERE id = ${batch.id}
  `;
}

// 4. Create index
await prisma.$executeRaw`
  CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops)
`;
```

## Consequences

### Positive

- **Single database**: No data synchronization needed
- **ACID transactions**: Data consistency guaranteed
- **Mature ecosystem**: Tools, backups, monitoring
- **SQL power**: Complex queries, aggregations
- **Cost**: Open source, no per-query costs

### Negative

- **Learning curve**: pgvector specifics
- **Maintenance**: Self-hosting responsibility
- **Scaling limits**: Vertical scaling first

## Related Decisions

- [ADR 001: Next.js Choice](./001-why-nextjs.md)
- [ADR 005: RAG Pipeline](./005-rag-pipeline.md)

## References

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Prisma + pgvector](https://www.prisma.io/docs/orm/prisma-schema/data-model/unsupported)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
