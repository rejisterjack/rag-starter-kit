<div align="center">

# 🧠 RAG Starter Kit

**A production-ready, self-hosted RAG (Retrieval-Augmented Generation) chatbot boilerplate**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![LangChain](https://img.shields.io/badge/LangChain-🦜-green?style=flat-square)](https://js.langchain.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deploy-black?style=flat-square&logo=vercel)](https://vercel.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

[Live Demo](https://rag-starter-kit.vercel.app/) · [Documentation](./docs) · [Report Bug](../../issues) · [Request Feature](../../issues)

</div>

---

## ✨ Features

- **🎨 Modern UI/UX**: Clean, responsive chat interface built with Next.js 14 and Tailwind CSS
- **🔍 Intelligent RAG Pipeline**: Context-aware responses using LangChain + pgvector
- **📄 Document Ingestion**: Upload and process PDFs, text files, and web content
- **💾 Persistent Vector Storage**: PostgreSQL with pgvector extension for efficient similarity search
- **⚡ Real-time Streaming**: Lightning-fast token streaming for natural conversation flow
- **🔐 Authentication Ready**: NextAuth.js integration for secure user sessions
- **🚀 Production Deploy**: One-click deploy to Vercel with environment templates

## 🎯 Why This Starter Kit?

| Feature | Traditional RAG | This Starter Kit |
|---------|----------------|------------------|
| Setup Time | Days → Weeks | Minutes |
| Vector DB Setup | Complex self-hosted | Managed PostgreSQL |
| Frontend Build | From scratch | Production-ready Next.js |
| Deployment | Manual configuration | One-click Vercel deploy |
| Customization | Difficult | Extensible architecture |

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** — App Router, Server Components, streaming support
- **Tailwind CSS** — Utility-first styling with dark mode
- **shadcn/ui** — Accessible, composable UI components
- **React Query** — Server state management and caching
- **Vercel AI SDK** — Stream-ready AI integration

### Backend & AI
- **LangChain.js** — Orchestration framework for LLM applications
- **OpenAI API** — GPT-4/3.5 for embeddings & completion
- **pgvector** — Vector similarity search in PostgreSQL
- **Next.js API Routes** — Serverless backend endpoints

### Database & Storage
- **PostgreSQL 15+** — Relational database with JSON support
- **pgvector Extension** — High-performance vector operations
- **Vercel Postgres** — Managed database with zero-config setup

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ and pnpm (recommended) or npm
- OpenAI API key
- PostgreSQL database with pgvector extension

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/rag-starter-kit.git
cd rag-starter-kit
pnpm install
```

### 2. Environment Setup

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Database (PostgreSQL + pgvector)
POSTGRES_PRISMA_URL=postgres://user:password@localhost:5432/ragdb
POSTGRES_URL_NON_POOLING=postgres://user:password@localhost:5432/ragdb

# NextAuth.js
NEXTAUTH_SECRET=your-secret-key-min-32-chars-long
NEXTAUTH_URL=http://localhost:3000

# Optional: Analytics
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=
```

### 3. Database Setup

```bash
# Run migrations
pnpm db:migrate

# Generate Prisma client
pnpm db:generate

# (Optional) Seed with sample data
pnpm db:seed
```

### 4. Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — your RAG chatbot is live! 🎉

## ☁️ One-Click Deploy

Deploy instantly to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/rag-starter-kit&env=OPENAI_API_KEY,NEXTAUTH_SECRET)

**Required Environment Variables:**
- `OPENAI_API_KEY` — Your OpenAI API key
- `NEXTAUTH_SECRET` — Random string for JWT encryption (generate with `openssl rand -base64 32`)

## 📁 Project Structure

```
rag-starter-kit/
├── app/                    # Next.js 14 App Router
│   ├── (chat)/            # Chat route group
│   │   ├── page.tsx       # Main chat interface
│   │   └── layout.tsx     # Chat-specific layout
│   ├── api/               # API routes
│   │   ├── chat/          # Streaming chat endpoint
│   │   ├── ingest/        # Document ingestion
│   │   └── auth/          # NextAuth.js handlers
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── chat/              # Chat-specific components
│   ├── ui/                # shadcn/ui components
│   └── providers.tsx      # Context providers
├── lib/                   # Utility functions
│   ├── rag/               # RAG pipeline logic
│   │   ├── chain.ts       # LangChain setup
│   │   ├── vector-store.ts # pgvector operations
│   │   └── embeddings.ts  # Embedding generation
│   └── utils.ts           # Helper functions
├── prisma/                # Database schema
│   └── schema.prisma      # Prisma schema definition
├── public/                # Static assets
├── docs/                  # Documentation
│   ├── architecture.md    # System architecture
│   └── customization.md   # Customization guide
└── types/                 # TypeScript definitions
```

## 🧠 RAG Architecture

```mermaid
graph TD
    A[User Query] --> B[Embedding Model<br/>text-embedding-3-small]
    B --> C[Vector Search<br/>pgvector]
    C --> D[Relevant Chunks]
    D --> E[LLM Context<br/>GPT-4/3.5]
    E --> F[Streaming Response]
    
    G[Document Upload] --> H[Text Extraction]
    H --> I[Chunking Strategy]
    I --> J[Embeddings]
    J --> K[(PostgreSQL<br/>pgvector)]
```

## 🎨 Customization

### Change the LLM
Edit `lib/rag/chain.ts`:
```typescript
const model = new ChatOpenAI({
  modelName: "gpt-4-turbo-preview", // Change model
  temperature: 0.7,
  streaming: true,
});
```

### Adjust Chunking Strategy
Modify in `lib/rag/ingestion.ts`:
```typescript
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,      // Adjust chunk size
  chunkOverlap: 200,    // Adjust overlap
});
```

### Custom Embedding Model
Update `lib/rag/embeddings.ts`:
```typescript
export const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-large", // Upgrade embeddings
});
```

## 🔧 Advanced Configuration

### Rate Limiting
Configure in `app/api/chat/route.ts`:
```typescript
const rateLimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests/minute
});
```

### Streaming Optimization
Adjust in `lib/rag/chain.ts`:
```typescript
const stream = await chain.stream({
  question: input,
  chat_history: formattedHistory,
}, {
  callbacks: [/* custom handlers */],
});
```

## 📊 Performance

Benchmarks on Vercel Pro (Washington, D.C.):

| Metric | Value |
|--------|-------|
| Cold Start | ~800ms |
| Warm Response | ~200ms |
| Streaming Latency | 50-100ms/token |
| Vector Search (10k docs) | <50ms |

## 🛡️ Security

- ✅ API routes protected with rate limiting
- ✅ Row-level security via PostgreSQL policies
- ✅ Input sanitization and validation
- ✅ Secure session management with NextAuth.js
- ⚠️ Never commit `.env` files — use Vercel secrets in production

## 🐛 Troubleshooting

<details>
<summary>pgvector extension not found</summary>

```sql
-- Connect to PostgreSQL and run:
CREATE EXTENSION IF NOT EXISTS vector;
```

</details>

<details>
<summary>OpenAI rate limits</summary>

Add retry logic in `lib/rag/chain.ts`:
```typescript
const model = new ChatOpenAI({
  maxRetries: 3,
  timeout: 30000,
});
```

</details>

<details>
<summary>Build fails on Vercel</summary>

Ensure `package.json` includes:
```json
{
  "engines": {
    "node": ">=20.0.0"
  }
}
```

</details>

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

---

<div align="center">

**[⭐ Star this repo](https://github.com/yourusername/rag-starter-kit)** if you find it helpful!

**[🐦 Follow me](https://twitter.com/yourhandle)** for updates on this project

Built by [Your Name](https://yourportfolio.com) · Powered by OpenAI + Vercel

</div>
