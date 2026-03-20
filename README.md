<div align="center">

# 🧠 RAG Starter Kit

**A production-ready, self-hosted RAG (Retrieval-Augmented Generation) chatbot boilerplate**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![LangChain](https://img.shields.io/badge/LangChain-🦜-green?style=flat-square)](https://js.langchain.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

[Live Demo](https://rag-starter-kit.vercel.app/) · [Documentation](./docs) · [Report Bug](../../issues) · [Request Feature](../../issues)

</div>

---

## ✨ Features

### Core RAG Features
- **🎨 Modern UI/UX**: Clean, responsive chat interface built with Next.js 15 and Tailwind CSS 4
- **🔍 Intelligent RAG Pipeline**: Context-aware responses using LangChain + pgvector
- **📄 Document Ingestion**: Upload and process PDFs, Word docs, text files, and web content
- **💾 Persistent Vector Storage**: PostgreSQL with pgvector extension for efficient similarity search
- **⚡ Real-time Streaming**: Lightning-fast token streaming using Vercel AI SDK
- **🔐 Authentication Ready**: NextAuth.js v5 integration with GitHub OAuth
- **📊 Background Jobs**: Inngest integration for document processing

### Infrastructure & Storage
- **🗄️ S3-Compatible Storage**: AWS S3, Cloudflare R2, or self-hosted MinIO
- **🐳 Docker Support**: Complete Docker Compose setup for development and production
- **🚀 Production Deploy**: One-click Vercel deploy with CI/CD workflows
- **📈 CI/CD Pipelines**: GitHub Actions for testing, building, and deployment

### Real-Time & Collaboration
- **💬 Real-time Collaboration**: WebSocket/SSE with typing indicators and presence
- **👥 Multi-user Rooms**: Workspaces and conversation rooms
- **🖱️ Cursor Sync**: Collaborative cursor positions
- **🔄 Background Sync**: Queue actions when offline, sync when reconnected

### Voice & PWA
- **🎙️ Voice Input/Output**: Speech-to-text and text-to-speech
- **🗣️ Voice Activity Detection**: Smart speech detection with configurable thresholds
- **👋 Wake Word Detection**: "Hey RAG", "OK Assistant" with custom wake words
- **📱 PWA Support**: Offline-capable with service workers and background sync
- **📲 Install Prompt**: Native app installation on mobile and desktop

### Monitoring & Analytics
- **🐛 Error Tracking**: Sentry integration with session replay
- **📊 Product Analytics**: PostHog for event tracking and session recording
- **🔍 Audit Logging**: Comprehensive security audit trail
- **⚠️ Rate Limiting**: Redis-based rate limiting

### Developer Experience
- **🧪 Testing Setup**: Vitest + React Testing Library + Playwright E2E
- **🔒 Type-Safe**: Strict TypeScript configuration throughout
- **📝 Comprehensive Docs**: Architecture guides and API documentation
- **🎭 Feature Flags**: Runtime feature toggles via PostHog

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** — App Router, React Server Components, Partial Prerendering
- **React 19** — Latest React features and improvements
- **Tailwind CSS 4** — Utility-first styling with dark mode support
- **shadcn/ui** — Accessible, composable UI components
- **TanStack Query** — Server state management and caching
- **Zustand** — Client state management
- **Vercel AI SDK** — Stream-ready AI integration

### Backend & AI
- **LangChain.js** — Orchestration framework for LLM applications
- **OpenAI API** — GPT-4o-mini for completions, text-embedding-3-small for embeddings
- **pgvector** — Vector similarity search in PostgreSQL
- **Inngest** — Background job processing
- **Next.js API Routes** — Serverless backend endpoints

### Database & Storage
- **PostgreSQL 15+** — Relational database with JSON support
- **pgvector Extension** — High-performance vector operations
- **Vercel Postgres** — Managed database with zero-config setup
- **Prisma ORM** — Type-safe database access

### Development Tools
- **TypeScript 5.7+** — Strict type checking
- **ESLint 9** — Modern flat config with Next.js rules
- **Prettier** — Code formatting with Tailwind plugin
- **Husky + lint-staged** — Git hooks for code quality
- **Vitest** — Unit and integration testing

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ and pnpm (recommended) or npm
- OpenAI API key
- PostgreSQL database with pgvector extension (local or Vercel Postgres)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/rag-starter-kit.git
cd rag-starter-kit
pnpm install
```

### 2. Environment Setup

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
# Database
POSTGRES_PRISMA_URL="postgresql://postgres:postgres@localhost:5432/ragdb?schema=public&pgbouncer=true"
POSTGRES_URL_NON_POOLING="postgresql://postgres:postgres@localhost:5432/ragdb?schema=public"

# OpenAI
OPENAI_API_KEY="sk-your-openai-key"

# NextAuth.js
NEXTAUTH_SECRET="your-secret-key-min-32-chars-long"
NEXTAUTH_URL="http://localhost:3000"

# OAuth (GitHub)
AUTH_GITHUB_ID="your-github-oauth-app-id"
AUTH_GITHUB_SECRET="your-github-oauth-app-secret"

# Inngest (Background jobs)
INNGEST_EVENT_KEY="local"
INNGEST_SIGNING_KEY="signkey-test-123456789"
```

### 3. Database Setup

**Option A: Local PostgreSQL with Docker**
```bash
# Start PostgreSQL with pgvector
docker-compose -f docker/docker-compose.yml up -d db

# Run migrations
pnpm db:migrate

# Generate Prisma client
pnpm db:generate
```

**Option B: Vercel Postgres**
```bash
# Connect to Vercel Postgres and run migrations
pnpm db:migrate:prod
```

### 4. Run Development Server

```bash
# Terminal 1: Next.js dev server
pnpm dev

# Terminal 2: Inngest dev server (for background jobs)
pnpm inngest:dev
```

Open [http://localhost:3000](http://localhost:3000) — your RAG chatbot is live! 🎉

## 🐳 Docker Deployment

Build and run with Docker Compose:

```bash
cd docker
docker-compose up --build
```

This will start:
- Next.js app on port 3000
- PostgreSQL with pgvector on port 5432
- Inngest dev server on port 8288

## ☁️ Vercel Deployment

Deploy instantly to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/rag-starter-kit&env=OPENAI_API_KEY,NEXTAUTH_SECRET,AUTH_GITHUB_ID,AUTH_GITHUB_SECRET)

**Required Environment Variables:**
- `OPENAI_API_KEY` — Your OpenAI API key
- `NEXTAUTH_SECRET` — Random string for JWT encryption (generate with `openssl rand -base64 32`)
- `AUTH_GITHUB_ID` & `AUTH_GITHUB_SECRET` — GitHub OAuth credentials

## 📁 Project Structure

```
rag-starter-kit/
├── src/
│   ├── app/                    # Next.js 15 App Router
│   │   ├── (auth)/            # Authentication routes
│   │   │   └── login/
│   │   ├── (chat)/            # Chat routes
│   │   │   ├── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (admin)/           # Admin routes
│   │   ├── api/               # API routes
│   │   │   ├── auth/[...nextauth]/
│   │   │   ├── chat/
│   │   │   ├── ingest/
│   │   │   └── inngest/
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Landing page
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── chat/              # Chat-specific components
│   │   └── providers.tsx      # Context providers
│   ├── lib/
│   │   ├── ai/                # AI SDK configuration
│   │   ├── auth/              # NextAuth configuration
│   │   ├── db/                # Database queries
│   │   ├── inngest/           # Background job functions
│   │   ├── rag/               # RAG pipeline
│   │   │   ├── chunking/      # Text chunking strategies
│   │   │   ├── retrieval/     # Vector search
│   │   │   ├── ingestion/     # Document parsing
│   │   │   └── engine.ts      # RAG orchestration
│   │   └── utils.ts           # Utility functions
│   ├── hooks/                 # Custom React hooks
│   ├── types/                 # TypeScript types
│   └── styles/                # Global styles
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── tests/
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   ├── e2e/                   # E2E tests
│   └── setup.ts               # Test setup
├── docker/
│   ├── Dockerfile             # Production Dockerfile
│   └── docker-compose.yml     # Docker Compose config
├── docs/
│   ├── architecture.md        # System architecture
│   └── customization.md       # Customization guide
└── Configuration files (next.config.ts, tailwind.config.ts, etc.)
```

## 🧠 RAG Architecture

```mermaid
graph TD
    A[User Query] --> B[Embedding Model<br/>text-embedding-3-small]
    B --> C[Vector Search<br/>pgvector]
    C --> D[Relevant Chunks]
    D --> E[LLM Context<br/>GPT-4o-mini]
    E --> F[Streaming Response]
    
    G[Document Upload] --> H[Text Extraction<br/>PDF/DOCX/TXT]
    H --> I[Chunking Strategy<br/>Recursive Splitter]
    I --> J[Embeddings<br/>Background Job]
    J --> K[(PostgreSQL<br/>pgvector)]
```

## 🧪 Testing

```bash
# Run unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage
```

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build production bundle |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Fix ESLint errors |
| `pnpm type-check` | Run TypeScript type checking |
| `pnpm format` | Format code with Prettier |
| `pnpm test` | Run tests |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm inngest:dev` | Start Inngest dev server |

## 📚 Documentation

- [Architecture Guide](./docs/architecture.md) — System design and data flow
- [Customization Guide](./docs/customization.md) — How to customize models, UI, and more

## 🔒 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PRISMA_URL` | Yes | PostgreSQL connection URL with pgbouncer |
| `POSTGRES_URL_NON_POOLING` | Yes | Direct PostgreSQL connection URL |
| `OPENAI_API_KEY` | Yes | OpenAI API key for embeddings and chat |
| `NEXTAUTH_SECRET` | Yes | Secret for JWT signing |
| `NEXTAUTH_URL` | Yes | Base URL of the application |
| `AUTH_GITHUB_ID` | Yes* | GitHub OAuth app ID |
| `AUTH_GITHUB_SECRET` | Yes* | GitHub OAuth app secret |
| `INNGEST_EVENT_KEY` | No | Inngest event key (default: 'local') |
| `INNGEST_SIGNING_KEY` | No | Inngest signing key |

*Required for GitHub authentication

## 🛡️ Security

- ✅ API routes protected with NextAuth.js session
- ✅ Row-level security via userId associations
- ✅ Input sanitization and validation with Zod
- ✅ Secure credential storage in environment variables
- ✅ TypeScript strict mode for type safety

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

Distributed under the MIT License. See [`LICENSE`](./LICENSE) for more information.

## 💡 Inspiration

Built with ❤️ to accelerate AI-powered application development. Special thanks to:
- [LangChain](https://js.langchain.com/) team for the incredible framework
- [Vercel](https://vercel.com) for the AI SDK and deployment platform
- [shadcn/ui](https://ui.shadcn.com/) for the beautiful component library
- [Inngest](https://www.inngest.com/) for background job infrastructure

---

<div align="center">

**[⭐ Star this repo](https://github.com/yourusername/rag-starter-kit)** if you find it helpful!

Built by [Your Name](https://yourportfolio.com) · Powered by OpenAI + Vercel

</div>
