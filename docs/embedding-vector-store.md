# Embedding & Vector Store Layer

This document describes the Embedding & Vector Store layer for the RAG chatbot.

## Overview

The Embedding & Vector Store layer provides:

- **Multiple Embedding Providers**: OpenAI and Ollama support
- **Vector Storage**: pgvector-based storage with efficient similarity search
- **Index Management**: HNSW and IVFFlat indexes for fast approximate search
- **Caching**: Redis-based embedding and semantic query caching
- **Batch Operations**: Efficient bulk insert and update operations

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Embedding Providers                         │
├─────────────────────┬───────────────────────────────────────────┤
│  OpenAI Embeddings  │  Ollama Embeddings                        │
│  - text-embed-3-sm  │  - nomic-embed-text                       │
│  - text-embed-3-lg  │  - mxbai-embed-large                      │
│  - Rate limiting    │  - Local, privacy-focused                 │
│  - Retry logic      │  - Cost-effective                         │
└─────────┬───────────┴───────────────────────┬───────────────────┘
          │                                   │
          └───────────────┬───────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    Vector Store (pgvector)                      │
├─────────────────────────────────────────────────────────────────┤
│  - Similarity search (cosine, euclidean, inner product)         │
│  - Metadata filtering (document IDs, types, date range)         │
│  - User isolation                                               │
│  - Batch operations                                             │
└────────────┬────────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────────┐
│                    Index Management                             │
├─────────────────────────────────────────────────────────────────┤
│  HNSW Index                              │  IVFFlat Index       │
│  - Fast approximate search               │  - Alternative index │
│  - Configurable M, ef_construction       │  - Good for large    │
│  - Recommended for most use cases        │    datasets          │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Creating an Embedding Provider

```typescript
import { createEmbeddingProviderFromEnv } from '@/lib/ai/embeddings';

// Uses environment variables:
// - EMBEDDING_PROVIDER: 'openai' or 'ollama'
// - EMBEDDING_MODEL: model name
// - OPENAI_API_KEY: for OpenAI
// - OLLAMA_BASE_URL: for Ollama (optional)
const provider = createEmbeddingProviderFromEnv();

// Generate embeddings
const embedding = await provider.embedQuery('Your text here');
const embeddings = await provider.embedDocuments(['Text 1', 'Text 2']);
```

### Using the Vector Store

```typescript
import { prisma, createVectorStore } from '@/lib/db';

const vectorStore = createVectorStore(prisma);

// Add vectors
await vectorStore.addVectors(
  [
    {
      content: 'Chunk content',
      embedding: [0.1, 0.2, ...],
      metadata: { documentId: 'doc-1', index: 0 },
    },
  ],
  'document-id',
  'user-id'
);

// Search
const results = await vectorStore.similaritySearch(
  'query',
  queryEmbedding,
  {
    userId: 'user-id',
    topK: 5,
    minScore: 0.7,
    filter: {
      documentIds: ['doc-1', 'doc-2'],
    },
  }
);
```

### Batch Operations

```typescript
import { batchInsertChunks, validateChunks } from '@/lib/db';

const chunks = [
  { documentId: 'doc-1', content: '...', embedding: [...], index: 0 },
  // ... more chunks
];

// Validate first
const { valid, invalid } = validateChunks(chunks);

// Insert in batches
const result = await batchInsertChunks(prisma, valid, {
  batchSize: 100,
  continueOnError: true,
  onProgress: (completed, total) => {
    console.log(`${completed}/${total} chunks inserted`);
  },
});
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EMBEDDING_PROVIDER` | Provider type: `openai` or `ollama` | `openai` |
| `EMBEDDING_MODEL` | Model name | `text-embedding-3-small` |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |

### Supported Models

#### OpenAI

| Model | Dimensions | Best For |
|-------|------------|----------|
| `text-embedding-3-small` | 1536 | Speed, cost-efficiency |
| `text-embedding-3-large` | 3072 | Best quality |
| `text-embedding-ada-002` | 1536 | Legacy compatibility |

#### Ollama

| Model | Dimensions | Best For |
|-------|------------|----------|
| `nomic-embed-text` | 768 | Open, high-quality |
| `mxbai-embed-large` | 1024 | Best open model |
| `all-minilm` | 384 | Speed, low resource |

