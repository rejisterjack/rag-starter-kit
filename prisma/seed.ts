/**
 * Database Seed Script
 *
 * Populates the database with sample data for development and testing.
 * Includes a demo user, workspace, sample documents, and a conversation.
 *
 * Usage:
 *   pnpm db:seed
 *
 * Prerequisites:
 *   - Database must be running and migrated (pnpm db:migrate)
 *   - Prisma client must be generated (pnpm db:generate)
 */

import { hash } from 'bcryptjs';
// @ts-expect-error - Generated at runtime by `pnpm db:generate`
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

// Sample documents for the knowledge base
const SAMPLE_DOCUMENTS = [
  {
    name: 'Getting Started Guide.md',
    contentType: 'text/markdown',
    content: `# Getting Started with RAG Starter Kit

## Overview
RAG (Retrieval-Augmented Generation) combines information retrieval with language model generation to produce accurate, context-aware responses.

## How It Works
1. **Document Ingestion**: Upload documents (PDF, DOCX, TXT, MD) to the knowledge base
2. **Text Extraction**: Documents are parsed and extracted into raw text
3. **Chunking**: Text is split into overlapping chunks (default: 1000 chars with 200 overlap)
4. **Embedding**: Each chunk is converted to a vector using Google Gemini embeddings
5. **Storage**: Vectors are stored in PostgreSQL with pgvector extension

## Chat Flow
1. User sends a message
2. The message is embedded using the same embedding model
3. Vector similarity search finds the most relevant chunks
4. Relevant chunks are injected into the LLM prompt as context
5. The LLM generates a response grounded in the retrieved context
6. Source citations are attached to the response

## Configuration
- \`TOP_K_RETRIEVAL\`: Number of chunks to retrieve (default: 5)
- \`SIMILARITY_THRESHOLD\`: Minimum relevance score (default: 0.7)
- \`MAX_CHUNK_SIZE\`: Characters per chunk (default: 1000)
- \`CHUNK_OVERLAP\`: Overlap between consecutive chunks (default: 200)
`,
    sourceType: 'upload',
  },
  {
    name: 'API Reference.md',
    contentType: 'text/markdown',
    content: `# API Reference

## Authentication
All API requests require authentication via one of:
- **Session cookie**: Automatically set after OAuth login
- **API Key**: Pass via \`X-API-Key\` header

## Endpoints

### POST /api/chat
Send a message and receive a streaming RAG response.

**Request Body:**
\`\`\`json
{
  "messages": [
    { "role": "user", "content": "What is RAG?" }
  ],
  "conversationId": "optional-existing-id",
  "model": "deepseek/deepseek-chat:free"
}
\`\`\`

**Response:** Server-Sent Events stream with tokens.

### POST /api/ingest
Upload a document for ingestion.

**Request:** multipart/form-data with \`file\` field
**Response:**
\`\`\`json
{
  "id": "doc_abc123",
  "status": "PENDING",
  "message": "Document queued for processing"
}
\`\`\`

### GET /api/documents
List documents in the current workspace.

**Query Parameters:**
- \`status\`: Filter by status (PENDING, PROCESSING, COMPLETED, FAILED)
- \`limit\`: Number of results (default: 20, max: 100)
- \`cursor\`: Pagination cursor

### GET /api/health
Health check endpoint. Returns 200 with system status.

## Rate Limits
- Authenticated users: 100 requests/minute
- API keys: Configurable per key (default: 100/minute)
- Unauthenticated: 10 requests/minute
`,
    sourceType: 'upload',
  },
  {
    name: 'Architecture Overview.md',
    contentType: 'text/markdown',
    content: `# Architecture Overview

## System Design

The RAG Starter Kit follows a layered architecture:

### Presentation Layer
- **Next.js 15 App Router** with React Server Components
- **Streaming UI** for real-time chat responses
- **Tailwind CSS 4** with shadcn/ui component library
- **Progressive Web App** support

### Application Layer
- **API Routes** handle all backend logic
- **Middleware** handles auth, rate limiting, CSRF, security headers
- **Server Actions** for form submissions

### Service Layer
- **RAG Engine**: Orchestrates retrieval and generation
- **Auth Service**: NextAuth.js v5 with OAuth + credentials
- **Ingestion Service**: Document parsing, chunking, embedding
- **Export Service**: PDF/DOCX conversation export

### Data Layer
- **PostgreSQL 16** with pgvector for vector storage
- **Redis** (Upstash) for rate limiting and caching
- **Cloudinary** for file storage

### Background Processing
- **Inngest** for async document processing jobs
- Event-driven architecture for scalability

## Key Design Decisions
1. **No Docker in development** — uses managed cloud services for simplicity
2. **Free AI by default** — OpenRouter free models + Google Gemini embeddings
3. **Multi-tenant by design** — workspace isolation from day one
4. **Type-safe throughout** — Zod validation on all boundaries
`,
    sourceType: 'upload',
  },
];

