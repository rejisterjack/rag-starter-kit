# Video Script: Technical Architecture Overview

## Overview
- **Title**: "RAG Starter Kit: Technical Deep Dive"
- **Duration**: 15-20 minutes
- **Target Audience**: Technical evaluators, architects, senior developers
- **Goal**: Explain architecture decisions and implementation details

---

## Scene 1: Introduction (2 minutes)

**Visual**: System architecture diagram

**Script**:
> "Today we're diving deep into the RAG Starter Kit architecture. This isn't just another chatbot template - it's a production-grade system designed for scalability, security, and maintainability. We'll cover the tech stack choices, data flow, security model, and how everything fits together."

**Agenda**:
1. Tech Stack Overview
2. Frontend Architecture (Next.js App Router)
3. Backend & API Design
4. Database & Vector Search
5. RAG Pipeline Deep Dive
6. Authentication & Security
7. Real-time Features
8. Deployment Architecture

---

## Scene 2: Tech Stack Overview (2 minutes)

**Visual**: Tech stack visualization with logos

**Script**:
> "Let's start with the foundation. We chose Next.js 15 with the App Router for the frontend. This gives us Server Components by default, streaming support for AI responses, and a unified codebase for frontend and API routes."

**Stack breakdown**:
- **Framework**: Next.js 15, React 19, TypeScript 5.7
- **Styling**: Tailwind CSS 4, shadcn/ui, Framer Motion
- **AI**: Vercel AI SDK, OpenRouter, Google Gemini
- **Database**: PostgreSQL 16, pgvector, Prisma 7
- **Auth**: NextAuth.js v5, SAML, API Keys
- **Infra**: Docker, Inngest, Redis, MinIO

**Script**:
> "Every choice was deliberate. Next.js for the streaming-first AI SDK integration. PostgreSQL with pgvector to keep vector and relational data together. Prisma for type-safe database access."

---

## Scene 3: Frontend Architecture (3 minutes)

**Visual**: Code showing App Router structure

**Script**:
> "The App Router fundamentally changes how we build React apps. Server Components render on the server, reducing JavaScript sent to the client."

```typescript
// Server Component - no JS sent to client
async function DocumentList() {
  const documents = await prisma.document.findMany();
  return <DocumentGrid documents={documents} />;
}
```

**Visual**: Showing client/server boundary

> "Client Components are used sparingly for interactivity - chat input, file uploads, real-time features."

**Visual**: Component tree diagram

> "This architecture gives us the best of both worlds - fast initial loads from Server Components, rich interactivity where needed."

**Visual**: Streaming demo

> "Streaming is crucial for AI. The page renders immediately, and content streams in as it's generated."

---

## Scene 4: Backend & API Design (3 minutes)

**Visual**: API route structure

**Script**:
> "API routes are colocated with pages in the App Router. This keeps related code together."

```typescript
// Route handler with proper typing
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return unauthorized();
  
  const body = await req.json();
  const validated = chatSchema.parse(body);
  
  // Process...
}
```

**Visual**: Middleware flow diagram

> "Middleware handles cross-cutting concerns - rate limiting, CSRF protection, security headers - before requests hit your routes."

**Visual**: Error handling code

> "We use a consistent error format across all APIs, with proper HTTP status codes and typed error responses."

---

## Scene 5: Database & Vector Search (3 minutes)

**Visual**: Prisma schema highlights

**Script**:
> "The database schema centers on workspaces for multi-tenancy. Every table has a workspaceId for row-level isolation."

```prisma
model Document {
  id        String   @id @default(cuid())
  workspaceId String
  chunks    Chunk[]
  
  @@index([workspaceId])
}

model Chunk {
  id        String    @id @default(cuid())
  documentId String
  content   String
  embedding Unsupported("vector(768)")?
}
```

**Visual**: Vector search query

> "Vector search uses pgvector's HNSW index for fast similarity search. We combine this with full-text search for hybrid retrieval."

```sql
WITH vector_results AS (
  SELECT id, 1 - (embedding <=> query_embedding) as score
  FROM chunks
  ORDER BY embedding <=> query_embedding
  LIMIT 20
),
keyword_results AS (
  SELECT id, ts_rank(search_vector, query) as score
  FROM chunks
  WHERE search_vector @@ plainto_tsquery('english', query_text)
  LIMIT 20
)
-- Combine results...
```

**Visual**: Performance benchmarks

> "This hybrid approach gives us the semantic understanding of vectors plus the precision of keyword matching."

