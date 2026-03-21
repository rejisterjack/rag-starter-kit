# Chat API

The Chat API provides endpoints for conversational AI with RAG (Retrieval-Augmented Generation) capabilities.

## Overview

- **Streaming Support**: Real-time token streaming via Server-Sent Events
- **RAG Context**: Automatic document retrieval and citation
- **Conversation Memory**: Persistent chat history
- **Multi-Model Support**: OpenRouter, OpenAI, Ollama

## Endpoints

### POST /api/chat

Send a message and receive an AI response with optional streaming.

#### Request

```typescript
interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  chatId?: string;           // Existing conversation ID
  conversationId?: string;   // Alias for chatId
  stream?: boolean;          // Enable streaming (default: true)
  config?: {
    model?: string;          // Model identifier
    temperature?: number;    // 0-2 (default: 0.7)
    maxTokens?: number;      // Max output tokens
    topK?: number;          // Number of sources to retrieve
    similarityThreshold?: number; // 0-1 (default: 0.7)
  };
  documentIds?: string[];    // Filter to specific documents
}
```

#### Example Request

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "messages": [
      {"role": "user", "content": "What are the key findings in the Q4 report?"}
    ],
    "stream": true,
    "config": {
      "temperature": 0.5,
      "topK": 5
    }
  }'
```

#### Streaming Response

When `stream: true`, returns a text/event-stream:

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
X-Message-Sources: [{"id": "...", "documentName": "Q4_Report.pdf", ...}]
X-Model-Used: deepseek/deepseek-chat:free

<streamed tokens>
```

**Consuming the stream (JavaScript):**

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages, stream: true }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  // Append to UI
  console.log(chunk);
}

// Get sources from headers
const sources = JSON.parse(response.headers.get('X-Message-Sources'));
```

#### Non-Streaming Response

When `stream: false`:

```json
{
  "success": true,
  "data": {
    "content": "Based on the Q4 report [Source 1], revenue increased by...",
    "sources": [
      {
        "id": "chunk_123",
        "documentName": "Q4_Report.pdf",
        "documentId": "doc_456",
        "page": 5,
        "score": 0.92
      }
    ],
    "usage": {
      "promptTokens": 1024,
      "completionTokens": 256,
      "totalTokens": 1280
    },
    "model": "deepseek/deepseek-chat:free"
  }
}
```

### GET /api/chat

Retrieve chat history for a conversation.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `chatId` | string | Conversation ID |
| `conversationId` | string | Alias for chatId |
| `limit` | number | Max messages (default: 50, max: 100) |

#### Response

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg_123",
        "role": "user",
        "content": "What is RAG?",
        "createdAt": "2024-01-15T10:30:00Z",
        "sources": []
      },
      {
        "id": "msg_124",
        "role": "assistant",
        "content": "RAG stands for Retrieval-Augmented Generation...",
        "createdAt": "2024-01-15T10:30:05Z",
        "sources": [
          {
            "id": "chunk_456",
            "documentId": "doc_789",
            "content": "Retrieval-Augmented Generation (RAG) is...",
            "similarity": 0.95
          }
        ]
      }
    ],
    "count": 2
  }
}
```

### DELETE /api/chat

Delete a conversation and all its messages.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chatId` | string | Yes | Conversation ID to delete |

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Chat deleted successfully"
  }
}
```

## RAG Pipeline

### How It Works

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ User Query  │────>│  Embed Query │────>│ Vector Search│
└─────────────┘     └──────────────┘     └──────────────┘
                                                  │
┌─────────────┐     ┌──────────────┐              │
│   Response  │<────│    LLM       │<─────────────┘
│  (Streamed) │     │  (OpenRouter)│     Retrieved
└─────────────┘     └──────────────┘     Chunks
```

### Source Citations

Responses automatically include citations in `[Source X]` format:

```
According to the report [Source 1], revenue increased by 25%.
The team expansion [Source 2] contributed to this growth.
```

Sources are returned in the `sources` array with:
- `documentName`: Original filename
- `page`: Page number (for PDFs)
- `score`: Relevance score (0-1)

## Supported Models

### OpenRouter (Free Tier)

| Model | ID | Strengths |
|-------|-----|-----------|
| DeepSeek Chat | `deepseek/deepseek-chat:free` | Best overall |
| Mistral 7B | `mistralai/mistral-7b-instruct:free` | Fast, reliable |
| Llama 3.1 8B | `meta-llama/llama-3.1-8b-instruct:free` | Meta's best |
| Gemma 2 9B | `google/gemma-2-9b-it:free` | Google model |

### OpenAI

- `gpt-4o`
- `gpt-4o-mini`
- `gpt-3.5-turbo`

### Ollama (Self-Hosted)

- `llama3`
- `mistral`
- `phi3`
- `gemma2`

## Error Handling

### Common Errors

| Code | HTTP | Description | Resolution |
|------|------|-------------|------------|
| `RATE_LIMIT` | 429 | Too many requests | Wait and retry |
| `CONTEXT_LENGTH_EXCEEDED` | 413 | Prompt too long | Reduce message history |
| `MODEL_UNAVAILABLE` | 503 | Model down | Automatic fallback |
| `VALIDATION_ERROR` | 400 | Invalid input | Check request format |

### Model Fallback

If the primary model fails, the system automatically tries fallback models:

```typescript
const MODEL_FALLBACK_CHAIN = [
  'deepseek/deepseek-chat:free',
  'mistralai/mistral-7b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  // ...
];
```

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/chat | 30 | 1 minute |
| GET /api/chat | 60 | 1 minute |
| DELETE /api/chat | 10 | 1 minute |

Headers included in responses:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1640995200000
```

## WebSocket Real-time (Optional)

For collaborative chat features:

```javascript
const socket = io('ws://localhost:3001');

// Listen for typing indicators
socket.on('typing', ({ userId, isTyping }) => {
  updateTypingIndicator(userId, isTyping);
});

// Send typing indicator
socket.emit('typing', { chatId: 'chat_123', isTyping: true });
```

## Best Practices

1. **Always use streaming** for better UX
2. **Implement retry logic** for rate limits
3. **Cache source documents** client-side for highlighting
4. **Show loading states** during retrieval
5. **Handle errors gracefully** with user-friendly messages

## SDK Example: Complete Chat Client

```typescript
class ChatClient {
  private baseUrl: string;
  
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }
  
  async *streamChat(
    messages: Message[],
    options: ChatOptions = {}
  ): AsyncGenerator<string, ChatResult, unknown> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        stream: true,
        config: options.config,
        documentIds: options.documentIds,
      }),
    });
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
    
    return {
      sources: JSON.parse(response.headers.get('X-Message-Sources') || '[]'),
      model: response.headers.get('X-Model-Used') || 'unknown',
    };
  }
}
```
