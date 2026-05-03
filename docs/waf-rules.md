# Web Application Firewall (WAF) Rules

## Security Headers

Configured in `vercel.json` under `headers` for all `/api/*` routes:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking via iframes |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disables browser APIs not used by the app |
| `X-Robots-Tag` | `noindex, nofollow` | Prevents search engine indexing of API routes |

## Edge-Level Protection

These protections are enforced at the Vercel Edge before requests reach the application:

### Bot Protection

Vercel's built-in bot protection is enabled, which automatically blocks known malicious bots and automated scanning tools.

### Rate Limiting

Application-level rate limiting is enforced in `src/lib/security/rate-limiter.ts` using Upstash Redis with sliding windows:

| Endpoint Group | Window | Limit |
|---------------|--------|-------|
| `/api/chat` | 1 minute | 20 requests |
| `/api/ingest` | 1 minute | 10 requests |
| `/api/ingest/url` | 1 minute | 5 requests |
| General API | 1 minute | 60 requests |

Unauthenticated routes get stricter limits at the edge level.

## Application-Level Protections

### Input Validation

- **Zod schemas** validate all API request bodies before processing
- **File validation** checks MIME type, magic bytes, and size limits
- **URL validation** restricts to HTTP/HTTPS with optional domain allowlisting
- **SQL injection** prevented via Prisma parameterized queries (all `$executeRaw` uses tagged templates)

### CSRF Protection

Double-submit cookie pattern using `csrf_protect` middleware on all state-changing requests.

### SSRF Protection

`src/lib/security/ssrf-protection.ts` blocks requests to private/internal IP ranges (RFC 1918, loopback, link-local).

### Virus Scanning

Optional ClamAV integration via `ENABLE_VIRUS_SCAN` env var. Scans all uploaded files before processing.

## Adding New WAF Rules

To add additional Vercel WAF rules, edit `vercel.json` and add a `waf` block. Note that Vercel WAF requires a Pro or Enterprise plan.

```json
{
  "waf": {
    "rules": [
      { "name": "Block SQL Injection", "action": "deny", "condition": "REQUEST_URI contains \"' OR\"" },
      { "name": "Block XSS", "action": "deny", "condition": "REQUEST_URI contains \"<script>\"" }
    ]
  }
}
```

For Hobby plan users, the application-level protections above serve as the primary defense layer.