## Index Management

### Creating HNSW Index

```typescript
import { createHNSWIndex } from '@/lib/db';

await createHNSWIndex(prisma, {
  tableName: 'document_chunks',
  columnName: 'embedding',
  dimensions: 1536,
  m: 16,                    // Max connections per layer
  efConstruction: 64,       // Build-time search factor
  distanceMetric: 'cosine', // or 'l2', 'ip'
});
```

### Tuning Search Parameters

```typescript
import { setHNSWEfSearch } from '@/lib/db';

// Higher ef = more accurate but slower
await setHNSWEfSearch(prisma, 100);
```

### Analyzing Index Performance

```typescript
import { analyzeVectorIndex, listVectorIndexes } from '@/lib/db';

// Get all vector indexes
const indexes = await listVectorIndexes(prisma);

// Analyze specific index
const stats = await analyzeVectorIndex(prisma, 'document_chunks');
```

## Caching

### Embedding Cache

```typescript
import { createEmbeddingCache, MemoryCacheProvider } from '@/lib/db';

// Use memory cache (for development/testing)
const cache = createEmbeddingCache(new MemoryCacheProvider(), {
  defaultTtl: 86400, // 24 hours
});

// Or use Redis in production
const cache = createEmbeddingCache(redisProvider);

// Use with provider
import { createCachedProvider } from '@/lib/ai/embeddings';

const cachedProvider = createCachedProvider(provider, cache);
```

### Semantic Query Cache

```typescript
import { createSemanticCache } from '@/lib/db';

const semanticCache = createSemanticCache(cacheProvider, {
  similarityThreshold: 0.95, // Cache queries with 95% similarity
});

// Find similar cached query
const cached = await semanticCache.findSimilar(query, queryEmbedding);

// Store result
await semanticCache.set(query, queryEmbedding, results);
```

## Advanced Usage

### Hybrid Search (Vector + Full-Text)

```typescript
import { hybridSearch } from '@/lib/rag/retrieval';

const results = await hybridSearch(
  query,
  queryEmbedding,
  userId,
  {
    topK: 5,
    similarityThreshold: 0.7,
  }
);
```

### Retrying with Fallback

```typescript
import { createProviderWithFallback } from '@/lib/ai/embeddings';

const provider = await createProviderWithFallback(
  { provider: 'openai', model: 'text-embedding-3-small', dimensions: 1536 },
  { provider: 'ollama', model: 'nomic-embed-text', dimensions: 768 }
);
```

## Performance Tips

1. **Use HNSW Index**: Recommended for most use cases with `m=16`, `ef_construction=64`

2. **Batch Insertions**: Use `batchInsertChunks` with batch size of 50-100

3. **Enable Caching**: Cache embeddings and query results to reduce API costs

4. **Tune Search Parameters**:
   - `ef_search`: 40-100 for HNSW (higher = more accurate)
   - `probes`: 10-50 for IVFFlat (higher = more accurate)

5. **Regular Maintenance**:
   - Run `ANALYZE` after bulk inserts
   - Monitor index usage with `listVectorIndexes`
   - Remove orphaned vectors periodically

## Troubleshooting

### Common Issues

**Issue**: High latency on search  
**Solution**: 
- Ensure HNSW index is created
- Tune `ef_search` parameter
- Check database connection pooling

**Issue**: Embedding generation fails  
**Solution**:
- Check API key and rate limits
- Enable retry logic with exponential backoff
- Consider using Ollama as fallback

**Issue**: Out of memory during bulk insert  
**Solution**:
- Reduce `batchSize` in `batchInsertChunks`
- Add `batchDelayMs` between batches
- Process documents sequentially

## API Reference

See the source code for detailed API documentation:

- `src/lib/ai/embeddings/` - Embedding providers
- `src/lib/db/vector-store.ts` - Vector store operations
- `src/lib/db/vector-operations.ts` - Index management
- `src/lib/db/vector-cache.ts` - Caching layer
- `src/lib/db/batch-operations.ts` - Batch operations
- `src/lib/db/sql/vector-search.sql` - Raw SQL templates
