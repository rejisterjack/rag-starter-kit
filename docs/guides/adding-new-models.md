# Adding New AI Models

Guide for adding new LLM and embedding models to the RAG Starter Kit.

## Overview

The RAG Starter Kit uses a provider pattern for AI models, making it easy to add new providers without modifying core logic.

```
src/lib/ai/
├── llm/
│   ├── factory.ts       # Provider factory
│   ├── openrouter.ts    # OpenRouter provider
│   ├── openai.ts        # OpenAI provider
│   ├── ollama.ts        # Ollama provider
│   └── types.ts         # Shared types
└── embeddings/
    ├── index.ts         # Embedding providers
    ├── google.ts        # Google provider
    └── types.ts         # Embedding types
```

## Adding a New LLM Provider

### Step 1: Create Provider File

Create `src/lib/ai/llm/new-provider.ts`:

```typescript
import { type LanguageModel } from 'ai';
import { type LLMProvider, type LLMMessage, type LLMResponse } from './types';

export interface NewProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

export class NewProvider implements LLMProvider {
  private config: NewProviderConfig;

  constructor(config: NewProviderConfig) {
    this.config = {
      baseUrl: 'https://api.new-provider.com',
      defaultModel: 'default-model',
      ...config,
    };
  }

  async generate(
    messages: LLMMessage[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<LLMResponse> {
    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model ?? this.config.defaultModel,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`NewProvider API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      model: data.model,
    };
  }

  async stream(
    messages: LLMMessage[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      onToken?: (token: string) => void;
    } = {}
  ): Promise<LLMResponse> {
    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model ?? this.config.defaultModel,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`NewProvider API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let content = '';

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices[0]?.delta?.content || '';
            content += token;
            options.onToken?.(token);
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    return {
      content,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: options.model ?? this.config.defaultModel!,
    };
  }
}
```

### Step 2: Update Factory

Add to `src/lib/ai/llm/factory.ts`:

```typescript
import { NewProvider } from './new-provider';

export function createProviderFromEnv(): LLMProvider {
  const provider = process.env.LLM_PROVIDER ?? 'openrouter';

  switch (provider) {
    case 'openrouter':
      return new OpenRouterProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'ollama':
      return new OllamaProvider();
    case 'new-provider':  // Add this case
      return new NewProvider({
        apiKey: process.env.NEW_PROVIDER_API_KEY!,
        baseUrl: process.env.NEW_PROVIDER_BASE_URL,
        defaultModel: process.env.NEW_PROVIDER_MODEL,
      });
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
```

### Step 3: Add Environment Variables

Add to `.env.example` and `.env`:

```bash
# New Provider
LLM_PROVIDER=new-provider
NEW_PROVIDER_API_KEY=your-api-key
NEW_PROVIDER_BASE_URL=https://api.new-provider.com
NEW_PROVIDER_MODEL=your-default-model
```

### Step 4: Update Types

Add to `src/lib/ai/llm/types.ts`:

```typescript
export type LLMProviderType = 
  | 'openrouter' 
  | 'openai' 
  | 'ollama'
  | 'new-provider';  // Add this
```

## Adding a New Embedding Provider

### Step 1: Create Provider File

Create `src/lib/ai/embeddings/new-provider.ts`:

```typescript
import { type EmbeddingProvider, type EmbeddingConfig } from './types';

export interface NewEmbeddingConfig extends EmbeddingConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export class NewEmbeddingProvider implements EmbeddingProvider {
  private config: NewEmbeddingConfig;

  constructor(config: NewEmbeddingConfig) {
    this.config = {
      baseUrl: 'https://api.new-provider.com',
      model: 'embedding-model',
      dimensions: 768,
      ...config,
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.config.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    // Batch processing
    const batchSize = this.config.batchSize ?? 100;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await fetch(`${this.config.baseUrl}/v1/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          input: batch,
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data = await response.json();
      embeddings.push(...data.data.map((d: { embedding: number[] }) => d.embedding));
    }

    return embeddings;
  }

  getDimensions(): number {
    return this.config.dimensions!;
  }
}
```

### Step 2: Update Provider Index

Update `src/lib/ai/embeddings/index.ts`:

```typescript
import { NewEmbeddingProvider } from './new-provider';

export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = process.env.EMBEDDING_PROVIDER ?? 'google';

  switch (provider) {
    case 'google':
      return generateGoogleEmbedding(text);
    case 'openai':
      return generateOpenAIEmbedding(text);
    case 'local':
      return generateLocalEmbedding(text);
    case 'new-provider':  // Add this case
      const newProvider = new NewEmbeddingProvider({
        apiKey: process.env.NEW_EMBEDDING_API_KEY!,
        model: process.env.NEW_EMBEDDING_MODEL,
      });
      return newProvider.generateEmbedding(text);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
```

## Testing New Providers

### Unit Test

Create `tests/unit/ai/new-provider.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { NewProvider } from '@/lib/ai/llm/new-provider';

describe('NewProvider', () => {
  it('should generate response', async () => {
    const provider = new NewProvider({
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
    });

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Test response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        model: 'test-model',
      }),
    });

    const response = await provider.generate([
      { role: 'user', content: 'Hello' },
    ]);

    expect(response.content).toBe('Test response');
    expect(response.usage.totalTokens).toBe(15);
  });
});
```

### Integration Test

```typescript
// tests/integration/chat-with-new-provider.test.ts
import { describe, it, expect } from 'vitest';

describe('Chat with NewProvider', () => {
  it('should complete chat flow', async () => {
    process.env.LLM_PROVIDER = 'new-provider';
    process.env.NEW_PROVIDER_API_KEY = process.env.TEST_NEW_PROVIDER_KEY!;

    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What is AI?' }],
        stream: false,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.content).toBeTruthy();
  });
});
```

## Configuration Examples

### Using Together AI

```typescript
// src/lib/ai/llm/together.ts
export class TogetherProvider implements LLMProvider {
  async generate(messages, options) {
    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'togethercomputer/llama-2-70b-chat',
        messages,
      }),
    });
    // ...
  }
}
```

### Using Fireworks AI

```typescript
// src/lib/ai/llm/fireworks.ts
export class FireworksProvider implements LLMProvider {
  async generate(messages, options) {
    const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'accounts/fireworks/models/llama-v2-70b-chat',
        messages,
      }),
    });
    // ...
  }
}
```

## Best Practices

1. **Implement retry logic** for transient failures
2. **Add timeout handling** for slow providers
3. **Log provider errors** for debugging
4. **Test streaming thoroughly** - it's complex
5. **Document rate limits** in comments
6. **Add provider-specific options** via config

## Troubleshooting

### Provider Not Working

```bash
# Check environment variables
echo $NEW_PROVIDER_API_KEY

# Test API directly
curl -X POST https://api.new-provider.com/v1/chat/completions \
  -H "Authorization: Bearer $NEW_PROVIDER_API_KEY" \
  -d '{"model": "default", "messages": [{"role": "user", "content": "test"}]}'
```

### Streaming Issues

```typescript
// Add logging to debug streaming
async stream(messages, options) {
  console.log('Starting stream with model:', options.model);
  
  try {
    const response = await fetch(...);
    console.log('Stream response status:', response.status);
    // ...
  } catch (error) {
    console.error('Stream error:', error);
    throw error;
  }
}
```

## Related Documentation

- [AI Provider Types](../../src/lib/ai/llm/types.ts)
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
