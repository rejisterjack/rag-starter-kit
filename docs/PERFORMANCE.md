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

### Indexes

```sql
-- Vector similarity search
CREATE INDEX idx_document_chunks_embedding ON document_chunks 
USING ivfflat (embedding vector_cosine_ops);

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
