/**
 * Prisma Seed Script
 *
 * Populates the database with demo data so that:
 * 1. The /demo route has pre-loaded documents and sample chats
 * 2. Local development starts with data to test against
 * 3. CI/CD environments have reproducible baseline state
 *
 * Run: pnpm db:seed
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { Pool } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Sample document content for the RAG knowledge base
// ---------------------------------------------------------------------------

const SAMPLE_DOCUMENTS = [
  {
    name: 'RAG Starter Kit — Product Overview',
    contentType: 'text/markdown',
    content: `# RAG Starter Kit — Product Overview

## What is RAG Starter Kit?

RAG Starter Kit is a production-ready, TypeScript-native Retrieval-Augmented Generation (RAG) platform. It lets you build a document chatbot in under 10 minutes — without Python, without paid API credits, and without managing infrastructure.

## Core Capabilities

### Document Ingestion
- Upload PDF, DOCX, Markdown, TXT files or paste a URL
- Background processing via Inngest handles chunking and embedding automatically
- Duplicate detection prevents re-indexing the same content
- OCR support for image-heavy PDFs via Tesseract.js

### Vector Search
- Embeddings stored in PostgreSQL using the pgvector extension
- HNSW index for sub-millisecond approximate nearest-neighbour search
- Hybrid search combines vector similarity with full-text keyword matching
- Configurable similarity threshold and top-K retrieval count

### AI Chat
- Streaming token generation via Server-Sent Events (SSE)
- Source citations displayed for every answer
- Conversation memory across multi-turn sessions
- Multiple LLM providers: OpenRouter, OpenAI, Anthropic, Ollama

### Voice Features
- Speech-to-text via Web Speech API and/or OpenAI Whisper
- Text-to-speech synthesis via browser SpeechSynthesis API
- Wake word detection ("Hey RAG") for hands-free operation

## Deployment

One-click deployment to Vercel, Railway, or Render. Or self-host with Docker on any Node.js platform.

## Pricing

Entirely free for self-hosted deployments. Uses OpenRouter free-tier models for chat and Google Gemini free-tier embeddings (1,500 requests/day).
`,
    size: 1580,
  },
  {
    name: 'Getting Started Guide',
    contentType: 'text/markdown',
    content: `# Getting Started with RAG Starter Kit

## Prerequisites

- Node.js 20 or higher
- pnpm 9 or higher
- A free OpenRouter API key (https://openrouter.ai/keys)
- A free Google AI Studio API key (https://aistudio.google.com/app/apikey)

## Step 1: Clone the Repository

\`\`\`bash
git clone https://github.com/rejisterjack/rag-starter-kit.git
cd rag-starter-kit
\`\`\`

## Step 2: Configure Environment Variables

\`\`\`bash
cp .env.example .env
\`\`\`

Open .env and set these required variables:

\`\`\`
DATABASE_URL=postgresql://...         # Your PostgreSQL connection string
NEXTAUTH_SECRET=...                    # Generate: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000     # Your app URL
OPENROUTER_API_KEY=sk-or-...           # From openrouter.ai/keys
\`\`\`

## Step 3: Install Dependencies and Run Migrations

\`\`\`bash
pnpm install
pnpm db:migrate
pnpm db:seed        # Load demo data
\`\`\`

## Step 4: Start the Development Server

\`\`\`bash
pnpm dev
\`\`\`

Open http://localhost:3000 in your browser.

## Step 5: Upload Your First Document

1. Sign in (or use the demo account: demo@rag-starter.dev / Demo1234!)
2. Navigate to the Admin dashboard (/admin)
3. Click "Upload Document" and select a PDF or Markdown file
4. Wait for the green "Ready" status indicator
5. Go to the Chat page and ask a question about your document

## Common Configuration Options

| Variable | Default | Description |
|---|---|---|
| MAX_CHUNK_SIZE | 1000 | Characters per document chunk |
| CHUNK_OVERLAP | 200 | Overlap between adjacent chunks |
| TOP_K_RETRIEVAL | 5 | Number of chunks to retrieve per query |
| SIMILARITY_THRESHOLD | 0.7 | Minimum similarity score (0-1) |
| DEFAULT_MODEL | deepseek/deepseek-chat:free | LLM model identifier |
| RETRIEVAL_DEBUG | false | Show retrieved chunks in API response |

## Troubleshooting

**"Environment validation failed"**
The startup check will name the exact missing variable. Check your .env file.

**Embedding errors**
Verify your Google AI Studio API key is correct and hasn't hit its daily quota (1,500 requests/day on free tier).

**Document stuck in PENDING status**
Inngest background jobs may not be running. Start the Inngest dev server: npx inngest-cli@latest dev

**WebSocket connection errors**
Ensure NEXT_PUBLIC_APP_URL matches your browser URL exactly (including the port).
`,
    size: 2050,
  },
  {
    name: 'Frequently Asked Questions',
    contentType: 'text/markdown',
    content: `# Frequently Asked Questions

## General

**Q: Is this really free to run?**
A: Yes. The default configuration uses OpenRouter free-tier models (DeepSeek, Mistral, Llama, Gemma) for chat and Google Gemini free-tier embeddings. For development and light production usage, the total cost is $0.

**Q: Do I need to know Python?**
A: No. The entire stack is TypeScript — Next.js, LangChain.js, Prisma, Inngest. There is no Python anywhere in the codebase.

**Q: Can I use OpenAI or Anthropic instead of OpenRouter?**
A: Yes. Set LLM_PROVIDER=openai and OPENAI_API_KEY in your .env, or LLM_PROVIDER=anthropic and ANTHROPIC_API_KEY. The Vercel AI SDK abstracts the provider difference.

**Q: Can I run it locally without internet?**
A: Yes, with Ollama. Install Ollama, pull a model (e.g. ollama pull llama3.2), and set LLM_PROVIDER=ollama and OLLAMA_BASE_URL=http://localhost:11434.

## Documents

**Q: What file types are supported?**
A: PDF, DOCX, Markdown (.md), plain text (.txt), and web URLs. Files are uploaded to Cloudinary and processed asynchronously by Inngest.

**Q: What's the maximum file size?**
A: Cloudinary's free tier supports files up to 10MB. For larger files, upgrade your Cloudinary plan or configure a different storage provider.

**Q: How long does document processing take?**
A: Typically 5-30 seconds depending on file size and the number of chunks. You can watch real-time progress in the Admin dashboard.

**Q: Why is my document showing FAILED status?**
A: Check the Inngest dashboard (http://localhost:8288 in dev) for the error message. Common causes: unsupported file encoding, empty file, or API quota exceeded.

## Chat & Retrieval

**Q: How does source citation work?**
A: After each response, the chat UI shows which document chunks were retrieved and used. Each citation includes the document name, chunk index, and similarity score.

**Q: How do I improve answer quality?**
A: Try adjusting: lower SIMILARITY_THRESHOLD (retrieve more chunks, more context), increase TOP_K_RETRIEVAL (use more chunks per query), decrease MAX_CHUNK_SIZE (finer granularity), or enable RETRIEVAL_DEBUG=true to see exactly what's being retrieved.

**Q: Can multiple users share documents?**
A: Yes. Documents are scoped to workspaces. All workspace members can query the same knowledge base simultaneously.

## Authentication

**Q: How do I set up OAuth login?**
A: For GitHub: create an OAuth app at github.com/settings/developers and set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET. For Google: create credentials at console.cloud.google.com and set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.

**Q: Is there an admin account?**
A: Any user with role=ADMIN in the database can access /admin. The seed script creates an admin account (admin@rag-starter.dev) and a demo account (demo@rag-starter.dev).

## Deployment

**Q: How do I deploy to Vercel?**
A: Click the "Deploy to Vercel" button in the README, or run: vercel --prod. You'll need to set all environment variables in the Vercel dashboard.

**Q: Do I need Docker?**
A: No. The project uses managed cloud services (Neon PostgreSQL, Upstash Redis, Cloudinary, Inngest cloud) so you never need to manage containers in production. Docker is available for local development only.

**Q: How do I back up my data?**
A: Your data lives in your own PostgreSQL database (e.g., Neon). Use pg_dump or your host's backup facility. Documents are in your Cloudinary account.
`,
    size: 3200,
  },
  {
    name: 'Architecture & Technical Reference',
    contentType: 'text/markdown',
    content: `# Architecture & Technical Reference

## System Overview

RAG Starter Kit follows a layered architecture built on Next.js 15 App Router:

\`\`\`
Browser → CDN/Edge → Next.js Middleware → App Router → API Routes
                                                          ↓
                                              Service Layer (RAG, Auth, Chat)
                                                          ↓
                                              Data Layer (PostgreSQL, Redis, Cloudinary)
\`\`\`

## RAG Pipeline

### Ingestion Flow
1. User uploads file → stored in Cloudinary
2. Inngest job triggered with file URL
3. Text extracted (PDF: pdf-parse, DOCX: mammoth, URL: cheerio scraping)
4. Text split into chunks (configurable size + overlap)
5. Each chunk embedded via Google Gemini text-embedding-004 (768 dimensions)
6. Embeddings + metadata stored in PostgreSQL/pgvector
7. Document status updated to COMPLETED

### Query Flow
1. User message received at API route
2. Message embedded using same model as ingestion
3. HNSW approximate nearest-neighbour search on pgvector
4. Hybrid re-ranking: combine vector scores with BM25 keyword scores
5. Top-K chunks assembled into context window
6. System prompt + context + user message sent to LLM
7. Response streamed back via SSE
8. Message + sources saved to PostgreSQL

## Database Schema

### Key Tables
- users: authentication, MFA, SAML
- workspaces: multi-tenancy isolation
- documents: file metadata + processing status
- document_chunks: text + 768-dim vector embeddings
- chats + messages: conversation history with source citations
- audit_logs: immutable security event log
- rate_limits: sliding window rate limiting

### pgvector Index
\`\`\`sql
CREATE INDEX document_chunks_embedding_idx
ON document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
\`\`\`

Recommended parameters: m=16, ef_construction=64 for most use cases. Increase ef_construction to 128 for higher recall at the cost of slower index builds.

## Security Architecture

- Authentication: NextAuth.js v5 with JWT strategy (7-day expiry)
- Passwords: bcrypt with 12 rounds
- API keys: bcrypt-hashed, never stored in plaintext
- CSRF: HMAC SHA-256 double-submit cookie
- Rate limiting: Sliding window in Upstash Redis
- Audit logging: Hash-chained records for tamper detection
- Encryption: AES-256-GCM for SAML private keys and webhook secrets

## Environment Variables Reference

### Required
- DATABASE_URL: PostgreSQL connection string
- NEXTAUTH_SECRET: JWT signing key (min 32 chars)
- NEXTAUTH_URL: App base URL
- OPENROUTER_API_KEY: LLM API access

### Optional but Recommended for Production
- UPSTASH_REDIS_REST_URL + TOKEN: Rate limiting (in-memory fallback in dev)
- CLOUDINARY_URL: File storage (local filesystem fallback in dev)
- ENCRYPTION_MASTER_KEY: Required in production for SAML + webhook secret encryption
- INNGEST_SIGNING_KEY + EVENT_KEY: Background job authentication

### AI Configuration
- LLM_PROVIDER: openrouter | openai | anthropic | ollama (default: openrouter)
- DEFAULT_MODEL: Model identifier string
- GOOGLE_GENERATIVE_AI_API_KEY: Required for embeddings
- OLLAMA_BASE_URL: Local Ollama server URL

### RAG Tuning
- MAX_CHUNK_SIZE: 100-4000 (default: 1000)
- CHUNK_OVERLAP: 0-500 (default: 200)
- TOP_K_RETRIEVAL: 1-20 (default: 5)
- SIMILARITY_THRESHOLD: 0.0-1.0 (default: 0.7)
- RETRIEVAL_DEBUG: true/false — attach retrieved chunks to API response
`,
    size: 3400,
  },
];

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Starting database seed...');

  // -------------------------------------------------------------------------
  // 1. Admin user
  // -------------------------------------------------------------------------
  const adminPassword = await hash('Admin1234!', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@rag-starter.dev' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@rag-starter.dev',
      password: adminPassword,
      emailVerified: new Date(),
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin user: ${adminUser.email}`);

  // -------------------------------------------------------------------------
  // 2. Demo user
  // -------------------------------------------------------------------------
  const demoPassword = await hash('Demo1234!', 12);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@rag-starter.dev' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@rag-starter.dev',
      password: demoPassword,
      emailVerified: new Date(),
      role: 'USER',
    },
  });
  console.log(`✅ Demo user: ${demoUser.email}`);

  // -------------------------------------------------------------------------
  // 3. Demo workspace
  // -------------------------------------------------------------------------
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-workspace' },
    update: {},
    create: {
      name: 'Demo Workspace',
      slug: 'demo-workspace',
      description: 'Pre-loaded workspace with sample RAG Starter Kit documentation',
      ownerId: adminUser.id,
      settings: {},
    },
  });
  console.log(`✅ Workspace: ${workspace.name}`);

  // Add demo user as workspace member
  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: demoUser.id,
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      userId: demoUser.id,
      role: 'MEMBER',
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Demo user added to workspace`);

  // -------------------------------------------------------------------------
  // 4. Sample documents (metadata only — no actual embeddings in seed)
  // -------------------------------------------------------------------------
  for (const doc of SAMPLE_DOCUMENTS) {
    const existing = await prisma.document.findFirst({
      where: {
        name: doc.name,
        workspaceId: workspace.id,
      },
    });

    if (!existing) {
      const document = await prisma.document.create({
        data: {
          name: doc.name,
          contentType: doc.contentType,
          size: doc.size,
          content: doc.content,
          status: 'COMPLETED',
          userId: adminUser.id,
          workspaceId: workspace.id,
          metadata: {
            seeded: true,
            seedVersion: '1.0.0',
          },
        },
      });

      // Create a sample chunk for each document (without actual vector embeddings)
      // Real embeddings are created during actual ingestion via Inngest
      await prisma.documentChunk.create({
        data: {
          documentId: document.id,
          content: doc.content.slice(0, 800),
          index: 0,
          start: 0,
          end: Math.min(800, doc.content.length),
        },
      });

      console.log(`✅ Document: ${doc.name}`);
    } else {
      console.log(`⏭️  Skipped (exists): ${doc.name}`);
    }
  }

  // -------------------------------------------------------------------------
  // 5. Sample chat with pre-seeded messages demonstrating source citations
  // -------------------------------------------------------------------------
  const existingChat = await prisma.chat.findFirst({
    where: {
      userId: demoUser.id,
      title: 'What can this platform do?',
    },
  });

  if (!existingChat) {
    const chat = await prisma.chat.create({
      data: {
        title: 'What can this platform do?',
        userId: demoUser.id,
        workspaceId: workspace.id,
        model: 'deepseek/deepseek-chat:free',
        messages: {
          create: [
            {
              role: 'USER',
              content: 'What is RAG Starter Kit and what are its main features?',
            },
            {
              role: 'ASSISTANT',
              content:
                'RAG Starter Kit is a production-ready, TypeScript-native Retrieval-Augmented Generation platform. Here are its main features:\n\n**Core capabilities:**\n- 📄 **Document Ingestion** — Upload PDFs, DOCX, Markdown, TXT, or URLs. Background processing via Inngest handles chunking and embedding automatically.\n- 🔍 **Hybrid Search** — Combines pgvector similarity search with full-text keyword matching for better retrieval accuracy.\n- 💬 **Streaming Chat** — Real-time token streaming via SSE with source citations for every answer.\n- 🎙️ **Voice I/O** — Speech-to-text and text-to-speech built in.\n- 👥 **Multi-user Workspaces** — Team collaboration with role-based access control.\n- 🤖 **Agent Mode** — Tool-using AI with web search, calculator, and code execution.\n\n**Infrastructure included:**\n- NextAuth.js v5 authentication (OAuth + credentials)\n- Rate limiting via Upstash Redis\n- Audit logging with tamper-detection\n- PWA support for offline use\n- One-click deploy to Vercel\n\nThe default configuration uses **free AI models** — OpenRouter for chat and Google Gemini for embeddings — so it costs $0 to run.',
              sources: JSON.stringify([
                {
                  documentName: 'RAG Starter Kit — Product Overview',
                  chunkIndex: 0,
                  similarity: 0.94,
                },
                {
                  documentName: 'Getting Started Guide',
                  chunkIndex: 0,
                  similarity: 0.87,
                },
              ]),
            },
            {
              role: 'USER',
              content: 'How long does it take to set up?',
            },
            {
              role: 'ASSISTANT',
              content:
                'Setup takes under 10 minutes:\n\n1. **Clone the repo** — `git clone https://github.com/rejisterjack/rag-starter-kit.git`\n2. **Get 2 free API keys** — OpenRouter (for chat) and Google AI Studio (for embeddings). Both are free.\n3. **Copy `.env.example` to `.env`** and paste your keys\n4. **Run `pnpm install && pnpm dev`**\n5. **Open http://localhost:3000**\n\nThe only required environment variables are `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `OPENROUTER_API_KEY`. Everything else has sensible defaults or optional fallbacks.\n\nFor deployment to production, click the "Deploy to Vercel" button in the README and set those same four variables in the Vercel dashboard.',
              sources: JSON.stringify([
                {
                  documentName: 'Getting Started Guide',
                  chunkIndex: 0,
                  similarity: 0.96,
                },
              ]),
            },
          ],
        },
      },
    });
    console.log(`✅ Sample chat: "${chat.title}"`);
  } else {
    console.log(`⏭️  Skipped (exists): Sample chat`);
  }

  // -------------------------------------------------------------------------
  // 6. Seed plans (for billing schema completeness)
  // -------------------------------------------------------------------------
  await prisma.plan.upsert({
    where: { name: 'free' },
    update: {},
    create: {
      name: 'free',
      displayName: 'Self-Hosted (Free)',
      description: 'Full-featured self-hosted deployment. MIT licensed.',
      priceMonth: 0,
      priceYear: 0,
      maxWorkspaces: 1,
      maxDocuments: 100,
      maxStorageBytes: BigInt(1024 * 1024 * 1024), // 1GB
      maxMessages: 10000,
      maxApiCalls: 50000,
      features: {
        rag: true,
        voice: true,
        collaboration: true,
        agentMode: true,
        apiAccess: true,
        samlSso: false,
        prioritySupport: false,
      },
      isActive: true,
      sortOrder: 0,
    },
  });

  await prisma.plan.upsert({
    where: { name: 'cloud' },
    update: {},
    create: {
      name: 'cloud',
      displayName: 'Cloud Hosted',
      description: 'Managed cloud deployment. Coming soon.',
      priceMonth: 0,
      priceYear: 0,
      maxWorkspaces: 3,
      maxDocuments: 500,
      maxStorageBytes: BigInt(10 * 1024 * 1024 * 1024), // 10GB
      maxMessages: 100000,
      maxApiCalls: 500000,
      features: {
        rag: true,
        voice: true,
        collaboration: true,
        agentMode: true,
        apiAccess: true,
        managedInfra: true,
        samlSso: false,
        prioritySupport: true,
      },
      isActive: false, // Not yet launched
      sortOrder: 1,
    },
  });

  await prisma.plan.upsert({
    where: { name: 'enterprise' },
    update: {},
    create: {
      name: 'enterprise',
      displayName: 'Enterprise',
      description: 'Dedicated infrastructure with SLA. Contact us.',
      priceMonth: 0,
      priceYear: 0,
      maxWorkspaces: -1, // unlimited
      maxDocuments: -1,
      maxStorageBytes: BigInt(-1), // unlimited
      maxMessages: -1,
      maxApiCalls: -1,
      features: {
        rag: true,
        voice: true,
        collaboration: true,
        agentMode: true,
        apiAccess: true,
        managedInfra: true,
        samlSso: true,
        dedicatedInfra: true,
        customSla: true,
        prioritySupport: true,
        whiteLabel: true,
      },
      isActive: true,
      sortOrder: 2,
    },
  });

  console.log(`✅ Plans seeded (free, cloud, enterprise)`);

  console.log('\n🎉 Seed complete!');
  console.log('\nDemo accounts:');
  console.log('  Admin: admin@rag-starter.dev / Admin1234!');
  console.log('  Demo:  demo@rag-starter.dev  / Demo1234!');
  console.log('\nSample documents loaded into "Demo Workspace".');
  console.log(
    'Note: Vector embeddings are not seeded — upload real documents to enable RAG search.\n'
  );
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
