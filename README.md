<div align="center">

# 🧠 RAG Starter Kit

**A production-ready, self-hosted RAG (Retrieval-Augmented Generation) chatbot boilerplate**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169E1?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![LangChain](https://img.shields.io/badge/LangChain-🦜-green?style=flat-square)](https://js.langchain.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

[Live Demo](https://rag-starter-kit.vercel.app/) · [Documentation](./docs) · [Report Bug](../../issues) · [Request Feature](../../issues)

</div>

---

## ✨ Features

### Core RAG Features
- **🎨 Modern UI/UX** — Clean, responsive chat interface built with Next.js 15 and Tailwind CSS 4
- **🔍 Intelligent RAG Pipeline** — Context-aware responses using LangChain + pgvector
- **📄 Document Ingestion** — Upload and process PDFs, Word docs, text files, and web content
- **💾 Persistent Vector Storage** — PostgreSQL 16 with pgvector for efficient similarity search
- **⚡ Real-time Streaming** — Lightning-fast token streaming using Vercel AI SDK
- **🔐 Authentication** — NextAuth.js v5 with GitHub / Google OAuth
- **📊 Background Jobs** — Inngest integration for async document processing

### Infrastructure & Storage
- **🗄️ S3-Compatible Storage** — AWS S3, Cloudflare R2, or self-hosted MinIO
- **🐳 Docker Support** — Complete Docker Compose setup for development and production
- **🚀 Vercel Deploy** — One-click deploy with CI/CD workflows
- **📈 CI/CD Pipelines** — GitHub Actions for testing, building, and deployment

### Real-Time & Collaboration
- **💬 Real-time Collaboration** — WebSocket/SSE with typing indicators and presence
- **👥 Multi-user Workspaces** — Workspace rooms with role-based access
- **🔄 Background Sync** — Queue actions when offline, sync when reconnected

### Voice & PWA
- **🎙️ Voice Input/Output** — Speech-to-text and text-to-speech
- **📱 PWA Support** — Offline-capable with service workers and background sync

### Monitoring & Analytics
- **🐛 Error Tracking** — Sentry integration with session replay
- **📊 Product Analytics** — PostHog for event tracking and session recording
- **🔍 Audit Logging** — Comprehensive security audit trail
- **⚠️ Rate Limiting** — Upstash Redis-based rate limiting

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router, RSC, Streaming) |
| **UI** | React 19, Tailwind CSS 4, shadcn/ui |
| **AI / RAG** | LangChain.js, Vercel AI SDK, OpenAI |
| **Database** | PostgreSQL 16 + pgvector |
| **ORM** | Prisma 7 + `@prisma/adapter-pg` |
| **Auth** | NextAuth.js v5 (Auth.js) |
| **Storage** | AWS S3 / Cloudflare R2 / MinIO |
| **Background Jobs** | Inngest |
| **State** | TanStack Query + Zustand |
| **Testing** | Vitest + Playwright |
| **Linting** | Biome |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** and **pnpm 9+**
- **Docker & Docker Compose** (for local PostgreSQL + MinIO)
- **OpenAI API key**

---

### Option A — Docker (Recommended)

The fastest way to get everything running locally.

```bash
# 1. Clone
git clone https://github.com/rejisterjack/rag-starter-kit.git
cd rag-starter-kit

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.local.example .env.local
# Edit .env.local — set OPENAI_API_KEY and NEXTAUTH_SECRET at minimum

# 4. Start all services (PostgreSQL + pgvector, MinIO, Inngest, Next.js)
make up

# 5. Run database migrations (inside the running container)
make db-migrate

# 6. (Optional) Seed the database
make db-seed
```

Open [http://localhost:3000](http://localhost:3000) 🎉

**Available services:**

| Service | URL | Notes |
|---------|-----|-------|
| Next.js app | http://localhost:3000 | |
| Prisma Studio | http://localhost:5555 | Run `make db-studio` first |
| Inngest dashboard | http://localhost:8288 | |
| MinIO console | http://localhost:9001 | minioadmin / minioadmin |
| PostgreSQL | internal (`rag-db:5432`) | No host port — use Prisma Studio |

---

### Option B — Local Node.js (without Docker)

Requires a PostgreSQL 16 instance with the `pgvector` extension installed.

```bash
# 1. Clone & install
git clone https://github.com/rejisterjack/rag-starter-kit.git
cd rag-starter-kit
pnpm install

# 2. Configure environment
cp .env.local.example .env.local
# Edit .env.local — set DATABASE_URL, DATABASE_URL_UNPOOLED, OPENAI_API_KEY, NEXTAUTH_SECRET

# 3. Enable pgvector extension (run once in psql)
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 4. Run migrations
pnpm db:migrate

# 5. Start the dev server
pnpm dev

# 6. (Optional) Start Inngest dev server in a second terminal
pnpm inngest:dev
```

---

## 🔑 Environment Variables

Copy `.env.local.example` → `.env.local` for development, or `.env.production.example` → `.env.production` for production.

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (used by Prisma at runtime) |
| `DATABASE_URL_UNPOOLED` | Direct PostgreSQL connection (used by Prisma Migrate CLI) |
| `OPENAI_API_KEY` | OpenAI API key for embeddings and chat |
| `NEXTAUTH_SECRET` | Random string for JWT signing (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Base URL of the application |

### Optional but Recommended

| Variable | Description |
|----------|-------------|
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth credentials |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth credentials |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting (Upstash) |
| `SENTRY_DSN` | Error tracking |
| `NEXT_PUBLIC_POSTHOG_KEY` | Product analytics |

### Vercel Postgres / Neon

When using Vercel Postgres (backed by Neon), map the auto-provided variables:

```env
DATABASE_URL=$POSTGRES_URL                    # pooled (pgbouncer)
DATABASE_URL_UNPOOLED=$POSTGRES_URL_NON_POOLING  # direct connection
```

---

## 🐳 Docker Reference

### Development

```bash
make up          # Start all services (detached)
make dev         # Start all services (attached, with logs)
make down        # Stop all services
make logs        # Tail logs
make db-migrate  # Run Prisma migrations inside the container
make db-studio   # Open Prisma Studio
make db-seed     # Seed the database
make build       # Rebuild Docker images
```

### Production

```bash
# Copy and fill in production env vars
cp .env.production.example .env.production

# Start the full production stack
docker compose -f docker-compose.prod.yml up -d

# With database backups (runs daily at 2 AM)
docker compose -f docker-compose.prod.yml --profile backup up -d
```

---

## ☁️ Vercel Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/rejisterjack/rag-starter-kit&env=OPENAI_API_KEY,NEXTAUTH_SECRET,AUTH_GITHUB_ID,AUTH_GITHUB_SECRET)

1. Click the button above or import the repo in the Vercel dashboard
2. Add a **Vercel Postgres** database from the Storage tab
3. Set the required environment variables (see table above)
4. Deploy — Prisma migrations run automatically on startup

---

## 📁 Project Structure

```
rag-starter-kit/
├── src/
│   ├── app/                    # Next.js 15 App Router
│   │   ├── (auth)/            # Authentication routes
│   │   ├── (chat)/            # Chat routes
│   │   ├── (admin)/           # Admin routes
│   │   └── api/               # API routes
│   ├── components/            # React components (shadcn/ui + custom)
│   ├── lib/
│   │   ├── db/
│   │   │   ├── client.ts      # ★ Prisma 7 singleton (@prisma/adapter-pg)
│   │   │   ├── index.ts       # Public DB API (re-exports everything)
│   │   │   ├── init.ts        # pgvector extension + HNSW index setup
│   │   │   ├── vector-store.ts # Similarity search
│   │   │   ├── vector-operations.ts
│   │   │   ├── vector-cache.ts
│   │   │   └── batch-operations.ts
│   │   ├── ai/                # AI SDK configuration
│   │   ├── auth/              # NextAuth configuration
│   │   ├── rag/               # RAG pipeline (chunking, retrieval, engine)
│   │   └── inngest/           # Background job functions
│   ├── hooks/                 # Custom React hooks
│   └── types/                 # TypeScript types
├── prisma/
│   ├── schema.prisma          # Database schema (Prisma 7 — no URL in schema)
│   ├── config.ts              # Prisma sub-config
│   ├── seed.ts                # Database seeder
│   └── migrations/            # SQL migrations
├── prisma.config.ts           # ★ Prisma 7 CLI config (datasource URL here)
├── docker-compose.dev.yml     # Development stack
├── docker-compose.prod.yml    # Production stack
├── Dockerfile                 # Multi-stage build (deps/builder/runner/development)
├── Makefile                   # Developer shortcuts
└── docs/                      # Architecture & deployment guides
```

---

## 🧠 RAG Architecture

```
User Query
    │
    ▼
Embedding Model (text-embedding-3-small)
    │
    ▼
pgvector Similarity Search (HNSW index)
    │
    ▼
Retrieved Chunks + Metadata
    │
    ▼
LLM Context Window (GPT-4o-mini)
    │
    ▼
Streaming Response → User

Document Upload
    │
    ▼
Text Extraction (PDF / DOCX / TXT)
    │
    ▼
Recursive Text Chunking
    │
    ▼
Embedding Generation (Inngest background job)
    │
    ▼
pgvector Storage (PostgreSQL 16)
```

---

## 🗄️ Database Architecture (Prisma 7)

This project uses **Prisma 7** with the `@prisma/adapter-pg` driver adapter pattern:

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Schema definition — **no URL** (Prisma 7 requirement) |
| `prisma.config.ts` | CLI config — datasource URL for `prisma migrate` |
| `src/lib/db/client.ts` | Runtime singleton — `PrismaClient` + `PrismaPg` pool |

**Why two connection strings?**

- `DATABASE_URL` — used by the `pg.Pool` at runtime; can point to a pgbouncer/pooler
- `DATABASE_URL_UNPOOLED` — used by `prisma migrate`; must be a direct connection

---

## 🧪 Testing

```bash
pnpm test              # Run unit tests (watch mode)
pnpm test:run          # Run unit tests once
pnpm test:coverage     # Coverage report
pnpm test:integration  # Integration tests
pnpm test:e2e          # Playwright E2E tests
```

---

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | Build production bundle |
| `pnpm start` | Start production server |
| `pnpm lint` | Run Biome linter |
| `pnpm lint:fix` | Fix lint errors |
| `pnpm type-check` | TypeScript type checking |
| `pnpm format` | Format code with Biome |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run migrations (dev) |
| `pnpm db:migrate:prod` | Deploy migrations (prod) |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:seed` | Seed the database |
| `pnpm inngest:dev` | Start Inngest dev server |

---

## 🛡️ Security

- ✅ API routes protected with NextAuth.js session checks
- ✅ Row-level data isolation via `userId` / `workspaceId`
- ✅ Input validation with Zod
- ✅ Rate limiting via Upstash Redis
- ✅ Audit logging for all sensitive operations
- ✅ Secure credential storage in environment variables
- ✅ TypeScript strict mode throughout

---

## 📚 Documentation

- [Architecture Guide](./docs/architecture.md) — System design and data flow
- [Customization Guide](./docs/customization.md) — Models, UI, and RAG pipeline
- [Docker Deployment](./docs/deployment/docker.md) — Self-hosted deployment
- [Production Checklist](./docs/deployment/production-checklist.md)
- [Troubleshooting](./docs/deployment/troubleshooting.md)

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

Distributed under the MIT License. See [`LICENSE`](./LICENSE) for more information.

---

## 💡 Acknowledgements

Built with ❤️ to accelerate AI-powered application development. Special thanks to:
- [LangChain](https://js.langchain.com/) for the orchestration framework
- [Vercel](https://vercel.com) for the AI SDK and deployment platform
- [shadcn/ui](https://ui.shadcn.com/) for the beautiful component library
- [Inngest](https://www.inngest.com/) for background job infrastructure
- [pgvector](https://github.com/pgvector/pgvector) for vector similarity search

---

<div align="center">

**[⭐ Star this repo](https://github.com/rejisterjack/rag-starter-kit)** if you find it helpful!

Built by [Rejister Jack](https://github.com/rejisterjack) · Powered by OpenAI + Next.js + Prisma 7

</div>
