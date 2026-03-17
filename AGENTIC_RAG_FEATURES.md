# Advanced RAG Features with Agentic Capabilities

This document describes the advanced RAG features implemented for the RAG chatbot.

## 📁 New Directory Structure

```
src/lib/
├── rag/
│   ├── agent/              # Agentic RAG components
│   │   ├── index.ts        # Exports for agent module
│   │   ├── router.ts       # Query classification & routing
│   │   ├── react.ts        # ReAct pattern implementation
│   │   └── multi-step.ts   # Multi-step reasoning
│   ├── tools/              # Tools for agents
│   │   ├── index.ts        # Exports for tools
│   │   ├── types.ts        # Tool type definitions
│   │   ├── calculator.ts   # Safe math evaluation
│   │   ├── web-search.ts   # Web search integration
│   │   └── document-tools.ts # Document search tools
│   └── conversation-branch.ts # Conversation branching
├── analytics/              # Analytics & metrics
│   ├── index.ts
│   ├── rag-metrics.ts      # RAG pipeline metrics
│   └── token-tracking.ts   # Token usage & cost tracking
├── observability/          # Observability integrations
│   ├── index.ts
│   └── langfuse.ts         # Langfuse integration
├── experiments/            # A/B testing
│   ├── index.ts
│   └── prompt-experiments.ts
├── export/                 # Export functionality
│   ├── index.ts
│   └── conversation-export.ts
└── collaboration/          # Collaboration features
    ├── index.ts
    └── sharing.ts          # Sharing, comments, mentions
```

## 🎯 Key Features

### 1. Query Router (`src/lib/rag/agent/router.ts`)

Classifies queries into types to determine the optimal processing strategy:

```typescript
export enum QueryType {
  DIRECT_ANSWER = 'direct_answer',  // Simple questions
  RETRIEVE = 'retrieve',            // Needs document retrieval
  CALCULATE = 'calculate',          // Math calculations
  WEB_SEARCH = 'web_search',        // Web search needed
  CLARIFY = 'clarify',              // Needs clarification
}

// Usage
const router = createQueryRouter();
const classification = await router.classify(query, history);
// Returns: { type, confidence, reasoning, suggestedTools }
```

### 2. ReAct Agent (`src/lib/rag/agent/react.ts`)

Implements the ReAct (Reasoning + Acting) pattern:

```typescript
const agent = createReActAgent([
  calculatorTool,
  searchDocumentsTool,
  webSearchTool,
]);

const result = await agent.execute(query, {
  workspaceId,
  userId,
});
// Returns: { answer, steps, sources, tokensUsed, latency }
```

**Features:**
- Think → Act → Observe → Answer loop
- Tool execution with error handling
- Source tracking throughout steps
- Streaming support for real-time updates

### 3. Multi-Step Reasoning (`src/lib/rag/agent/multi-step.ts`)

Breaks complex queries into sub-queries:

```typescript
const reasoner = createMultiStepReasoner(tools);

const result = await reasoner.execute(
  "Compare Q1 and Q2 revenue from the financial report",
  { workspaceId, userId }
);
// Automatically:
// 1. Retrieves Q1 revenue
// 2. Retrieves Q2 revenue
// 3. Calculates difference
// 4. Generates comparison
```

### 4. Tools System (`src/lib/rag/tools/`)

**Available Tools:**
- `calculator` - Safe math evaluation with unit conversions
- `web_search` - Web search via Tavily, SerpAPI, or DuckDuckGo
- `document_search` - Search through uploaded documents
- `document_summary` - Generate document summaries
- `document_metadata` - Get document info
- `semantic_search` - Vector similarity search
- `compare_documents` - Compare multiple documents
- `current_time` - Get current date/time

### 5. Conversation Branching (`src/lib/rag/conversation-branch.ts`)

```typescript
// Fork a conversation at any point
const newBranchId = await forkConversation(
  conversationId,
  messageId,
  "My Branch Name"
);

// Edit a previous message (creates branch)
await editMessage(messageId, newContent, {
  regenerateResponse: true
});

// Compare branches
const comparison = await compareBranches(branchAId, branchBId);
```

### 6. Analytics (`src/lib/analytics/`)

**RAG Metrics:**
```typescript
await trackRAGMetrics({
  query,
  retrievedChunks,
  response,
  latencyMs,
  tokenUsage,
});

const metrics = await getRAGMetrics(workspaceId, { start, end });
```

