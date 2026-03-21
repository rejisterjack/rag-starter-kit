# ADR 004: Authentication Architecture

## Status

**Accepted** - March 2024

## Context

We needed an authentication system that supports:
- Multiple identity providers (OAuth, SAML, Email/Password)
- Workspace-based multi-tenancy
- API key authentication for integrations
- Session management with security best practices
- Audit logging for compliance

## Decision

We chose **NextAuth.js v5 (Auth.js)** with a custom multi-tenant architecture.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Authentication Layer                    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   NextAuth   │  │   SAML SSO   │  │    API Keys      │  │
│  │   (OAuth)    │  │  (Enterprise)│  │  (Integrations)  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                  │                   │            │
│         └──────────────────┼───────────────────┘            │
│                            │                                │
│                   ┌────────▼────────┐                       │
│                   │  JWT Session    │                       │
│                   │  + Workspace    │                       │
│                   │    Context      │                       │
│                   └────────┬────────┘                       │
│                            │                                │
│                   ┌────────▼────────┐                       │
│                   │  Authorization  │                       │
│                   │  (RBAC + ABAC)  │                       │
│                   └─────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## Why NextAuth.js v5

### 1. **Provider Flexibility**

```typescript
// src/lib/auth/index.ts
providers: [
  GitHub({
    clientId: process.env.AUTH_GITHUB_ID!,
    clientSecret: process.env.AUTH_GITHUB_SECRET!,
  }),
  Google({
    clientId: process.env.AUTH_GOOGLE_ID!,
    clientSecret: process.env.AUTH_GOOGLE_SECRET!,
  }),
  Credentials({
    name: 'credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      // Custom validation logic
    },
  }),
],
```

### 2. **JWT-Based Sessions**

```typescript
session: {
  strategy: 'jwt',
  maxAge: 30 * 24 * 60 * 60, // 30 days
  updateAge: 24 * 60 * 60,    // 24 hours
},

callbacks: {
  async jwt({ token, user, trigger, session }) {
    if (user) {
      token.id = user.id;
      token.role = user.role ?? 'USER';
      
      // Add workspace context
      const workspaces = await getUserWorkspaces(user.id);
      if (workspaces.length > 0) {
        token.workspaceId = workspaces[0].id;
        token.workspaceRole = workspaces[0].role;
      }
    }
    return token;
  },
},
```

### 3. **Type Safety**

```typescript
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      workspaceId?: string;
      workspaceRole?: string;
    } & DefaultSession['user'];
  }
}
```

## Multi-Tenancy Model

### Workspace-Based Isolation

```prisma
model User {
  id               String            @id @default(cuid())
  email            String            @unique
  workspaceMembers WorkspaceMember[]
  ownedWorkspaces  Workspace[]       @relation("WorkspaceOwner")
}

model Workspace {
  id       String            @id @default(cuid())
  name     String
  ownerId  String
  owner    User              @relation("WorkspaceOwner", fields: [ownerId], references: [id])
  members  WorkspaceMember[]
}

model WorkspaceMember {
  id          String    @id @default(cuid())
  workspaceId String
  userId      String
  role        MemberRole @default(MEMBER)
  
  @@unique([workspaceId, userId])
}

enum MemberRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}
```

### Permission System

```typescript
// src/lib/workspace/permissions.ts
export enum Permission {
  READ_DOCUMENTS = 'read:documents',
  WRITE_DOCUMENTS = 'write:documents',
  DELETE_DOCUMENTS = 'delete:documents',
  READ_CHATS = 'read:chats',
  WRITE_CHATS = 'write:chats',
  MANAGE_MEMBERS = 'manage:members',
  MANAGE_SETTINGS = 'manage:settings',
}

const rolePermissions: Record<MemberRole, Permission[]> = {
  [MemberRole.OWNER]: Object.values(Permission),
  [MemberRole.ADMIN]: [
    Permission.READ_DOCUMENTS,
    Permission.WRITE_DOCUMENTS,
    Permission.READ_CHATS,
    Permission.WRITE_CHATS,
    Permission.MANAGE_MEMBERS,
    Permission.MANAGE_SETTINGS,
  ],
  [MemberRole.MEMBER]: [
    Permission.READ_DOCUMENTS,
    Permission.WRITE_DOCUMENTS,
    Permission.READ_CHATS,
    Permission.WRITE_CHATS,
  ],
  [MemberRole.VIEWER]: [
    Permission.READ_DOCUMENTS,
    Permission.READ_CHATS,
  ],
};
```

