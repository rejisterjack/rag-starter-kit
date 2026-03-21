# ADR 005: RAG Pipeline Architecture

## Status

**Accepted** - March 2024

## Context

We needed to design a RAG (Retrieval-Augmented Generation) pipeline that:
- Processes multiple document formats (PDF, DOCX, TXT)
- Provides accurate and fast semantic search
- Supports real-time streaming responses
- Handles conversation context and memory
- Scales with document volume

## Decision

We implemented a **multi-stage RAG pipeline** with:
- Hybrid retrieval (vector + keyword)
- Intelligent chunking strategies
- Source citations
- Conversation memory
- Multi-model fallback

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RAG Pipeline                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                        INGESTION                                   │  │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐   │  │
│  │  │  Upload  │──>│  Parse   │──>│  Chunk   │──>│   Embed      │   │  │
│  │  │  (S3)    │   │  (OCR)   │   │  (Smart) │   │  (Gemini)    │   │  │
│  │  └──────────┘   └──────────┘   └──────────┘   └──────────────┘   │  │
│  │                                         │                        │  │
│  │                                         ▼                        │  │
│  │                              ┌──────────────────┐                │  │
│  │                              │   PostgreSQL     │                │  │
│  │                              │  (pgvector)      │                │  │
│  │                              └──────────────────┘                │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                   │                                      │
│                                   │ Query                                │
│                                   ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      RETRIEVAL                                     │  │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐  │  │
│  │  │   Embed     │──>│   Search    │──>│   Re-rank / Filter      │  │  │
│  │  │   Query     │   │ (Hybrid)    │   │                         │  │  │
│  │  └─────────────┘   └─────────────┘   └─────────────────────────┘  │  │
│  │                                                                    │  │
│  │  Hybrid = Vector (0.7) + Keyword (0.3)                            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                   │                                      │
│                                   │ Context                              │
│                                   ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      GENERATION                                    │  │
│  │  ┌────────────┐   ┌─────────────┐   ┌──────────────────────────┐  │  │
│  │  │  Build     │──>│    LLM      │──>│   Stream Response        │  │  │
│  │  │  Prompt    │   │ (OpenRouter)│   │   + Citations            │  │  │
│  │  └────────────┘   └─────────────┘   └──────────────────────────┘  │  │
│  │                                                                    │  │
│  │  Prompt = System + Context + History + Query                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Document Ingestion

```typescript
// src/lib/rag/ingestion/pipeline.ts
export async function ingestDocument(
  file: File,
  workspaceId: string
): Promise<IngestionResult> {
  // 1. Store raw file
  const storageKey = await storage.upload(file);
  
  // 2. Queue for processing
  await inngest.send({
    name: 'document/process',
    data: { storageKey, workspaceId, filename: file.name },
  });
  
  return { documentId, status: 'processing' };
}
```

### 2. Text Extraction

```typescript
// src/lib/rag/ingestion/parsers/index.ts
export async function extractText(
  file: Buffer,
  mimeType: string
): Promise<string> {
  switch (mimeType) {
    case 'application/pdf':
      return extractPdfText(file);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractDocxText(file);
    case 'text/plain':
    case 'text/markdown':
      return file.toString('utf-8');
    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}
```

### 3. Intelligent Chunking

```typescript
// src/lib/rag/chunking/index.ts
export interface ChunkingStrategy {
  chunkSize: number;
  chunkOverlap: number;
  separators: string[];
}

export const strategies: Record<string, ChunkingStrategy> = {
  recursive: {
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ['\n\n', '\n', '. ', ' ', ''],
  },
  semantic: {
    chunkSize: 512,
    chunkOverlap: 50,
    separators: ['\n\n'], // Paragraph boundaries
  },
  fixed: {
    chunkSize: 500,
    chunkOverlap: 0,
    separators: [],
  },
};
```

### 4. Hybrid Retrieval

```typescript
// src/lib/rag/retrieval/hybrid.ts
export async function hybridSearch(
  query: string,
  queryEmbedding: number[],
  config: RetrievalConfig
): Promise<RetrievalResult[]> {
  // Vector search (70% weight)
  const vectorResults = await vectorSearch(queryEmbedding, {
    topK: config.topK * 2,
    threshold: 0.5,
  });
  
  // Keyword search (30% weight)
  const keywordResults = await keywordSearch(query, {
    topK: config.topK * 2,
  });
  
  // Combine and re-rank
  return combineResults(vectorResults, keywordResults, {
    vectorWeight: 0.7,
    keywordWeight: 0.3,
    topK: config.topK,
  });
}
```

### 5. Source Citations

```typescript
// src/lib/rag/citations.ts
export class CitationHandler {
  formatContextWithCitations(chunks: Chunk[]): {
    context: string;
    citationMap: Map<number, Citation>;
  } {
    const context = chunks
      .map((chunk, i) => `
[Source ${i + 1}] ${chunk.metadata.documentName} (Page ${chunk.metadata.page})
${chunk.content}
      `.trim())
      .join('\n\n---\n\n');
    
    return { context, citationMap };
  }
  
  extractCitations(
    response: string,
    citationMap: Map<number, Citation>
  ): Citation[] {
    const matches = response.match(/\[Source (\d+)\]/g) || [];
    return matches
      .map(m => citationMap.get(parseInt(m.match(/\d+/)![0])))
      .filter(Boolean);
  }
}
```