async function main() {
  console.log('🌱 Seeding database...\n');

  // 1. Create demo user
  const passwordHash = await hash('demo-password-123', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@rag-starter-kit.dev' },
    update: {},
    create: {
      email: 'demo@rag-starter-kit.dev',
      name: 'Demo User',
      password: passwordHash,
      role: 'ADMIN',
      emailVerified: new Date(),
    },
  });
  console.log(`  ✅ User created: ${user.email} (password: demo-password-123)`);

  // 2. Create demo workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: {
      name: 'Demo Workspace',
      slug: 'demo-workspace',
      description: 'Sample workspace with demo documents for testing the RAG pipeline.',
      ownerId: user.id,
      settings: {
        defaultModel: 'deepseek/deepseek-chat:free',
        topK: 5,
        similarityThreshold: 0.7,
      },
    },
  });
  console.log(`  ✅ Workspace created: ${workspace.name} (slug: ${workspace.slug})`);

  // 3. Add user as workspace member
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });
  console.log('  ✅ User added as workspace owner');

  // 4. Create sample documents
  for (const doc of SAMPLE_DOCUMENTS) {
    const document = await prisma.document.upsert({
      where: {
        id: `seed-${doc.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
      },
      update: {},
      create: {
        id: `seed-${doc.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
        name: doc.name,
        contentType: doc.contentType,
        content: doc.content,
        size: Buffer.byteLength(doc.content, 'utf8'),
        sourceType: doc.sourceType,
        status: 'COMPLETED',
        userId: user.id,
        workspaceId: workspace.id,
      },
    });

    // Create chunks for the document (without embeddings — those need the embedding model)
    const chunkSize = 500;
    const overlap = 100;
    const chunks: string[] = [];
    const content = doc.content;

    for (let i = 0; i < content.length; i += chunkSize - overlap) {
      chunks.push(content.slice(i, i + chunkSize));
    }

    for (let idx = 0; idx < chunks.length; idx++) {
      await prisma.documentChunk.upsert({
        where: { id: `${document.id}-chunk-${idx}` },
        update: {},
        create: {
          id: `${document.id}-chunk-${idx}`,
          documentId: document.id,
          content: chunks[idx],
          index: idx,
          start: idx * (chunkSize - overlap),
          end: Math.min(idx * (chunkSize - overlap) + chunkSize, content.length),
        },
      });
    }

    console.log(`  ✅ Document: ${doc.name} (${chunks.length} chunks)`);
  }

  // 5. Create a sample conversation
  const chat = await prisma.chat.upsert({
    where: { id: 'seed-demo-chat' },
    update: {},
    create: {
      id: 'seed-demo-chat',
      title: 'Welcome Conversation',
      model: 'deepseek/deepseek-chat:free',
      userId: user.id,
      workspaceId: workspace.id,
    },
  });

  await prisma.message.upsert({
    where: { id: 'seed-msg-1' },
    update: {},
    create: {
      id: 'seed-msg-1',
      chatId: chat.id,
      role: 'USER',
      content: 'What is RAG and how does it work in this project?',
    },
  });

  await prisma.message.upsert({
    where: { id: 'seed-msg-2' },
    update: {},
    create: {
      id: 'seed-msg-2',
      chatId: chat.id,
      role: 'ASSISTANT',
      content: `RAG (Retrieval-Augmented Generation) is a technique that combines information retrieval with language model generation to produce accurate, context-aware responses.

In this project, the RAG pipeline works as follows:

1. **Document Ingestion**: Documents are uploaded, parsed, and split into chunks
2. **Embedding**: Each chunk is converted to a vector embedding using Google Gemini
3. **Storage**: Vectors are stored in PostgreSQL with the pgvector extension
4. **Retrieval**: When you ask a question, it's embedded and compared against stored vectors
5. **Generation**: The most relevant chunks are passed to the LLM as context for generating a response

This ensures responses are grounded in your actual documents rather than relying solely on the model's training data.`,
      sources: JSON.stringify([
        { documentName: 'Getting Started Guide.md', chunkIndex: 0, similarity: 0.92 },
        { documentName: 'Architecture Overview.md', chunkIndex: 2, similarity: 0.85 },
      ]),
    },
  });

  console.log(`  ✅ Sample conversation created with 2 messages`);

  // 6. Create a sample Plan (free tier)
  await prisma.plan.upsert({
    where: { name: 'free' },
    update: {},
    create: {
      name: 'free',
      displayName: 'Free',
      description: 'For personal projects and experimentation',
      priceMonth: 0,
      priceYear: 0,
      maxWorkspaces: 1,
      maxDocuments: 10,
      maxStorageBytes: BigInt(104857600), // 100MB
      maxMessages: 100,
      maxApiCalls: 1000,
      features: {
        rag: true,
        voiceInput: true,
        export: false,
        collaboration: false,
        analytics: false,
      },
      isActive: true,
      sortOrder: 0,
    },
  });

  await prisma.plan.upsert({
    where: { name: 'pro' },
    update: {},
    create: {
      name: 'pro',
      displayName: 'Pro',
      description: 'For teams and production workloads',
      priceMonth: 2900, // $29
      priceYear: 29000, // $290
      maxWorkspaces: 10,
      maxDocuments: 500,
      maxStorageBytes: BigInt(10737418240), // 10GB
      maxMessages: 10000,
      maxApiCalls: 50000,
      features: {
        rag: true,
        voiceInput: true,
        export: true,
        collaboration: true,
        analytics: true,
        prioritySupport: true,
      },
      isActive: true,
      sortOrder: 1,
    },
  });

  console.log('  ✅ Plans created (free, pro)');

  console.log('\n✨ Seeding complete!\n');
  console.log('  Login credentials:');
  console.log('    Email:    demo@rag-starter-kit.dev');
  console.log('    Password: demo-password-123\n');
  console.log('  Note: Document embeddings are not generated during seeding.');
  console.log('  To generate embeddings, upload a document through the UI or');
  console.log('  run the ingestion pipeline: pnpm eval\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
