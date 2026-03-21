# API Documentation

Welcome to the RAG Starter Kit API documentation. This API provides endpoints for chat, document management, authentication, and real-time collaboration.

## Base URL

```
Development: http://localhost:3000/api
Production:  https://your-domain.com/api
```

## Authentication

The API supports multiple authentication methods:

1. **Session-based** (Browser) - Via NextAuth.js cookies
2. **API Keys** - For programmatic access
3. **OAuth 2.0** - For third-party integrations

See [Authentication](./authentication.md) for details.

## Content Types

All API endpoints accept and return JSON (`application/json`) unless otherwise specified.

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": "Additional details (optional)"
}
```

## Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `RATE_LIMIT` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

API requests are rate-limited per endpoint. See [Rate Limiting](./rate-limiting.md) for details.

## API Endpoints Overview

### Chat
- `POST /api/chat` - Send a message with streaming response
- `GET /api/chat` - Get chat history
- `DELETE /api/chat` - Delete a chat
- `POST /api/chat/branch` - Create conversation branch

### Documents
- `POST /api/ingest` - Upload and process documents
- `GET /api/documents` - List documents
- `DELETE /api/documents/:id` - Delete a document

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/[...nextauth]` - OAuth endpoints

### Workspaces
- `GET /api/workspaces` - List workspaces
- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces/:id/members` - List members

### Admin
- `GET /api/admin/audit-logs` - View audit logs
- `GET /api/admin/workspaces` - Manage workspaces

## OpenAPI Specification

```yaml
openapi: 3.0.0
info:
  title: RAG Starter Kit API
  version: 1.0.0
  description: Production-ready RAG chatbot API
servers:
  - url: http://localhost:3000/api
    description: Development
  - url: https://api.rag-starter-kit.com
    description: Production
```

## SDK Examples

### JavaScript/TypeScript

```typescript
// Using fetch
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Hello!' }],
    stream: true,
  }),
});

// Read streaming response
const reader = response.body?.getReader();
while (reader) {
  const { done, value } = await reader.read();
  if (done) break;
  // Process chunk
}
```

### Python

```python
import requests

response = requests.post(
    'http://localhost:3000/api/chat',
    json={
        'messages': [{'role': 'user', 'content': 'Hello!'}],
        'stream': False
    },
    headers={'Content-Type': 'application/json'}
)

data = response.json()
print(data['data']['content'])
```

### cURL

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "What is RAG?"}],
    "stream": false
  }'
```

## WebSocket API

Real-time features use WebSocket connections:

```javascript
const socket = io('ws://localhost:3001');

// Join workspace
socket.emit('join', { workspaceId: 'ws_123' });

// Listen for events
socket.on('user:joined', (data) => {
  console.log('User joined:', data.userId);
});
```

See [Webhooks](./webhooks.md) for webhook configuration.

## Testing

Use the provided test scripts:

```bash
# Run API tests
pnpm test:integration

# Run E2E tests
pnpm test:e2e
```
