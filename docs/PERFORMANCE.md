# Performance Optimization Guide

## Overview

This document outlines performance optimizations implemented in the RAG Starter Kit.

## Implemented Optimizations

### 1. Message List Virtualization

For long conversations with thousands of messages, we use `@tanstack/react-virtual`:

```tsx
import { VirtualizedMessageList } from '@/components/chat/virtualized-message-list';

<VirtualizedMessageList
  messages={messages}
  renderMessage={(message, index) => <MessageItem message={message} />}
/>
```

**Benefits:**
- Only renders visible messages
- O(1) performance regardless of list size
- Smooth scrolling with overscan

### 2. React.memo for Components

Expensive components use `React.memo` to prevent unnecessary re-renders:

```tsx
export const MessageItem = memo(function MessageItem({ message }) {
  // Component logic
});
```

### 3. Cursor-Based Pagination

Database queries use cursor pagination instead of offset:

```typescript
const { items, nextCursor } = await fetchWithCursor({
  limit: 20,
  cursor: lastCursor,
});
```

**Benefits:**
- O(1) performance at any page depth
- Stable results during concurrent writes
- Better for real-time data

### 4. State Persistence

User preferences persisted to localStorage:

```typescript
const { preferences, setPreferences } = useChatPreferences();
```

### 5. Query Optimization

- Prisma query batching
- Connection pooling with pgBouncer
- Redis caching for frequent queries
- Vector search with HNSW index

## Performance Monitoring

Web Vitals tracking is initialized in the app:

```typescript
import { initPerformanceMonitoring } from '@/lib/performance/monitoring';

// In app initialization
initPerformanceMonitoring();
```

Metrics tracked:
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- FCP (First Contentful Paint)
- CLS (Cumulative Layout Shift)
- TTFB (Time to First Byte)

## Bundle Optimization

### Code Splitting

- Dynamic imports for heavy components
- Route-based code splitting
- Lazy loading for modals and dialogs

### Tree Shaking

- ES modules throughout
- Barrel exports for clean imports
- Dead code elimination

## Database Optimization

### API Performance Baselines

| Endpoint | p50 | p95 | p99 | Notes |
|----------|-----|-----|-----|-------|
| `GET /api/health` | <50ms | <100ms | <200ms | No DB access |
| `GET /api/documents` | <100ms | <500ms | <1000ms | Paginated, indexed |
| `POST /api/chat` | <1s | <3s | <5s | Includes LLM streaming |
| Vector similarity search | <100ms | <300ms | <500ms | HNSW index, top-10 |
| Document ingestion | - | <10s/doc | - | Chunking + embedding |

### Vector Search Tuning (HNSW)

The project uses HNSW indexes for vector similarity search via pgvector.

**Build-time** (migration):
- `hnsw.ef_construction = 128` -- Higher = better index quality, slower build
- `hnsw.m = 16` (default) -- Connections per node

**Query-time** (runtime via env var):
- `HNSW_EF_SEARCH` -- Controls search accuracy vs speed
  - Default: `40` (good balance)
  - `1-20`: Fast, lower recall (real-time suggestions)
  - `40-100`: Balanced (default)
  - `100-500`: High recall, slower (precision-critical)
  - `500+`: Near-exact search, significantly slower

### Connection Pooling

Pool size is environment-aware:
- **Serverless** (Vercel/Lambda): 5 connections
- **Production** (Long-running server / VM): 15 connections
- **Development**: 3 connections

Override with `DB_POOL_MAX` env var. Use `DATABASE_READ_REPLICA_URL` for read replicas.

### Indexes

```sql
-- HNSW vector similarity search (used in production)
CREATE INDEX document_chunks_embedding_hnsw_idx
  ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- Common queries
CREATE INDEX idx_conversations_workspace ON conversations(workspace_id, created_at DESC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at ASC);
```

### Query Patterns

- Use `select` to limit fields
- Batch inserts with `createMany`
- Use transactions for related operations
- Implement connection pooling

## Caching Strategy

### Redis Caching

- Session data
- Rate limit counters
- API response caching
- Computed metrics

### CDN Caching

- Static assets: 1 year
- API responses: Varies by endpoint
- Images and documents: 24 hours

## Recommended Performance Budget

| Metric | Target | Maximum |
|--------|--------|---------|
| First Contentful Paint | < 1.8s | 3.0s |
| Largest Contentful Paint | < 2.5s | 4.0s |
| Time to Interactive | < 3.8s | 7.3s |
| Cumulative Layout Shift | < 0.1 | 0.25 |
| First Input Delay | < 100ms | 300ms |
| Bundle Size (gzipped) | < 200KB | 500KB |

## Monitoring Tools

- Lighthouse CI for automated audits
- Web Vitals monitoring
- Custom performance metrics

### Running Benchmarks

```bash
# Database performance tests
bun vitest run tests/performance/database.test.ts

# Load tests (k6)
k6 run tests/performance/load.test.ts

# Load tests (Artillery)
artillery run tests/performance/artillery-config.yml
```

## Profiling

Use React DevTools Profiler to identify:
- Unnecessary re-renders
- Expensive component mounts
- Slow state updates

## Best Practices

1. **Use virtualized lists** for >100 items
2. **Memoize expensive computations** with useMemo
3. **Debounce user input** handlers
4. **Lazy load** below-the-fold content
5. **Optimize images** with Next.js Image
6. **Minimize layout shifts** with proper sizing
