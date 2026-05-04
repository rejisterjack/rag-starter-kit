# API Documentation

## Overview

The RAG Starter Kit exposes a RESTful API with the following base URL:

- **Development**: `http://localhost:3000`
- **Production**: `https://rag-starter-kit.vercel.app`

The full OpenAPI 3.0 specification is available at [`/api/docs`](https://rag-starter-kit.vercel.app/api/docs).

## Authentication

All protected endpoints require one of:

| Method | Header | Description |
|--------|--------|-------------|
| Session | `Cookie` | Automatically set after OAuth login via NextAuth.js |
| API Key | `X-API-Key` | Generated per workspace for programmatic access |

## Core Endpoints

### System

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | None | Health check with dependency status |
| GET | `/api/docs` | None | OpenAPI 3.0 specification (JSON) |

### Chat

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/chat` | Required | Send message, receive streaming RAG response |

**Request Body:**
```json
{
  "messages": [
    { "role": "user", "content": "What is RAG?" }
  ],
  "conversationId": "optional-existing-id",
  "model": "deepseek/deepseek-chat:free",
  "workspaceId": "workspace-id"
}
```

**Response:** Server-Sent Events (SSE) stream with tokens and source citations.

### Documents

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/documents` | Required | List documents (supports cursor pagination) |
| POST | `/api/ingest` | Required | Upload and ingest a document |
| DELETE | `/api/documents/[id]` | Required | Delete a document and its chunks |

**Supported upload formats**: PDF, DOCX, TXT, MD, URLs

**Query Parameters (GET /api/documents):**
- `workspaceId` — Filter by workspace
- `status` — Filter by status (PENDING, PROCESSING, COMPLETED, FAILED)
- `limit` — Results per page (default: 20, max: 100)
- `cursor` — Pagination cursor from previous response

### Workspaces

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/workspaces` | Required | List user's workspaces |
| POST | `/api/workspaces` | Required | Create a new workspace |
| PUT | `/api/workspaces/[id]` | Required | Update workspace settings |
| DELETE | `/api/workspaces/[id]` | Owner | Delete workspace |

### Webhooks

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/webhook/ingest` | API Key | Ingest document via webhook |

**Webhook Request:**
```json
{
  "url": "https://example.com/docs/page.html",
  "workspaceId": "ws_abc123"
}
```

## Rate Limits

| Context | Limit | Window |
|---------|-------|--------|
| Authenticated users | 100 requests | Per minute |
| API keys | Configurable per key | Per minute |
| Unauthenticated | 10 requests | Per minute |

Rate limit headers are included in responses:
- `X-RateLimit-Limit` — Maximum requests allowed
- `X-RateLimit-Remaining` — Remaining requests
- `Retry-After` — Seconds until reset (on 429 responses)

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": {}
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `VALIDATION_ERROR` | 400 | Request body failed Zod validation |
| `RATE_LIMIT` | 429 | Rate limit exceeded |
| `NOT_FOUND` | 404 | Resource not found |
| `CSRF_INVALID` | 403 | Missing or invalid CSRF token |

## CORS

The API supports CORS for configured origins. Set `ALLOWED_ORIGINS` in your environment:

```bash
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

## SDKs & Client Libraries

### JavaScript/TypeScript

```typescript
// Using the built-in API client
import { apiClient } from '@/lib/api-client';

const response = await apiClient.chat({
  messages: [{ role: 'user', content: 'Hello' }],
  workspaceId: 'ws_123',
});
```

### cURL

```bash
# Chat with API key
curl -X POST https://rag-starter-kit.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"messages": [{"role": "user", "content": "What is RAG?"}]}'

# Upload document
curl -X POST https://rag-starter-kit.vercel.app/api/ingest \
  -H "X-API-Key: your-api-key" \
  -F "file=@document.pdf" \
  -F "workspaceId=ws_123"
```

## Streaming Protocol

Chat responses use Server-Sent Events (SSE). Each event contains:

```
data: {"type":"text-delta","textDelta":"Hello"}

data: {"type":"text-delta","textDelta":" world"}

data: {"type":"finish","sources":[{"documentName":"doc.pdf","similarity":0.92}]}
```

Parse with the standard `EventSource` API or the Vercel AI SDK's `useChat` hook.