**Token Tracking:**
```typescript
await trackTokenUsage({
  workspaceId,
  userId,
  model,
  promptTokens,
  completionTokens,
});

const cost = estimateCost(model, promptTokens, completionTokens);
```

### 7. Observability - Langfuse (`src/lib/observability/langfuse.ts`)

```typescript
const tracer = createRAGTracerFromEnv();

// Start trace
await tracer.startTrace({ query, userId, workspaceId });

// Trace phases
await tracer.traceRetrieval(async () => retrieveSources(query));
await tracer.traceGeneration(async () => generateResponse(prompt));

// End trace
await tracer.endTrace();
```

### 8. A/B Testing (`src/lib/experiments/prompt-experiments.ts`)

```typescript
const manager = getExperimentManager();

// Register experiment
manager.registerExperiment({
  id: 'citation-style',
  variants: [variantA, variantB],
  trafficSplit: [0.5, 0.5],
  status: 'running',
});

// Get variant for user
const variant = getPromptVariant('citation-style', userId);

// Track results
await trackExperimentResult(experimentId, variantId, metrics);
```

### 9. Export (`src/lib/export/conversation-export.ts`)

```typescript
// Export to Markdown
const markdown = await exportConversationToMarkdown(conversationId);

// Export to PDF
const pdfBuffer = await exportConversationToPDF(conversationId);

// Export to JSON
const json = await exportConversationToJSON(conversationId);

// Export to CSV
const csv = await exportConversationToCSV(conversationId);
```

### 10. Collaboration (`src/lib/collaboration/sharing.ts`)

```typescript
// Create share link
const link = await createShareLink(conversationId, userId, {
  expiresInDays: 7,
  permissions: { canView: true, canComment: true },
});

// Add comments
await addComment(messageId, userId, "Great insight!");

// Add annotations
await addAnnotation(messageId, userId, "Important point", {
  highlightedText: "revenue increased",
});

// Process @mentions
const mentions = await processMentions(messageId, content, senderId);
```

## 🗄️ Database Schema Updates

New Prisma models added:

- `RAGEvent` - Tracks RAG pipeline executions
- `RetrievedChunk` - Tracks retrieved chunks per query
- `TokenUsage` - Token usage tracking
- `WorkspaceBudget` - Budget configuration
- `ExperimentResult` - A/B test results
- `ShareLink` - Shareable conversation links
- `Comment` - Message comments
- `Annotation` - Text annotations
- `Mention` - @mention notifications
- `ObservabilityTrace` - Langfuse traces
- `ObservabilitySpan` - Trace spans

## 🔧 Environment Variables

```env
# Web Search
TAVILY_API_KEY=your_tavily_key
SERPAPI_KEY=your_serpapi_key
WEB_SEARCH_PROVIDER=tavily  # or serpapi, duckduckgo, mock

# Langfuse Observability
LANGFUSE_PUBLIC_KEY=your_public_key
LANGFUSE_SECRET_KEY=your_secret_key
LANGFUSE_BASE_URL=https://cloud.langfuse.com

# Model Configuration
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key
```

## 📖 Usage Examples

### Basic Agentic RAG Query

```typescript
import { createQueryRouter, QueryType } from '@/lib/rag/agent';
import { createReActAgent, createToolRegistry } from '@/lib/rag';

const router = createQueryRouter();
const classification = await router.classify(userQuery, history);

if (classification.type === QueryType.RETRIEVE) {
  const agent = createReActAgent(createToolRegistry().getAll());
  const result = await agent.execute(userQuery, context);
  return result.answer;
}
```

### Track Metrics

```typescript
import { trackRAGMetrics, trackTokenUsage } from '@/lib/analytics';

// After RAG response
await trackRAGMetrics({
  query: userQuery,
  conversationId,
  workspaceId,
  userId,
  retrievedChunks: sources.map((s, i) => ({
    chunkId: s.id,
    documentId: s.metadata.documentId,
    similarity: s.similarity ?? 0,
    rank: i + 1,
  })),
  response: answer,
  latencyMs: Date.now() - startTime,
  tokenUsage: usage,
  model,
});
```

## 🚀 Future Enhancements

1. **Multi-modal Support** - Handle images, audio, video
2. **Agent Orchestration** - Multiple specialized agents
3. **Self-Improvement** - Learn from user feedback
4. **Knowledge Graph** - Entity and relationship extraction
5. **Advanced Planning** - Hierarchical task networks
