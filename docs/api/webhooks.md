# Webhooks API

Webhooks allow your application to receive real-time notifications when events occur in the RAG Starter Kit.

## Overview

- **Event Types**: Document processed, chat completed, user actions
- **Delivery Guarantee**: Automatic retries with exponential backoff
- **Security**: HMAC-SHA256 signature verification
- **Idempotency**: Duplicate event detection

## Configuration

### Creating a Webhook

```bash
POST /api/webhooks
{
  "url": "https://your-app.com/webhooks/rag",
  "events": ["document.processed", "chat.completed"],
  "secret": "your_webhook_secret",  // Auto-generated if not provided
  "metadata": {
    "environment": "production"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "wh_abc123",
    "url": "https://your-app.com/webhooks/rag",
    "events": ["document.processed", "chat.completed"],
    "secret": "whsec_...",  // Only shown once!
    "status": "active",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

## Event Types

### Document Events

| Event | Description | Payload |
|-------|-------------|---------|
| `document.created` | Document uploaded | Document metadata |
| `document.processed` | Processing completed | Document + chunks |
| `document.failed` | Processing failed | Error details |
| `document.deleted` | Document removed | Document ID |

### Chat Events

| Event | Description | Payload |
|-------|-------------|---------|
| `chat.started` | New conversation | Chat metadata |
| `chat.message` | New message | Message content |
| `chat.completed` | Response finished | Full conversation |
| `chat.deleted` | Chat removed | Chat ID |

### User Events

| Event | Description | Payload |
|-------|-------------|---------|
| `user.joined` | New user registered | User profile |
| `user.login` | User signed in | Session info |
| `user.invited` | User invited to workspace | Invitation details |

### Workspace Events

| Event | Description | Payload |
|-------|-------------|---------|
| `workspace.created` | New workspace | Workspace details |
| `member.added` | Member joined | Member info |
| `member.removed` | Member left | Member ID |

## Webhook Payload Structure

```typescript
interface WebhookPayload {
  id: string;              // Unique event ID
  type: string;            // Event type
  createdAt: string;       // ISO timestamp
  apiVersion: string;      // API version
  
  data: {
    // Event-specific data
  };
  
  workspace?: {
    id: string;
    name: string;
  };
  
  actor?: {
    id: string;
    type: 'user' | 'api_key' | 'system';
  };
}
```

### Example: Document Processed

```json
{
  "id": "evt_abc123",
  "type": "document.processed",
  "createdAt": "2024-01-15T10:30:00Z",
  "apiVersion": "v1",
  
  "data": {
    "document": {
      "id": "doc_xyz789",
      "name": "Annual_Report.pdf",
      "size": 2048576,
      "type": "application/pdf",
      "chunkCount": 42,
      "status": "completed"
    },
    "processing": {
      "duration": 12500,
      "extractor": "pdf-parse",
      "embeddingsGenerated": 42
    }
  },
  
  "workspace": {
    "id": "ws_123",
    "name": "Acme Corp"
  },
  
  "actor": {
    "id": "user_456",
    "type": "user"
  }
}
```

## Security

### Signature Verification

Webhooks include a signature header for verification:

```
X-Webhook-Signature: sha256=<hex_signature>
X-Webhook-Timestamp: 1640995200
```

### Verification Example (Node.js)

```typescript
import { createHmac } from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Express middleware
app.post('/webhooks/rag', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET;
  
  if (!verifyWebhookSignature(req.body, signature, secret)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  res.status(200).send('OK');
});
```

### Verification Example (Python)

```python
import hmac
import hashlib

def verify_webhook_signature(payload: str, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected)
```

## Delivery Behavior

### Retry Policy

| Attempt | Delay | Total Time |
|---------|-------|------------|
| 1 | Immediate | 0s |
| 2 | 5s | 5s |
| 3 | 25s | 30s |
| 4 | 2m | 2.5m |
| 5 | 10m | 12.5m |

After 5 failed attempts, the webhook is marked as `failed`.

### Success Criteria

Webhook delivery is considered successful when your endpoint returns:
- HTTP 200-299 status code
- Response within 30 seconds

### Idempotency

Events include a unique `id` field. Store processed IDs to handle duplicates:

```typescript
const processedEvents = new Set<string>();

app.post('/webhooks/rag', (req, res) => {
  const { id } = req.body;
  
  if (processedEvents.has(id)) {
    return res.status(200).send('Already processed');
  }
  
  // Process event
  processedEvents.add(id);
  res.status(200).send('OK');
});
```

## Testing Webhooks

### Using the Dashboard

1. Go to Settings → Webhooks
2. Click "Test" on your webhook
3. Select event type and send test payload

### Using the API

```bash
POST /api/webhooks/:id/test
{
  "event": "document.processed",
  "data": {
    "document": {
      "id": "doc_test",
      "name": "Test.pdf"
    }
  }
}
```

### Local Testing with ngrok

```bash
# Start local server
npm run dev

# Expose to internet
npx ngrok http 3000

# Use ngrok URL as webhook endpoint
# https://abc123.ngrok.io/webhooks/rag
```

## Webhook Management

### List Webhooks

```bash
GET /api/webhooks
```

**Response:**

```json
{
  "success": true,
  "data": {
    "webhooks": [
      {
        "id": "wh_abc123",
        "url": "https://your-app.com/webhooks/rag",
        "events": ["document.processed"],
        "status": "active",
        "successRate": 99.5,
        "lastDelivered": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

### Update Webhook

```bash
PATCH /api/webhooks/:id
{
  "events": ["document.processed", "chat.completed", "user.joined"],
  "url": "https://new-url.com/webhooks"
}
```

### Delete Webhook

```bash
DELETE /api/webhooks/:id
```

### Rotate Secret

```bash
POST /api/webhooks/:id/rotate-secret
```

**Response:**

```json
{
  "success": true,
  "data": {
    "secret": "whsec_newsecret...",  // New secret
    "oldSecretExpiresAt": "2024-01-16T10:30:00Z"
  }
}
```

## Delivery Logs

### Get Delivery History

```bash
GET /api/webhooks/:id/deliveries?page=1&limit=20
```

**Response:**

```json
{
  "success": true,
  "data": {
    "deliveries": [
      {
        "id": "del_xyz789",
        "eventId": "evt_abc123",
        "status": "success",
        "httpStatus": 200,
        "deliveredAt": "2024-01-15T10:30:00Z",
        "duration": 245,
        "attempts": 1
      }
    ]
  }
}
```

## Best Practices

1. **Verify signatures**: Always validate webhook signatures
2. **Return quickly**: Respond immediately, process asynchronously
3. **Handle duplicates**: Use idempotency keys
4. **Retry logic**: Implement exponential backoff for API calls
5. **Monitor health**: Track delivery success rates
6. **Secret rotation**: Rotate secrets periodically

## Troubleshooting

### Webhook Not Firing

- Check webhook status is `active`
- Verify event type is in subscribed list
- Check workspace permissions

### Signature Verification Failing

- Ensure raw body is used (not parsed JSON)
- Check secret is correct
- Verify no proxy is modifying the payload

### High Failure Rate

- Check endpoint is responding < 30s
- Verify endpoint returns 200-299
- Check server capacity

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Webhook delivery | - | Max 5 retries |
| Test webhook | 10 | 1 minute |
| List deliveries | 60 | 1 minute |
