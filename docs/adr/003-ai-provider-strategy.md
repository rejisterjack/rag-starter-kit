# ADR 003: OpenRouter + Google Gemini AI Provider Strategy

## Status

**Accepted** - March 2024

## Context

We needed to select AI providers for:
- **Chat/Completion**: LLM for generating responses
- **Embeddings**: Text vectorization for RAG

Requirements:
- Cost-effectiveness (preferably free for development)
- Reliability and uptime
- Model variety for different use cases
- Easy fallback mechanisms

## Decision

We chose:
- **Chat**: OpenRouter (aggregates free LLMs)
- **Embeddings**: Google Gemini (free tier)

This provides a **100% free** development setup.

## Alternatives Considered

### Chat/Completion Providers

#### 1. OpenAI GPT-4

| Pros | Cons |
|------|------|
| Best-in-class quality | Paid ($0.03/1K tokens) |
| Reliable API | Rate limits on free tier |
| Wide ecosystem | Vendor lock-in |

**Verdict**: Rejected - costs add up quickly for development.

#### 2. Anthropic Claude

| Pros | Cons |
|------|------|
| Excellent reasoning | No free tier |
| Large context window | Higher latency |
| Safety features | Limited availability |

**Verdict**: Rejected - no free option available.

#### 3. Ollama (Local)

| Pros | Cons |
|------|------|
| 100% free | Requires GPU/CPU resources |
| No network dependency | Slower inference |
| Privacy | Model management overhead |

**Verdict**: Complementary option - supported as fallback.

#### 4. Groq

| Pros | Cons |
|------|------|
| Extremely fast | Limited model selection |
| Free tier available | Rate limits |
| Good for latency | Newer, less mature |

**Verdict**: Alternative - can be used via OpenRouter.

### Embedding Providers

#### 1. OpenAI text-embedding-3

| Pros | Cons |
|------|------|
| High quality | Paid ($0.02/1K tokens) |
| Large context | Costs scale with documents |
| Mature API | - |

**Verdict**: Rejected - Google Gemini is free and comparable.

#### 2. Cohere

| Pros | Cons |
|------|------|
| Good multilingual | Free tier limited |
| Specialized models | Lower rate limits |

**Verdict**: Rejected - Gemini free tier is more generous.

#### 3. Local Embeddings (Transformers.js)

| Pros | Cons |
|------|------|
| 100% free | Requires client resources |
| No API calls | Quality varies |
| Privacy | Slower processing |

**Verdict**: Alternative - supported for on-device processing.

## Why OpenRouter + Google Gemini

### OpenRouter Benefits

```typescript
// Access to multiple free models
const MODEL_FALLBACK_CHAIN = [
  'deepseek/deepseek-chat:free',           // Primary
  'mistralai/mistral-7b-instruct:free',    // Fallback 1
  'meta-llama/llama-3.1-8b-instruct:free', // Fallback 2
  'google/gemma-2-9b-it:free',             // Fallback 3
];

// Automatic failover
for (const model of MODEL_FALLBACK_CHAIN) {
  try {
    return await streamText({ model: openrouter.chat(model), messages });
  } catch (error) {
    continue; // Try next model
  }
}
```

### Google Gemini Benefits

```typescript
// Free tier: 1,500 requests/day
const embeddingModel = google.textEmbeddingModel('text-embedding-004');

// 768-dimensional embeddings
const result = await embed({
  model: embeddingModel,
  value: text,
});

// Batch processing
const batchResult = await embedMany({
  model: embeddingModel,
  values: texts,
});
```

### Cost Comparison

| Provider | Chat (1M tokens) | Embeddings (1M tokens) |
|----------|------------------|------------------------|
| OpenAI GPT-4 | $30 | $2 |
| OpenRouter Free | $0 | - |
| Google Gemini | - | $0 (1,500 req/day) |
| **Our Stack** | **$0** | **$0** |

## Implementation

### Provider Factory Pattern

```typescript
// src/lib/ai/llm/factory.ts
export function createProviderFromEnv(): LLMProvider {
  const provider = process.env.LLM_PROVIDER ?? 'openrouter';
  
  switch (provider) {
    case 'openrouter':
      return new OpenRouterProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'ollama':
      return new OllamaProvider();
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
```

### Embedding Strategy

```typescript
// src/lib/ai/embeddings/index.ts
export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = process.env.EMBEDDING_PROVIDER ?? 'google';
  
  switch (provider) {
    case 'google':
      return generateGoogleEmbedding(text);
    case 'openai':
      return generateOpenAIEmbedding(text);
    case 'local':
      return generateLocalEmbedding(text);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
```

## Fallback Strategy

```
User Request
     │
     ▼
┌─────────────┐
│ DeepSeek    │ ──Error──┐
│ (Primary)   │          │
└─────────────┘          │
     │ Success            │
     ▼                    ▼
┌─────────────┐    ┌─────────────┐
│   Return    │    │   Mistral   │ ──Error──┐
│  Response   │    │ (Fallback1) │          │
└─────────────┘    └─────────────┘          │
                              │ Success     │
                              ▼             ▼
                         ┌─────────┐   ┌─────────┐
                         │  Return │   │  Llama  │
                         │ Response│   │(Fallback2)
                         └─────────┘   └─────────┘
```

## Monitoring

```typescript
// Track model usage
await prisma.apiUsage.create({
  data: {
    userId,
    model: 'deepseek/deepseek-chat:free',
    provider: 'openrouter',
    tokensPrompt: usage.inputTokens,
    tokensCompletion: usage.outputTokens,
    latencyMs: Date.now() - startTime,
  },
});
```

## Consequences

### Positive

- **Zero cost**: Free for development and light usage
- **Model variety**: Access to latest open models
- **Easy switching**: Provider abstraction layer
- **No lock-in**: Can switch to paid providers anytime

### Negative

- **Rate limits**: Free tiers have restrictions
- **Quality variance**: Free models vary in quality
- **Uptime**: Less reliable than paid APIs
- **Latency**: Slower than dedicated endpoints

## Production Considerations

For production workloads:

1. **Monitor usage**: Track free tier limits
2. **Hybrid approach**: Use paid for critical paths
3. **Caching**: Reduce embedding API calls
4. **Batch processing**: Optimize embedding generation

## Related Decisions

- [ADR 002: Database Choice](./002-database-choice.md)
- [ADR 005: RAG Pipeline](./005-rag-pipeline.md)

## References

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [Google AI Studio](https://aistudio.google.com/)
- [Vercel AI SDK](https://sdk.vercel.ai/)
