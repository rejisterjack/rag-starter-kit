<div align="center">

# 🧠 RAG Starter Kit

**Ship a production-grade AI document chatbot this weekend — TypeScript-native RAG with streaming, auth, background jobs, and pgvector. Zero Python required.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-4169E1?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Vercel AI SDK](https://img.shields.io/badge/Vercel_AI_SDK-✨-black?style=flat-square&logo=vercel)](https://sdk.vercel.ai/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

[![CI](https://img.shields.io/github/actions/workflow/status/rejisterjack/rag-starter-kit/ci.yml?label=CI&style=flat-square)](https://github.com/rejisterjack/rag-starter-kit/actions)
[![E2E Tests](https://img.shields.io/github/actions/workflow/status/rejisterjack/rag-starter-kit/e2e.yml?label=E2E&style=flat-square)](https://github.com/rejisterjack/rag-starter-kit/actions)
[![Lighthouse](https://img.shields.io/github/actions/workflow/status/rejisterjack/rag-starter-kit/lighthouse.yml?label=Lighthouse&style=flat-square)](https://github.com/rejisterjack/rag-starter-kit/actions)
[![Coverage](https://img.shields.io/badge/coverage-90%25+-brightgreen?style=flat-square)](https://github.com/rejisterjack/rag-starter-kit/actions)
[![All Contributors](https://img.shields.io/github/all-contributors/rejisterjack/rag-starter-kit?color=ee8449&style=flat-square)](#contributors)

[🚀 Live Demo](https://rag-starter-kit.vercel.app/) · [📖 API Docs](https://rag-starter-kit.vercel.app/api/docs) · [🐛 Report Bug](../../issues) · [✨ Request Feature](../../issues) · [🔖 Changelog](CHANGELOG.md) · [🧩 Chrome Extension](extensions/chrome/README.md)

> **GitHub Topics** (add these in the repo Settings → About → Topics):
> `rag` `nextjs` `typescript` `langchain` `pgvector` `openai` `chatbot` `ai` `llm` `retrieval-augmented-generation` `starter-kit` `boilerplate` `inngest` `vercel` `postgresql`

<img src="https://img.shields.io/badge/100%25_FREE_AI-✓-brightgreen?style=for-the-badge&logo=openai" alt="100% Free AI" />

</div>

---

### ✨ Feature Highlights

| Feature | Description |
|---------|-------------|
| 💬 **Streaming RAG** | Real-time token generation with context |
| 📄 **Document Upload** | PDF, DOCX, TXT, Markdown, URL ingestion |
| 🎙️ **Voice Features** | Speech-to-text & text-to-speech |
| 👥 **Real-time Collaboration** | Multi-user workspaces with presence |
| 🔌 **Webhook Ingestion** | POST a URL or document via webhook |
| 🤖 **Agent Mode** | Tool-using AI agent (search, calculator, code) |
| 🌙 **Dark/Light Mode** | Beautiful themes |
| 📱 **PWA Support** | Install as native app |
| 🆓 **100% Free AI** | OpenRouter + Google Gemini (or Anthropic/Ollama) |

</div>

---

## ✨ What Makes This Special

### 🆓 100% FREE AI Setup
Unlike other RAG solutions that require paid OpenAI API keys, this starter kit uses:
- **🤖 Chat**: OpenRouter free models (DeepSeek, Mistral, Llama, Gemma) — or bring your own Anthropic/OpenAI/Ollama key
- **🔤 Embeddings**: Google Gemini free tier (1,500 req/day)
- **💰 Cost**: $0 forever for development and light usage

### 🚀 Production-Ready Features

<details open>
<summary><b>🎨 Modern UI/UX</b></summary>

- Next.js 15 App Router with React 19
- Tailwind CSS 4 with beautiful dark mode
- shadcn/ui component library
- Responsive design (mobile, tablet, desktop)
- Smooth animations with Framer Motion
- PWA support - install as native app

</details>

<details>
<summary><b>🧠 Advanced RAG Pipeline</b></summary>

- **Multi-model fallback**: Automatically switches to backup models if primary fails
- **Intelligent chunking**: Recursive text splitting with overlap
- **Hybrid search**: Vector similarity + keyword search
- **Source citations**: Every answer shows referenced documents
- **Conversation memory**: Context-aware multi-turn chats
- **Streaming responses**: Real-time token generation

</details>

<details>
<summary><b>📄 Document Processing</b></summary>

- PDF, DOCX, TXT, MD support
- Background processing with Inngest
- Automatic text extraction and chunking
- Multi-document chat context

</details>

<details>
<summary><b>🔐 Security</b></summary>

- NextAuth.js v5 with OAuth (GitHub, Google)
- Row-level database isolation
- Rate limiting with Upstash Redis
- Audit logging
- Input validation with Zod
- API key authentication

</details>

<details>
<summary><b>💬 Real-time Collaboration</b></summary>

- WebSocket/SSE for live updates
- Typing indicators
- User presence tracking
- Multi-user workspaces
- Role-based access control

</details>

<details>
<summary><b>📊 Monitoring & Analytics</b></summary>

- **Plausible Analytics** - Privacy-focused
- **PostHog** - Product analytics (optional)
- **Audit logging** - Security event tracking
- **Rate limiting** - Redis-based with per-endpoint config

</details>

<details>
<summary><b>🎙️ Voice Features</b></summary>

- Speech-to-text (Web Speech API + Whisper)
- Text-to-speech (browser synthesis)
- Voice activity detection
- Wake word detection ("Hey RAG")
- Voice commands

</details>

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router, RSC, Streaming) |
| **UI** | [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) |
| **AI / RAG** | [Vercel AI SDK](https://sdk.vercel.ai/), LangChain.js, OpenRouter, Anthropic Claude |
| **Embeddings** | [Google Gemini](https://ai.google.dev/) (free tier) |
| **Database** | [PostgreSQL 16](https://www.postgresql.org/) + [pgvector](https://github.com/pgvector/pgvector) |
| **ORM** | [Prisma 7](https://www.prisma.io/) + `@prisma/adapter-pg` |
| **Auth** | [NextAuth.js v5](https://authjs.dev/) (Auth.js) |
| **Storage** | [Cloudinary](https://cloudinary.com/) |
| **Background Jobs** | [Inngest](https://www.inngest.com/) |
| **State** | [TanStack Query](https://tanstack.com/query) + [Zustand](https://github.com/pmndrs/zustand) |
| **Testing** | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/) |
| **Analytics** | [Plausible](https://plausible.io/) + [PostHog](https://posthog.com/) (optional) |
| **DevOps** | [Vercel](https://vercel.com/) |
| **Linting** | [Biome](https://biomejs.dev/) |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** and **pnpm 9+**

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/rejisterjack/rag-starter-kit.git
cd rag-starter-kit

# 2. Get FREE API keys:
# - OpenRouter: https://openrouter.ai/keys
# - Google AI Studio: https://aistudio.google.com/app/apikey

# 3. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 4. Install dependencies and start dev server
pnpm install
pnpm dev

# 5. Open http://localhost:3000
```

**Services used:**

| Service | URL | Notes |
|---------|-----|-------|
| Next.js app | http://localhost:3000 | Main application |
| Inngest Dashboard | http://localhost:8288 | Background jobs |

### Docker (Self-Hosted)

```bash
# Start PostgreSQL + Redis locally
docker compose up -d

# Update .env with local database URL:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ragdb

# Run migrations and seed
pnpm db:migrate
pnpm db:seed

# Build and run production container
docker build -t rag-starter-kit .
docker run -p 3000:3000 --env-file .env --network host rag-starter-kit
```

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/rejisterjack/rag-starter-kit)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/rag-starter-kit)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/rejisterjack/rag-starter-kit)

---

## 📊 Comparison with Alternatives

| Feature | RAG Starter Kit | LangChain Templates | Vercel AI SDK Templates | Custom Build |
|---------|-----------------|---------------------|------------------------|--------------|
| **Cost** | 🆓 FREE AI | Paid APIs | Paid APIs | Variable |
| **Setup Time** | 2 minutes | 30+ min | 1 hour | Days/Weeks |
| **Production Ready** | ✅ Yes | ⚠️ Partial | ⚠️ Partial | Depends |
| **Authentication** | ✅ Built-in | ❌ Manual | ❌ Manual | Manual |
| **Document Upload** | ✅ Built-in | ⚠️ Basic | ❌ No | Manual |
| **Real-time Collab** | ✅ Built-in | ❌ No | ❌ No | Manual |
| **PWA Support** | ✅ Built-in | ❌ No | ❌ No | Manual |
| **Voice Features** | ✅ Built-in | ❌ No | ❌ No | Manual |
| **TypeScript** | ✅ Strict | ⚠️ Loose | ⚠️ Loose | Depends |

---

## 🏗️ Architecture

### System Overview

```mermaid
graph TB
    User([User]) -->|Upload Document| Cloudinary[Cloudinary]
    User -->|Chat Query| Next[Next.js 15 App]

    subgraph "Background Processing"
        Cloudinary -->|Trigger| Inngest[Inngest Jobs]
        Inngest -->|Extract Text| OCR[OCR/Text Extraction]
        OCR -->|Chunk| Chunker[Text Chunking]
        Chunker -->|Embed| Google[Google Gemini Embeddings]
        Google -->|Store| PG[(PostgreSQL + pgvector)]
    end

    subgraph "Chat Flow"
        Next -->|1. Embed Query| Google
        Next -->|2. Vector Search| PG
        PG -->|3. Retrieve Chunks| Next
        Next -->|4. Generate Response| OR[OpenRouter LLM]
        OR -->|5. Stream Tokens| User
    end

    subgraph "Real-time Features"
        Next -->|WebSocket| Ably[Ably]
        Ably -->|Presence/Typing| User
    end
```

### Architecture Layers

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Presentation** | Next.js 15, React 19, Tailwind CSS | UI components, SSR, streaming |
| **API** | Next.js API Routes | RESTful endpoints, type-safe APIs |
| **AI/ML** | Vercel AI SDK, OpenRouter, Gemini | LLM inference, embeddings |
| **RAG** | LangChain, custom pipeline | Document processing, retrieval |
| **Data** | PostgreSQL, pgvector, Redis | Persistent storage, caching |
| **Storage** | Cloudinary | Document files |
| **Queue** | Inngest | Background job processing |
| **Real-time** | Ably | WebSocket connections |

---

## 🔑 Environment Variables

Just **2 files**:

| File | Purpose | Git |
|------|---------|-----|
| `.env.example` | Template with all options | ✅ Tracked |
| `.env` | Your actual secrets | ❌ Ignored |

### Quick Setup

```bash
# 1. Copy the template
cp .env.example .env

# 2. Get your FREE API keys:
# - OpenRouter: https://openrouter.ai/keys
# - Google AI: https://aistudio.google.com/app/apikey

# 3. Edit .env with your keys

# 4. Start the dev server
pnpm dev
```

### Required (FREE)

| Variable | Description | Get Key |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | Chat/LLM (free models) | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `NEXTAUTH_SECRET` | JWT signing | `openssl rand -base64 32` |

---

## 🧪 Testing

```bash
pnpm test              # Unit tests (Vitest)
pnpm test:coverage     # Coverage report
pnpm test:e2e          # E2E tests (Playwright)
pnpm test:integration  # Integration tests
```

---

## 📁 Project Structure

```
rag-starter-kit/
├── src/
│   ├── app/                 # Next.js 15 App Router
│   ├── components/          # React components (shadcn/ui)
│   ├── lib/
│   │   ├── ai/             # AI SDK config (OpenRouter + Google)
│   │   ├── db/             # Prisma 7 + pgvector
│   │   ├── rag/            # RAG pipeline (chunking, retrieval)
│   │   ├── auth/           # NextAuth.js v5
│   │   └── realtime/       # WebSocket/SSE
│   └── hooks/              # Custom React hooks
├── prisma/                 # Database schema & migrations
├── tests/                  # Unit, integration, E2E tests
└── .github/workflows/      # CI/CD pipelines
```

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
# Quick start for contributors
git clone https://github.com/YOUR_USERNAME/rag-starter-kit.git
cd rag-starter-kit && pnpm install
cp .env.example .env
# Edit .env with your API keys
pnpm dev
```

See [Contributors](./CONTRIBUTORS.md) for our community!

---

## 📚 Additional Guides

### 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| **Port in use** | Check if port 3000 is free: `lsof -i :3000` |
| **Prisma generate fails** | Run `pnpm prisma generate` manually |
| **Embedding errors** | Verify your embedding provider configuration and API key quota |
| **LLM timeout** | Check OpenRouter status or switch models in settings |
| **Upload fails** | Verify Cloudinary credentials in your `.env` file |
| **WebSocket not connecting** | Check `NEXT_PUBLIC_APP_URL` matches your browser URL |

### 🤖 Model Selection Guide

| Use Case | Recommended Model | Context | Provider |
|----------|------------------|---------|----------|
| **General chat** | DeepSeek Chat | 32K | OpenRouter |
| **Code assistance** | CodeLlama 70B | 16K | OpenRouter |
| **Fast responses** | Mistral 7B | 32K | OpenRouter |
| **Creative writing** | Llama 3.1 70B | 128K | OpenRouter |
| **Local/privacy** | llama3.2 (Ollama) | 128K | Self-hosted |

Switch models in the chat header dropdown or set `DEFAULT_MODEL` in your environment.

### 📊 Monitoring Setup

The starter kit includes built-in observability:

```bash
# Enable detailed logging
LOG_LEVEL=debug

# API usage tracking (stored in database)
# View analytics at /chat/analytics

# Health check endpoint
curl http://localhost:3000/api/health
```

Key metrics tracked:
- Token usage per user/workspace
- API latency (p50, p95, p99)
- Document processing queue depth
- Rate limit hits

### ⚡ Performance Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_CHUNK_SIZE` | 1000 | Characters per document chunk |
| `CHUNK_OVERLAP` | 200 | Overlap between chunks |
| `TOP_K_RETRIEVAL` | 5 | Chunks to retrieve per query |
| `SIMILARITY_THRESHOLD` | 0.7 | Minimum relevance score |
| `MAX_TOKENS` | 2000 | LLM response limit |

For production with high traffic:
1. Enable Redis caching: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
2. Use connection pooling for database
3. Enable CDN for static assets
4. Consider dedicated embedding service

---

## 🛡️ Security

The RAG Starter Kit implements comprehensive security measures:

### Authentication & Authorization
- **NextAuth.js v5** with OAuth (GitHub, Google) and credentials
- **SAML 2.0 SSO** support for enterprise (Okta, Azure AD)
- **API Key** authentication for programmatic access
- **RBAC** with workspace-level permissions

### Data Protection
- **Row-level security** via workspace isolation
- **TLS** for all connections
- **Secure headers** (CSP, HSTS)

### Input Validation
- **Zod schemas** for all API inputs
- **SQL injection prevention** via Prisma ORM
- **XSS protection** with React's built-in escaping

### Monitoring
- **Audit logging** for security events
- **Rate limiting** with progressive penalties

Report vulnerabilities via [GitHub Security Advisory](https://github.com/rejisterjack/rag-starter-kit/security/advisories/new). See [SECURITY.md](./SECURITY.md) for details.

---

## 📝 License

Distributed under the MIT License. See [LICENSE](./LICENSE) for more information.

---

## 💡 Acknowledgements

Built with ❤️ to accelerate AI-powered application development.

- [Vercel AI SDK](https://sdk.vercel.ai/) for the amazing AI framework
- [OpenRouter](https://openrouter.ai/) for free LLM access
- [Google AI Studio](https://aistudio.google.com/) for free embeddings
- [shadcn/ui](https://ui.shadcn.com/) for beautiful components
- [Inngest](https://www.inngest.com/) for background jobs
- [pgvector](https://github.com/pgvector/pgvector) for vector search

---

## 👥 Contributors

Thanks to all the amazing people who have contributed to this project!

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%">
        <a href="https://github.com/rejisterjack">
          <img src="https://github.com/rejisterjack.png" width="100px;" alt="Rejister Jack"/><br />
          <sub><b>Rejister Jack</b></sub>
        </a>
      </td>
      <!-- Add more contributors here -->
    </tr>
  </tbody>
</table>
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

Want to contribute? See our [Contributors Guide](./CONTRIBUTORS.md) and [Contributing Guide](./CONTRIBUTING.md)!

---

<div align="center">

**[⭐ Star this repo](https://github.com/rejisterjack/rag-starter-kit)** if you find it helpful!

Made by [Rejister Jack](https://github.com/rejisterjack) and [contributors](./CONTRIBUTORS.md) · Powered by OpenRouter + Google AI

</div>