### 6. Conversation Memory

```typescript
// src/lib/rag/memory.ts
export class ConversationMemory {
  async getRecentMessages(
    conversationId: string,
    limit: number = 10
  ): Promise<Message[]> {
    return prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
  
  async addMessage(
    conversationId: string,
    message: Omit<Message, 'id' | 'createdAt'>
  ): Promise<void> {
    await prisma.message.create({
      data: { ...message, conversationId },
    });
  }
  
  async summarizeConversation(conversationId: string): Promise<string> {
    const messages = await this.getRecentMessages(conversationId, 50);
    // Use LLM to generate summary
    return generateSummary(messages);
  }
}
```

## Configuration

### RAGConfig Interface

```typescript
interface RAGConfig {
  // Chunking
  chunkSize: number;           // Characters per chunk
  chunkOverlap: number;        // Overlap between chunks
  chunkingStrategy: 'recursive' | 'semantic' | 'fixed';
  
  // Retrieval
  topK: number;               // Number of chunks to retrieve
  similarityThreshold: number; // Minimum similarity (0-1)
  retrievalStrategy: 'vector' | 'keyword' | 'hybrid';
  vectorWeight: number;       // Weight for hybrid (0-1)
  
  // Generation
  model: string;              // LLM model identifier
  temperature: number;        // 0-2
  maxTokens: number;          // Max output tokens
  systemPrompt?: string;      // Custom system prompt
}
```

### Default Configuration

```typescript
export const defaultRAGConfig: RAGConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  chunkingStrategy: 'recursive',
  topK: 5,
  similarityThreshold: 0.7,
  retrievalStrategy: 'hybrid',
  vectorWeight: 0.7,
  model: 'deepseek/deepseek-chat:free',
  temperature: 0.7,
  maxTokens: 2000,
};
```

## Advanced Features

### 1. Query Expansion

```typescript
// src/lib/rag/retrieval/query-expansion.ts
export async function expandQuery(query: string): Promise<string[]> {
  const expansionPrompt = `Generate 3 variations of this query for better retrieval:
Query: ${query}`;
  
  const result = await generateText({
    model: openrouter.chat('deepseek/deepseek-chat:free'),
    prompt: expansionPrompt,
  });
  
  return [query, ...parseVariations(result.text)];
}
```

### 2. Re-ranking

```typescript
// src/lib/rag/retrieval/reranking.ts
export async function rerankResults(
  query: string,
  results: RetrievalResult[]
): Promise<RetrievalResult[]> {
  // Cross-encoder re-ranking for better relevance
  const scores = await crossEncoder.score(
    results.map(r => [query, r.content])
  );
  
  return results
    .map((r, i) => ({ ...r, score: scores[i] }))
    .sort((a, b) => b.score - a.score);
}
```

### 3. Context Compression

```typescript
// src/lib/rag/retrieval/compression.ts
export async function compressContext(
  chunks: Chunk[],
  maxTokens: number
): Promise<Chunk[]> {
  let totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
  
  if (totalTokens <= maxTokens) return chunks;
  
  // Remove least relevant chunks
  return chunks
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.floor(chunks.length * (maxTokens / totalTokens)));
}
```

## Performance Optimizations

### 1. Caching

```typescript
// Cache embeddings to reduce API calls
const embeddingCache = new LRUCache<string, number[]>({
  max: 10000,
  ttl: 1000 * 60 * 60 * 24, // 24 hours
});

export async function getCachedEmbedding(text: string): Promise<number[]> {
  const key = hashText(text);
  
  if (embeddingCache.has(key)) {
    return embeddingCache.get(key)!;
  }
  
  const embedding = await generateEmbedding(text);
  embeddingCache.set(key, embedding);
  return embedding;
}
```

### 2. Batch Processing

```typescript
// Process chunks in batches
const BATCH_SIZE = 100;

for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
  const batch = chunks.slice(i, i + BATCH_SIZE);
  const embeddings = await generateEmbeddings(batch.map(c => c.content));
  
  await prisma.chunk.createMany({
    data: batch.map((chunk, j) => ({
      ...chunk,
      embedding: embeddings[j],
    })),
  });
}
```

## Monitoring

```typescript
// Track RAG metrics
await prisma.ragMetrics.create({
  data: {
    query,
    retrievalTimeMs,
    generationTimeMs,
    chunksRetrieved: chunks.length,
    tokensUsed,
    modelUsed,
  },
});
```

## Consequences

### Positive

- **Accurate retrieval**: Hybrid search improves results
- **Source transparency**: Citations build trust
- **Scalable**: Async processing handles large volumes
- **Configurable**: Different strategies for different content

### Negative

- **Complexity**: Multiple components to maintain
- **Latency**: Multiple API calls in pipeline
- **Cost**: Embedding generation costs

## Related Decisions

- [ADR 002: Database Choice](./002-database-choice.md)
- [ADR 003: AI Provider Strategy](./003-ai-provider-strategy.md)

## References

- [LangChain RAG Documentation](https://js.langchain.com/docs/use_cases/question_answering/)
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [RAG Survey Paper](https://arxiv.org/abs/2312.10997)