## SAML SSO Implementation

### Endpoints

```typescript
// src/app/api/auth/saml/[workspaceId]/login/route.ts
export async function GET(
  req: Request,
  { params }: { params: { workspaceId: string } }
) {
  const samlConfig = await getSamlConfig(params.workspaceId);
  const loginUrl = await createSamlLoginRequest(samlConfig);
  return redirect(loginUrl);
}

// src/app/api/auth/saml/[workspaceId]/acs/route.ts
export async function POST(
  req: Request,
  { params }: { params: { workspaceId: string } }
) {
  const samlResponse = await req.text();
  const user = await validateSamlResponse(samlResponse, params.workspaceId);
  
  // Create session
  await createSession(user);
  return redirect('/chat');
}
```

### Supported Providers

- Okta
- Azure AD
- OneLogin
- Custom SAML 2.0

## API Key Authentication

### Key Format

```
sk_live_{prefix}_{random}
sk_test_{prefix}_{random}
```

### Validation Flow

```typescript
// src/lib/security/api-keys.ts
export async function validateApiKey(
  key: string
): Promise<ApiKeyValidationResult> {
  // 1. Extract and hash key
  const keyHash = hashApiKey(key);
  
  // 2. Lookup in database
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { workspace: true },
  });
  
  // 3. Check expiration
  if (apiKey?.expiresAt && apiKey.expiresAt < new Date()) {
    return { valid: false, error: 'API key expired' };
  }
  
  // 4. Update last used
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });
  
  return { 
    valid: true, 
    workspaceId: apiKey.workspaceId,
    permissions: apiKey.permissions,
  };
}
```

## Security Measures

### 1. **Password Requirements**

- Minimum 8 characters
- At least one uppercase letter
- At least one number
- At least one special character
- bcrypt hashing with salt rounds: 12

### 2. **Session Security**

```typescript
// Cookie configuration
cookies: {
  sessionToken: {
    name: `__Secure-next-auth.session-token`,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    },
  },
},
```

### 3. **CSRF Protection**

Built-in CSRF protection via double-submit cookie pattern.

### 4. **Rate Limiting**

```typescript
// Auth-specific rate limits
auth: {
  limit: 5,
  window: 60,
  burst: 1,
}
```

## Audit Logging

```typescript
// src/lib/audit/audit-logger.ts
export enum AuditEvent {
  USER_REGISTERED = 'user.registered',
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  PASSWORD_CHANGED = 'password.changed',
  API_KEY_CREATED = 'api_key.created',
  API_KEY_REVOKED = 'api_key.revoked',
}

export async function logAuditEvent(event: AuditLogEntry) {
  await prisma.auditLog.create({
    data: {
      event: event.event,
      userId: event.userId,
      workspaceId: event.workspaceId,
      ip: event.ip,
      userAgent: event.userAgent,
      metadata: event.metadata,
    },
  });
}
```

## Consequences

### Positive

- **Flexible auth**: Multiple providers in one system
- **Type safety**: Full TypeScript support
- **Active ecosystem**: Regular updates and community
- **Well-documented**: Extensive official docs
- **Audit trail**: Complete security logging

### Negative

- **Learning curve**: v5 has significant changes
- **Customization limits**: Some features require workarounds
- **Bundle size**: Adds to client bundle

## Alternatives Considered

### 1. **Clerk**

| Pros | Cons |
|------|------|
| Excellent DX | Paid for scale |
| Built-in components | Vendor lock-in |
| Great docs | Less customization |

**Verdict**: Rejected - want open source and self-hosted option.

### 2. **Supabase Auth**

| Pros | Cons |
|------|------|
| Open source | Tied to Supabase ecosystem |
| Real-time subscriptions | Less flexible |

**Verdict**: Rejected - want more provider flexibility.

### 3. **Lucia**

| Pros | Cons |
|------|------|
| Framework agnostic | More setup required |
| Lightweight | Smaller ecosystem |

**Verdict**: Rejected - NextAuth.js has better Next.js integration.

## Related Decisions

- [ADR 001: Next.js Choice](./001-why-nextjs.md)
- [ADR 006: Security Architecture](./006-security.md)

## References

- [NextAuth.js Documentation](https://authjs.dev/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [SAML 2.0 Specification](http://saml.xml.org/saml-specifications)
