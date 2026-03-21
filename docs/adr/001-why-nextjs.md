# ADR 001: Why Next.js for RAG Starter Kit

## Status

**Accepted** - March 2024

## Context

We needed to choose a frontend framework for building a production-ready RAG chatbot application. The application requires:

- Server-side rendering for SEO and performance
- API routes for backend functionality
- Real-time capabilities for chat streaming
- Authentication and session management
- File upload and processing
- Database integration

## Decision

We chose **Next.js 15** with the App Router as our primary framework.

## Alternatives Considered

### 1. React SPA with Separate Backend

| Pros | Cons |
|------|------|
| Clear separation of concerns | Requires two deployments |
| Can use any backend (Express, Fastify) | CORS complexity |
| Familiar to many developers | No SSR, worse SEO |
| | Double authentication handling |

**Verdict**: Rejected - adds unnecessary complexity for a unified application.

### 2. Nuxt.js (Vue)

| Pros | Cons |
|------|------|
| Similar feature set to Next.js | Smaller ecosystem |
| Vue's simplicity | Team expertise in React |
| Good performance | Fewer AI/ML integrations |

**Verdict**: Rejected - React ecosystem better suited for AI SDKs.

### 3. SvelteKit

| Pros | Cons |
|------|------|
| Excellent performance | Smaller community |
| Less boilerplate | Fewer enterprise libraries |
| Built-in animations | AI SDK support limited |

**Verdict**: Rejected - ecosystem maturity concerns.

### 4. Remix

| Pros | Cons |
|------|------|
| Web standards focused | Smaller ecosystem |
| Great form handling | Streaming less mature |
| Nested routing | Vercel AI SDK integration |

**Verdict**: Rejected - Next.js has better AI/LLM integration.

## Why Next.js Won

### 1. **Vercel AI SDK Integration**

```typescript
// First-class streaming support
import { streamText } from 'ai';

const result = streamText({
  model: openrouter.chat('deepseek/deepseek-chat:free'),
  messages,
});

// Works seamlessly with Next.js streaming
return result.toDataStreamResponse();
```

### 2. **App Router Architecture**

```
app/
├── api/              # API routes colocated with frontend
├── chat/
│   ├── page.tsx      # Server component
│   ├── layout.tsx    # Shared layout
│   └── loading.tsx   # Suspense fallback
└── layout.tsx        # Root layout
```

### 3. **Server Components by Default**

- Direct database access without API layer
- Reduced JavaScript bundle size
- Better initial page load
- Streaming SSR

### 4. **Middleware Support**

```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  // Rate limiting, auth checks, redirects
  // Runs at the edge
}
```

### 5. **Built-in Optimizations**

- Image optimization
- Font optimization
- Script optimization
- CSS support (Tailwind)

## Consequences

### Positive

- **Unified codebase**: Frontend and backend in one repo
- **Type safety**: Shared types between client and server
- **Streaming**: Native support for AI streaming responses
- **Deployment**: Simple deployment to Vercel or Docker
- **Ecosystem**: Rich ecosystem of React components

### Negative

- **Learning curve**: App Router patterns are new
- **Vendor lock-in**: Tied to Vercel's ecosystem
- **Build time**: Slower builds than simple SPAs
- **Complexity**: More concepts to learn (Server Components, etc.)

## Related Decisions

- [ADR 002: Database Choice](./002-database-choice.md)
- [ADR 003: AI Provider Strategy](./003-ai-provider-strategy.md)

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [React Server Components](https://react.dev/blog/2023/03/22/react-server-components)
