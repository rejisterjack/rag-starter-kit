# Customization Guide

This guide explains how to customize the RAG Starter Kit for your specific needs.

## Table of Contents

- [Model Configuration](#model-configuration)
- [Chunking Strategy](#chunking-strategy)
- [UI Customization](#ui-customization)
- [Authentication](#authentication)
- [Deployment](#deployment)

## Model Configuration

### Changing the LLM

Edit `src/lib/rag/engine.ts`:

```typescript
export const defaultRAGConfig: RAGConfig = {
  // ... other options
  model: 'gpt-4o', // or 'gpt-4-turbo', 'gpt-3.5-turbo'
  temperature: 0.7,
  maxTokens: 4000,
};
```

### Changing the Embedding Model

```typescript
export function createEmbeddings(config?: Partial<RAGConfig>): OpenAIEmbeddings {
  return new OpenAIEmbeddings({
    modelName: 'text-embedding-3-large', // or 'text-embedding-ada-002'
    dimensions: 3072, // text-embedding-3-large supports 256-3072 dimensions
  });
}
```

### Using Other Providers

To use Anthropic Claude instead of OpenAI:

1. Install the package: `pnpm add @anthropic-ai/sdk`
2. Update `src/lib/ai/index.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';

export async function generateWithClaude(messages: Message[]) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  
  // Implementation...
}
```

## Chunking Strategy

### Adjusting Chunk Size

Edit `src/lib/rag/chunking/index.ts`:

```typescript
export const defaultChunkingOptions: ChunkingOptions = {
  chunkSize: 1500,  // Larger chunks for more context
  chunkOverlap: 300, // More overlap to preserve context
};
```

### Custom Separators

For code documentation:

```typescript
const codeSeparators = [
  '\nclass ',
  '\ndef ',
  '\nfunction ',
  '\n// ',
  '\n# ',
  '\n\n',
  '\n',
  ' ',
  '',
];
```

For legal documents:

```typescript
const legalSeparators = [
  '\n\nArticle ',
  '\n\nSection ',
  '\n\n§',
  '\n\n',
  '\n',
  '. ',
  ' ',
  '',
];
```

### Document-Type Specific Chunking

Edit the `calculateOptimalChunkSize` function in `src/lib/rag/chunking/index.ts`:

```typescript
export function calculateOptimalChunkSize(
  content: string,
  documentType: DocumentType
): ChunkingOptions {
  switch (documentType) {
    case 'PDF':
      // Academic papers need larger chunks
      return { chunkSize: 2000, chunkOverlap: 400 };
    case 'MD':
      // Markdown docs can be larger
      return { chunkSize: 3000, chunkOverlap: 500 };
    // ... add more cases
  }
}
```

## UI Customization

### Adding a New Theme

Edit `src/styles/globals.css`:

```css
[data-theme="custom"] {
  --background: 220 20% 10%;
  --foreground: 220 10% 95%;
  --primary: 250 100% 60%;
  --primary-foreground: 0 0% 100%;
  /* ... more variables */
}
```

### Customizing the Chat Interface

Edit `src/components/chat/chat-window.tsx` (create this file):

```typescript
'use client';

import { useChat } from '@/hooks/use-chat';

export function CustomChatWindow() {
  const { messages, input, handleSubmit, isLoading } = useChat();
  
  return (
    <div className="custom-chat-container">
      {/* Your custom UI */}
    </div>
  );
}
```

### Adding Loading Skeletons

```typescript
export function MessageSkeleton() {
  return (
    <div className="animate-pulse flex space-x-4">
      <div className="h-10 w-10 rounded-full bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2" />
      </div>
    </div>
  );
}
```

## Authentication

### Adding Google OAuth

1. Create OAuth credentials in Google Cloud Console
2. Add to `.env.local`:
   ```
   AUTH_GOOGLE_ID=your-client-id
   AUTH_GOOGLE_SECRET=your-client-secret
   ```
3. Update `src/lib/auth/index.ts`:

```typescript
import Google from 'next-auth/providers/google';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
});
```

### Adding Custom Credentials Provider

```typescript
import Credentials from 'next-auth/providers/credentials';

providers: [
  Credentials({
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      // Validate credentials
      const user = await validateCredentials(credentials);
      return user ? { id: user.id, email: user.email, name: user.name } : null;
    },
  }),
]
```

## Deployment

### Vercel Environment Variables

Required for production:

```bash
# Database
POSTGRES_PRISMA_URL=postgresql://...
POSTGRES_URL_NON_POOLING=postgresql://...

# Authentication
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=https://your-domain.com
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...

# AI
OPENAI_API_KEY=sk-...

# Background Jobs (Inngest)
INNGEST_SIGNING_KEY=...
```

### Docker Deployment

Build and run:

```bash
# Build
docker-compose -f docker/docker-compose.yml build

# Run
docker-compose -f docker/docker-compose.yml up -d

# View logs
docker-compose -f docker/docker-compose.yml logs -f app
```

### Self-Hosted PostgreSQL

Enable pgvector extension:

```sql
-- Connect to your database
psql -U postgres -d ragdb

-- Create extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify
SELECT * FROM pg_extension WHERE extname = 'vector';
```

## Performance Tuning

### Database Indexes

Add these indexes for better performance:

```sql
-- Vector similarity search index
CREATE INDEX ON document_chunks 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Document lookup by user
CREATE INDEX idx_documents_user_status ON documents(user_id, status);

-- Message lookup by chat
CREATE INDEX idx_messages_chat_created ON messages(chat_id, created_at);
```

### Caching

Add Redis caching for frequent queries:

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function getCachedChats(userId: string) {
  const cacheKey = `chats:${userId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached as string);
  }
  
  const chats = await getChatsByUserId(userId);
  await redis.setex(cacheKey, 300, JSON.stringify(chats)); // 5 min cache
  
  return chats;
}
```

### Rate Limiting

Implement rate limiting on API routes:

```typescript
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
});

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return new Response('Too many requests', { status: 429 });
  }
  
  // Process request...
}
```
