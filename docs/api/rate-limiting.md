# Rate Limiting

The RAG Starter Kit implements rate limiting to ensure fair usage and prevent abuse.

## Overview

- **Multi-Tier Strategy**: Different limits per endpoint and user type
- **Redis-Backed**: Distributed rate limiting using Upstash Redis
- **Header Information**: Rate limit status in response headers
- **Graceful Degradation**: Queue-based handling for bursts

## Rate Limit Tiers

### By Endpoint

| Endpoint | Limit | Window | Burst |
|----------|-------|--------|-------|
| `POST /api/chat` | 30 | 1 minute | 5 |
| `POST /api/ingest` | 10 | 1 minute | 2 |
| `GET /api/documents` | 60 | 1 minute | 10 |
| `POST /api/auth/*` | 5 | 1 minute | 1 |
| `API Key` endpoints | 100 | 1 minute | 20 |
| Default | 60 | 1 minute | 5 |

### By User Role

| Role | Multiplier | Description |
|------|------------|-------------|
| Anonymous | 0.1x | Strict limits |
| Free User | 1x | Standard limits |
| Pro User | 2x | Double limits |
| Admin | 5x | Higher limits |
| API Key | Configurable | Per-key settings |

### By Workspace

Workspaces have aggregate limits:

| Plan | Chat Requests | Document Uploads | Storage |
|------|--------------|------------------|---------|
| Free | 1,000/day | 50/day | 100 MB |
| Pro | 10,000/day | 500/day | 10 GB |
| Enterprise | Unlimited | Unlimited | Custom |

## Rate Limit Headers

Every API response includes rate limit information:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1705315200000
X-RateLimit-Policy: 30;w=60;burst=5
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed |
| `X-RateLimit-Remaining` | Requests remaining in window |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |
| `X-RateLimit-Policy` | Policy description (RFC 6585) |

## Rate Limit Exceeded

When rate limit is exceeded:

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705315260000
Retry-After: 45

{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT",
  "details": {
    "limit": 30,
    "window": 60,
    "retryAfter": 45
  }
}
```

## Implementation

### Rate Limiter Configuration

```typescript
// src/lib/security/rate-limiter.ts
export const rateLimits: Record<RateLimitType, RateLimitConfig> = {
  chat: {
    limit: 30,
    window: 60,
    burst: 5,
  },
  ingest: {
    limit: 10,
    window: 60,
    burst: 2,
  },
  api: {
    limit: 60,
    window: 60,
    burst: 5,
  },
  auth: {
    limit: 5,
    window: 60,
    burst: 1,
  },
  apiKey: {
    limit: 100,
    window: 60,
    burst: 20,
  },
};
```

### Usage in API Routes

```typescript
import { checkApiRateLimit, getRateLimitIdentifier } from '@/lib/security';

export async function POST(req: Request) {
  const identifier = getRateLimitIdentifier(req, { userId, workspaceId });
  
  const rateLimitResult = await checkApiRateLimit(identifier, 'chat', {
    userId,
    workspaceId,
    endpoint: '/api/chat',
  });
  
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', code: 'RATE_LIMIT' },
      { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil(
            (rateLimitResult.reset - Date.now()) / 1000
          ).toString(),
        },
      }
    );
  }
  
  // Process request...
  
  // Add rate limit headers to response
  addRateLimitHeaders(response.headers, rateLimitResult);
  return response;
}
```

### Sliding Window Algorithm

Uses a sliding window for accurate rate limiting:

```
Window: 60 seconds
Limit: 30 requests

Time:  0s    30s    60s    90s
       |------|------|------|
Reqs:  ████████████████████
       ↑ Current window (30s-90s)
```

## IP-Based Rate Limiting

Additional protection against abuse:

```typescript
// src/lib/security/ip-rate-limiter.ts
export async function checkIPRateLimit(
  ip: string,
  path: string
): Promise<IPRateLimitResult> {
  // Tracks per-IP request patterns
  // Implements progressive penalties
  // Supports CAPTCHA challenges
}
```

### Progressive Penalties

| Offense | Action | Duration |
|---------|--------|----------|
| 1st | Warning | - |
| 2nd | 2x stricter limits | 1 hour |
| 3rd | CAPTCHA required | 24 hours |
| 4th+ | Blocked | Permanent |

## Best Practices

### Client-Side Handling

```typescript
async function apiCallWithRetry(url: string, options: RequestInit) {
  const response = await fetch(url, options);
  
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const delay = parseInt(retryAfter || '60', 10) * 1000;
    
    console.log(`Rate limited. Retrying after ${delay}ms`);
    await sleep(delay);
    
    return apiCallWithRetry(url, options);
  }
  
  return response;
}
```

### Exponential Backoff

```typescript
async function fetchWithBackoff(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.status !== 429) {
      return response;
    }
    
    const delay = Math.min(1000 * 2 ** i, 30000);
    await sleep(delay);
  }
  
  throw new Error('Max retries exceeded');
}
```

### Monitoring Usage

```typescript
// Track remaining quota
function trackRateLimit(response: Response) {
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const limit = response.headers.get('X-RateLimit-Limit');
  
  if (remaining && limit) {
    const percentage = (parseInt(remaining) / parseInt(limit)) * 100;
    
    if (percentage < 20) {
      console.warn('Rate limit running low:', percentage + '%');
    }
  }
}
```

## Configuration

### Environment Variables

```bash
# Upstash Redis for rate limiting
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Rate limit settings
RATE_LIMIT_ENABLED=true
RATE_LIMIT_DEFAULT_LIMIT=60
RATE_LIMIT_WINDOW_SECONDS=60
```

### Custom Rate Limits per API Key

```typescript
// Create API key with custom limits
POST /api/api-keys
{
  "name": "High Volume Integration",
  "rateLimit": {
    "requestsPerMinute": 500,
    "burst": 50
  }
}
```

## Bypassing Rate Limits

Administrators can bypass rate limits:

```typescript
// Check for admin role
if (session.user.role === 'ADMIN') {
  return { success: true, limit: Infinity };
}
```

## Monitoring

### Dashboard Metrics

View rate limit metrics in the admin dashboard:

- Requests per endpoint
- Rate limit hit rate
- Top users by volume
- Blocked requests

### Alerts

Configure alerts for:

- High rate limit hit rate (>10%)
- Sudden traffic spikes
- Potential abuse patterns

## Troubleshooting

### Unexpected Rate Limits

1. Check if using correct authentication
2. Verify API key hasn't expired
3. Check workspace-level limits
4. Review IP reputation status

### Rate Limit Not Resetting

- Limits use sliding window, not fixed
- Wait for full window to pass
- Check for multiple clients sharing IP

## Related Documentation

- [Security Overview](../security.md)
- [API Keys](./authentication.md#api-key-authentication)
- [Architecture ADR](../adr/006-security.md)
