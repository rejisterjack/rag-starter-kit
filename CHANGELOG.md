# Changelog

All notable changes to `rag-starter-kit` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

Changes that are merged but not yet tagged as a release.

### Planned for Next Release
- Retrieval debug mode — shows retrieved chunks and scores alongside response in dev
- Suggested follow-up questions after each response
- Message feedback (thumbs up/down)
- Embeddable chat widget (npm package)
- Notion / GitHub / Google Drive connectors

---

## [1.0.0] — 2026-05-02

### Initial public release. 🎉

This is the first stable release of `rag-starter-kit` — a production-ready RAG chatbot built entirely in TypeScript with zero required API costs.

### Added

**Core RAG Pipeline**
- Document ingestion with recursive text chunking and overlap
- Vector embeddings via Google Gemini free tier (1,500 req/day)
- pgvector similarity search on PostgreSQL 16
- Hybrid search combining vector similarity and keyword matching
- Source citations — every response shows referenced document chunks
- Configurable retrieval parameters (`TOP_K_RETRIEVAL`, `SIMILARITY_THRESHOLD`, `CHUNK_SIZE`, `CHUNK_OVERLAP`)

**LLM Integration**
- OpenRouter integration supporting free models: DeepSeek, Mistral, Llama 3.1, Gemma
- Real-time streaming responses via Server-Sent Events (SSE)
- Multi-model fallback — automatically switches to backup model if primary fails
- Conversation memory with context-aware multi-turn chat

**Document Processing**
- PDF, DOCX, TXT, and Markdown ingestion
- Background processing via Inngest (document ingestion never blocks the UI)
- Cloudinary cloud file storage
- Multi-document chat context

**Authentication & Security**
- NextAuth.js v5 with OAuth providers (GitHub, Google)
- API key authentication for programmatic access
- Rate limiting via Upstash Redis with per-endpoint configuration
- Audit logging for security events
- Row-level database isolation per workspace
- Input validation with Zod across all API routes
- Secure headers (CSP, HSTS)

**Real-time Collaboration**
- Multi-user workspaces with role-based access control
- Typing indicators and user presence tracking
- WebSocket/SSE for live updates

**Voice Features**
- Speech-to-text via Web Speech API and Whisper
- Text-to-speech via browser synthesis
- Voice activity detection
- Wake word detection ("Hey RAG")

**UI & Frontend**
- Next.js 15 App Router with React 19
- Tailwind CSS 4 with dark/light mode
- shadcn/ui component library
- Responsive design (mobile, tablet, desktop)
- Smooth animations with Framer Motion
- PWA support — installable as native app

**Monitoring & Analytics**
- Plausible Analytics — privacy-focused
- PostHog — product analytics (optional)
- Token usage tracking per user and workspace
- API latency monitoring (p50, p95, p99)
- Health check endpoint at `/api/health`

**Developer Experience**
- Full managed cloud services stack — Neon PostgreSQL, Upstash Redis, Cloudinary, Inngest all connected
- Hot reload in local development
- Seed script with sample documents for immediate testing
- Vitest unit tests with coverage reporting
- Playwright E2E test suite
- GitHub Actions CI/CD (CI, E2E, Lighthouse, Security scanning)
- One-click deploy buttons for Vercel, Railway, and Render
- Biome for formatting and linting

**Database**
- PostgreSQL 16 + pgvector extension
- Prisma 7 ORM with `@prisma/adapter-pg`
- Automated migrations

**Infrastructure**
- Managed cloud services — Neon PostgreSQL, Upstash Redis, Cloudinary storage, Inngest background jobs
- Environment variable validation on startup
- Complete `.env.example` with documentation for every variable

---

## How to Read This Changelog

Each release is tagged in the format `[MAJOR.MINOR.PATCH]`.

- **Major** — breaking changes (things you need to update when upgrading)
- **Minor** — new features (backward compatible)
- **Patch** — bug fixes (backward compatible)

For each release, changes are grouped as:
- `Added` — new features
- `Changed` — changes to existing functionality
- `Deprecated` — features that will be removed in a future release
- `Removed` — features removed in this release
- `Fixed` — bug fixes
- `Security` — security-related fixes

---

[Unreleased]: https://github.com/rejisterjack/rag-starter-kit/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/rejisterjack/rag-starter-kit/releases/tag/v1.0.0
