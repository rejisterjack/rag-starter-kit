# Architecture Documentation

## System Overview

The RAG Starter Kit is a modern, production-ready chatbot application built with Next.js 15, leveraging Retrieval-Augmented Generation (RAG) for context-aware AI responses.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Chat UI     │  │ Auth UI      │  │ Upload UI    │  │ Admin UI     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                                              │
│  Tech: React 19, Tailwind CSS 4, shadcn/ui, Zustand, React Query            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Next.js 15 App Router                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Server Components                              │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  App Router │ Server Actions │ React Server Components               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        API Routes                                     │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  /api/chat      │ Streaming chat endpoint                             │   │
│  │  /api/ingest    │ Document upload & processing                        │   │
│  │  /api/inngest   │ Background job handler                              │   │
│  │  /api/auth/*    │ NextAuth.js authentication                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RAG Pipeline Layer                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   Ingestion     │───▶│    Chunking     │───▶│   Embeddings    │         │
│  │                 │    │                 │    │                 │         │
│  │  PDF/DOCX/TXT   │    │  Recursive      │    │  OpenAI         │         │
│  │  Parsing        │    │  Splitter       │    │  text-embedding │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │    Storage      │◀───│   Vector DB     │◀───│   Background    │         │
│  │                 │    │                 │    │   Jobs (Inngest)│         │
│  │  Document       │    │  pgvector       │    │                 │         │
│  │  Metadata       │    │  Cosine Similarity    │  Async          │         │
│  │                 │    │                 │    │  Processing     │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Retrieval & Generation                         │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  Query ──▶ Embedding ──▶ Vector Search ──▶ Context Builder          │   │
│  │                                          │                            │   │
│  │                                          ▼                            │   │
│  │                              LLM (GPT-4o-mini)                       │   │
│  │                                          │                            │   │
│  │                                          ▼                            │   │
│  │                              Streaming Response                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Tech: LangChain.js, Vercel AI SDK, OpenAI API                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Data Layer                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    PostgreSQL + pgvector                              │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │   │
│  │  │  users   │ │  chats   │ │ messages │ │documents │ │   chunks   │ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────────┘ │   │
│  │                                                                      │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                │   │
│  │  │ accounts │ │ sessions │ │ingestion │ │ api_usage│                │   │
│  │  │(nextauth)│ │(nextauth)│ │   jobs   │ │          │                │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Tech: Prisma ORM, @vercel/postgres                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend Layer

- **Chat Interface**: Real-time streaming chat with message history
- **Document Upload**: Drag-and-drop file upload with progress tracking
- **Authentication**: GitHub OAuth integration via NextAuth.js v5
- **State Management**: Zustand for client state, React Query for server state

### RAG Pipeline

1. **Document Ingestion**
   - Supports PDF, DOCX, TXT, MD, HTML formats
   - Extracts text content using format-specific parsers
   - Stores original document and metadata

2. **Chunking Strategy**
   - Recursive Character Text Splitter
   - Configurable chunk size and overlap
   - Preserves document structure

3. **Embedding Generation**
   - OpenAI text-embedding-3-small (1536 dimensions)
   - Batch processing for efficiency
   - Stored in pgvector as vector(1536)

4. **Retrieval**
   - Cosine similarity search
   - Configurable top-k and threshold
   - User-scoped document filtering

5. **Generation**
   - GPT-4o-mini for completions
   - Streaming response via Vercel AI SDK
   - Context-aware prompt engineering

### Data Model

See `prisma/schema.prisma` for complete schema definition.

Key entities:
- **User**: Authentication and ownership
- **Chat**: Conversation containers
- **Message**: Individual chat messages with sources
- **Document**: Uploaded files with processing status
- **DocumentChunk**: Text chunks with vector embeddings
- **IngestionJob**: Background processing tracking

## Deployment Architecture

### Vercel (Recommended)

```
┌─────────────────┐
│  Vercel Edge    │  Next.js App Router
│  Network        │  Serverless Functions
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Vercel Postgres│  Managed PostgreSQL
│  (Neon)         │  with pgvector
└─────────────────┘
```

### Docker (Self-Hosted)

```
┌─────────────────┐
│  Next.js App    │  Container 1
│  (Port 3000)    │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│PostgreSQL│ │ Inngest │  Containers 2, 3
│+pgvector │ │ (Jobs)  │
│(5432)  │ │ (8288)  │
└────────┘ └────────┘
```

## Security Considerations

- Row-level security via userId associations
- API route authentication via NextAuth.js session
- Rate limiting on chat endpoints (implement with Upstash Redis)
- Secure credential storage in environment variables
- Input sanitization for document content
