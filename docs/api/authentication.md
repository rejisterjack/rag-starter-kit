# Authentication

The RAG Starter Kit supports multiple authentication methods to accommodate different use cases.

## Overview

| Method | Use Case | Setup Complexity |
|--------|----------|------------------|
| Session (Cookies) | Web app users | Built-in |
| OAuth (GitHub/Google) | Social login | Simple |
| SAML SSO | Enterprise | Moderate |
| API Keys | Programmatic access | Simple |

## Session-Based Authentication

Default authentication for browser-based access using NextAuth.js with JWT sessions.

### Flow

```
┌─────────┐         ┌──────────────┐         ┌─────────┐
│  Client │ ──────> │  NextAuth.js │ ──────> │  Prisma │
└─────────┘         └──────────────┘         └─────────┘
      │                    │                      │
      │ 1. Login Request   │                      │
      │───────────────────>│                      │
      │                    │ 2. Validate          │
      │                    │─────────────────────>│
      │                    │                      │
      │                    │ 3. User Data         │
      │                    │<─────────────────────│
      │                    │                      │
      │ 4. JWT Cookie      │                      │
      │<───────────────────│                      │
```

### Configuration

```typescript
// src/lib/auth/index.ts
export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // ... providers
});
```

## OAuth Authentication

### Supported Providers

- **GitHub** - Developer-friendly
- **Google** - Enterprise-ready

### Setup

1. **GitHub OAuth App**
   ```bash
   # Environment variables
   AUTH_GITHUB_ID=your_github_client_id
   AUTH_GITHUB_SECRET=your_github_client_secret
   ```

2. **Google OAuth 2.0**
   ```bash
   AUTH_GOOGLE_ID=your_google_client_id
   AUTH_GOOGLE_SECRET=your_google_client_secret
   ```

### Security Considerations

- `allowDangerousEmailAccountLinking` is **NOT enabled** by default
- Prevents OAuth account takeover attacks
- Each OAuth account is independent

## SAML SSO (Enterprise)

For enterprise single sign-on using SAML 2.0.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/saml/:workspaceId/login` | GET | Initiate SAML login |
| `/api/auth/saml/:workspaceId/acs` | POST | Assertion Consumer Service |
| `/api/auth/saml/:workspaceId/slo` | POST | Single Logout |
| `/api/auth/saml/:workspaceId/metadata` | GET | SP Metadata |

### Configuration

```typescript
// Workspace-level SAML settings
{
  "provider": "okta|azure|onelogin|custom",
  "entryPoint": "https://idp.example.com/saml/sso",
  "issuer": "rag-starter-kit",
  "cert": "-----BEGIN CERTIFICATE-----..."
}
```

### Setup Example (Okta)

1. Create SAML app in Okta
2. Set ACS URL: `https://your-domain.com/api/auth/saml/:workspaceId/acs`
3. Set Entity ID: `rag-starter-kit`
4. Download IdP certificate
5. Configure in workspace settings

## API Key Authentication

For programmatic access and integrations.

### Creating an API Key

```bash
POST /api/api-keys
{
  "name": "Production Integration",
  "permissions": ["read:documents", "write:chat"],
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "sk_live_abc123xyz789",  // Only shown once!
    "id": "key_123",
    "name": "Production Integration",
    "permissions": ["read:documents", "write:chat"],
    "expiresAt": "2025-12-31T23:59:59Z"
  }
}
```

### Using API Keys

Include in the `Authorization` header:

```bash
# Header format
Authorization: Bearer sk_live_abc123xyz789

# Example request
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer sk_live_abc123xyz789" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

### Permission Scopes

| Scope | Description |
|-------|-------------|
| `read:documents` | List and read documents |
| `write:documents` | Upload and modify documents |
| `read:chat` | Read chat history |
| `write:chat` | Send messages |
| `admin:workspaces` | Manage workspaces |

### API Key Validation Flow

```typescript
// src/lib/security/api-keys.ts
export async function validateApiKey(
  key: string
): Promise<ApiKeyValidationResult> {
  // 1. Extract key from header
  // 2. Hash the key (secure comparison)
  // 3. Lookup in database
  // 4. Check expiration
  // 5. Verify workspace access
  // 6. Return validation result
}
```

## Domain-Based Routing

For organizations with custom domains:

```typescript
// src/lib/auth/domain-routing.ts
export function getWorkspaceByDomain(domain: string): Promise<Workspace | null> {
  // Maps custom domain to workspace
  // Example: acme.rag-starter-kit.com -> workspace
}
```

## Multi-Tenant Isolation

All authentication methods enforce workspace isolation:

```typescript
// Database query with workspace filter
const documents = await prisma.document.findMany({
  where: {
    workspaceId: session.user.workspaceId,
  },
});
```

## Security Best Practices

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one number
- At least one special character

### Session Security

- HTTP-only cookies
- Secure flag in production
- SameSite=strict
- 30-day expiration with sliding refresh

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Login | 5 requests / minute |
| API Key | 100 requests / minute |
| General | 60 requests / minute |

## Troubleshooting

### Common Issues

**"Unauthorized" Error**
- Check if session is valid
- Verify API key is not expired
- Ensure correct workspace access

**"Forbidden" Error**
- User lacks required permissions
- Check role assignments

**OAuth Redirect Issues**
- Verify callback URLs in OAuth app settings
- Check `NEXTAUTH_URL` environment variable

## Testing Authentication

```bash
# Test OAuth login
pnpm test:e2e --grep "oauth"

# Test API key auth
pnpm vitest run tests/integration/api-keys.test.ts
```