---

## Scene 6: RAG Pipeline Deep Dive (4 minutes)

**Visual**: Full pipeline diagram

**Script**:
> "The RAG pipeline has three stages: ingestion, retrieval, and generation. Let's trace a document through the system."

**Visual**: Ingestion flow

> "Stage 1 - Ingestion. Documents upload to S3-compatible storage. An Inngest event triggers processing."

```typescript
// Event-driven processing
await inngest.send({
  name: 'document/process',
  data: { documentId, storageKey },
});
```

> "The pipeline extracts text - using OCR for scanned PDFs - then chunks intelligently."

**Visual**: Chunking strategies

> "We support multiple chunking strategies. Recursive splitting respects paragraph boundaries. Semantic chunking uses AI to find natural breaks."

**Visual**: Embedding generation

> "Each chunk gets embedded using Google Gemini's API. These 768-dimensional vectors capture semantic meaning."

**Visual**: Retrieval flow

> "Stage 2 - Retrieval. User queries are embedded and searched against the vector index. We retrieve the top-K most similar chunks."

**Visual**: Prompt construction

> "Stage 3 - Generation. Retrieved chunks are formatted into a prompt with citations. The LLM generates a response using only the provided context."

**Visual**: Response with citations

> "Every claim is backed by a source citation. Click to verify."

---

## Scene 7: Authentication & Security (3 minutes)

**Visual**: Auth architecture diagram

**Script**:
> "Security is layered. At the perimeter, we have TLS 1.3, security headers, and rate limiting."

**Visual**: NextAuth configuration

> "NextAuth.js handles OAuth, credentials, and JWT sessions. We extend the JWT with workspace context for multi-tenancy."

```typescript
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.workspaceId = await getDefaultWorkspace(user.id);
    }
    return token;
  },
}
```

**Visual**: SAML flow diagram

> "Enterprise users get SAML SSO. We support Okta, Azure AD, and generic SAML 2.0."

**Visual**: API key security

> "API keys are hashed with SHA-256 before storage. Only the prefix is shown to users."

**Visual**: Audit log

> "Every action is logged - authentication events, document operations, permission changes. Immutable audit trails for compliance."

---

## Scene 8: Real-time Features (2 minutes)

**Visual**: WebSocket architecture

**Script**:
> "Real-time features use Socket.io over WebSockets, with HTTP fallback."

**Visual**: Presence system code

> "Presence tracking uses Redis for state management across server instances."

```typescript
// Presence tracking
socket.on('join', async (workspaceId) => {
  await redis.sadd(`presence:${workspaceId}`, userId);
  socket.to(workspaceId).emit('user:joined', { userId });
});
```

**Visual**: Typing indicators

> "Typing indicators throttle updates to prevent noise. Live cursors track user focus."

---

## Scene 9: Deployment Architecture (3 minutes)

**Visual**: Docker Compose diagram

**Script**:
> "For development, Docker Compose runs the full stack locally - PostgreSQL with pgvector, Redis, MinIO, Inngest, and the Next.js app."

**Visual**: Production architecture

> "Production deployment varies by platform. Vercel handles the Next.js app, with external database and Redis."

**Visual**: Kubernetes diagram

> "For scale, Kubernetes manages multiple app instances behind a load balancer, with persistent volumes for stateful services."

**Visual**: Monitoring stack

> "We include Plausible for privacy-focused analytics and health check endpoints for monitoring."

---

## Scene 10: Conclusion (1 minute)

**Visual**: Architecture summary diagram

**Script**:
> "This architecture gives you a production-ready RAG system that's secure, scalable, and maintainable. The modular design means you can swap components - different LLM providers, databases, or deployment targets - without rewriting the core."

**Visual**: GitHub repo, documentation

> "All of this is open source. Check the ADRs in the docs folder for deeper dives into each decision."

---

## Additional Resources

- Architecture Decision Records in `docs/adr/`
- Database schema in `prisma/schema.prisma`
- API documentation in `docs/api/`
- Contributing guide in `CONTRIBUTING.md`

## Production Notes

### Technical Requirements
- High-quality screen recording
- Code font: JetBrains Mono or Fira Code
- Diagram tool: Excalidraw or similar
- Recording: OBS or ScreenFlow

### Diagrams Needed
1. System architecture overview
2. RAG pipeline flow
3. Authentication sequence
4. Database ERD
5. Deployment options

### Code Snippets
- Keep under 20 lines visible
- Highlight key lines
- Use consistent color scheme
