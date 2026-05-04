# rag-starter-kit — Roadmap

> *This document is the single source of truth for what gets built, in what order, and why. Every item here ties back to the vision in VISION.md. Features not in this document don't get built until this document is updated.*

---

## How to Read This

Each phase builds on the previous one. **Phase 0** is cleanup — the project as it should exist before any new development. **Phases 1–3** are the real product. **Phase 4** is the long-game.

Status labels:
- `✅ Done` — shipped and working
- `🔧 In Progress` — actively being built
- `📋 Planned` — scoped and ready to start
- `💡 Idea` — direction agreed, not yet scoped

---

## Phase 0 — Foundation Cleanup
**Goal: Make the existing project match what it claims to be.**
**Timeline: Complete before starting Phase 1.**

This phase is not about new features. It's about making the project credible to a developer landing on the repo for the first time.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.1 | Replace `[Your Name]` placeholder in README | ✅ Done | |
| 0.2 | Add a working live demo link | ✅ Done | Deployed to Vercel |
| 0.3 | Record a 30-second GIF of the chatbot working | 📋 Planned | Embed in README — one GIF is worth 500 words of description |
| 0.4 | Add GitHub repo topics | ✅ Done | `rag` `langchain` `nextjs` `typescript` `pgvector` `chatbot` `openrouter` `free-ai` `inngest` `voice-ai` `vercel` `cloudinary` |
| 0.5 | Write a proper `CONTRIBUTING.md` | ✅ Done | How to run locally, how to submit a PR, coding conventions |
| 0.6 | Add `VISION.md` and `ROADMAP.md` to the repo root | ✅ Done | These documents |
| 0.7 | Verify local dev works end-to-end on a clean machine | ✅ Done | Works with a single `pnpm dev` |
| 0.8 | Fix any broken environment variable documentation | ✅ Done | Every `.env` key documented in `.env.example` with a comment |
| 0.9 | Add a proper LICENSE file | ✅ Done | MIT license |

---

## Phase 1 — Developer Experience
**Goal: A developer can go from clone to running chatbot in under 10 minutes.**
**Timeline: Month 1–2**

The best open-source projects are effortless to start. This phase is entirely about removing friction. Nothing kills adoption faster than a README that doesn't work.

### 1.1 README Overhaul

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1.1 | Rewrite README with clear hero section | ✅ Done | What it is, who it's for, live demo link — all above the fold |
| 1.1.2 | Add architecture diagram | ✅ Done | Mermaid diagram showing how documents → pgvector → LLM → streaming response |
| 1.1.3 | Add "Quick Start" section (5 steps, under 10 mins) | ✅ Done | Clone → install → env vars → pnpm dev → open localhost |
| 1.1.4 | Add "How It Works" section | ✅ Done | Explains the RAG pipeline: ingest, embed, retrieve, generate |
| 1.1.5 | Add "Tech Stack" section with rationale | ✅ Done | Why Next.js, why pgvector, why Inngest — not just a list |
| 1.1.6 | Add "Deployment" section for Vercel + Railway + Render | ✅ Done | One-click deploy buttons for each platform |

### 1.2 Local Development

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.2.1 | Single-command local setup via `pnpm dev` | ✅ Done | No Docker — managed cloud services (Neon, Upstash, Cloudinary, Inngest) |
| 1.2.2 | Seed script with sample documents | 📋 Planned | Run once, have a working chatbot with real data to test against |
| 1.2.3 | Hot reload working locally | ✅ Done | Developer changes code, sees it update — instant feedback |
| 1.2.4 | Local LLM support via Ollama | ✅ Done | Develop offline without spending API credits |

### 1.3 Configuration

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.3.1 | All config via environment variables — no code changes required | ✅ Done | Model, chunk size, top-k, similarity threshold — all in `.env` |
| 1.3.2 | Config validation on startup | ✅ Done | If a required env var is missing, the app tells you exactly which one and why |
| 1.3.3 | Documented config reference | ✅ Done | Every variable, its type, its default, and what it does |

---

## Phase 2 — Core Product Features
**Goal: Turn the starter kit into a real product people run and rely on.**
**Timeline: Month 2–4**

This is where the project stops being a "starter kit" and starts being a platform. Every feature here solves a real pain point a developer would hit within a week of using it in production.

### 2.1 Multi-LLM Support

The single most requested feature in the TypeScript AI ecosystem. Developers want to switch providers without rewriting logic.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1.1 | Abstract LLM provider behind a unified interface | ✅ Done | Vercel AI SDK provides the unified interface |
| 2.1.2 | OpenAI provider (GPT-4o, GPT-4o-mini) | ✅ Done | Already built |
| 2.1.3 | Anthropic provider (Claude Sonnet, Claude Haiku) | ✅ Done | Via Vercel AI SDK |
| 2.1.4 | Ollama provider (Llama 3, Mistral, Phi-3, etc.) | ✅ Done | Local inference, no API key required |
| 2.1.5 | Google provider (Gemini 1.5 Flash, Pro) | ✅ Done | Via `@ai-sdk/google` |
| 2.1.6 | Provider switching via single `LLM_PROVIDER` env var | ✅ Done | Change one line, switch providers |
| 2.1.7 | Model selection UI in chat interface | ✅ Done | User can pick model from dropdown in the chat |

### 2.2 Admin Dashboard

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.2.1 | Protected `/admin` route with auth | ✅ Done | NextAuth.js v5 with RBAC |
| 2.2.2 | Document upload UI | ✅ Done | Drag-and-drop or file picker, uploads to Cloudinary, triggers ingestion |
| 2.2.3 | Document list with ingestion status | ✅ Done | See all documents, their status (pending / processing / ready / failed) |
| 2.2.4 | Delete document | ✅ Done | Removes file from Cloudinary and all chunks from pgvector |
| 2.2.5 | Re-ingest document | ✅ Done | Useful after changing chunk size or embedding model |
| 2.2.6 | Knowledge base stats | ✅ Done | Total documents, total chunks, embedding model in use, storage used |
| 2.2.7 | Ingestion job history | ✅ Done | View Inngest job runs, success/failure, duration |

### 2.3 Retrieval Quality

Better retrieval = better answers. These features let developers tune and understand what's happening under the hood.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.3.1 | Source citations in responses | ✅ Done | Every answer shows which document chunks it used, with the source filename and page |
| 2.3.2 | Configurable retrieval parameters | ✅ Done | `RETRIEVAL_TOP_K`, `SIMILARITY_THRESHOLD`, `CHUNK_SIZE`, `CHUNK_OVERLAP` all in `.env` |
| 2.3.3 | Hybrid search (vector + keyword) | ✅ Done | Combine pgvector cosine similarity with full-text search for better results |
| 2.3.4 | Retrieval debug mode | 📋 Planned | Enable via env var — shows retrieved chunks and scores alongside the response in dev |
| 2.3.5 | Re-ranking step | 💡 Idea | Use a cross-encoder to re-rank retrieved chunks before sending to LLM |

### 2.4 Document Ingestion

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.4.1 | PDF ingestion | ✅ Done | Parse PDF text, split into chunks, embed and store |
| 2.4.2 | Markdown ingestion | ✅ Done | Already supported |
| 2.4.3 | Plain text ingestion | ✅ Done | Already supported |
| 2.4.4 | DOCX ingestion | ✅ Done | Parse Word documents |
| 2.4.5 | Web URL ingestion | ✅ Done | Paste a URL, the system fetches and indexes the page content |
| 2.4.6 | Ingestion progress via real-time updates | ✅ Done | Real-time progress as large documents are processed |
| 2.4.7 | Duplicate detection | ✅ Done | Don't re-ingest a file that's already in the knowledge base |

---

## Phase 3 — Power Features
**Goal: Make this the most complete TypeScript RAG platform available anywhere.**
**Timeline: Month 4–8**

This is where the project becomes genuinely hard to replicate. Each feature here takes real engineering effort and adds lasting value.

### 3.1 Embeddable Chat Widget

This is the feature that takes the project from "something developers run" to "something developers ship to their users."

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1.1 | Standalone widget bundle via `npm` package | 💡 Idea | Published as `@rejisterjack/rag-widget` |
| 3.1.2 | Script tag embed: `<script src="..." data-project-id="...">` | 💡 Idea | Works on any website without React |
| 3.1.3 | React component: `<RAGChatWidget projectId="..." />` | 💡 Idea | For React apps |
| 3.1.4 | Customizable theme (colors, position, avatar) | 💡 Idea | Via data attributes or props |
| 3.1.5 | Widget analytics via PostHog | 💡 Idea | Track opens, messages sent, satisfaction |

### 3.2 Multi-Tenancy

Multiple knowledge bases, multiple isolated deployments, from a single running instance.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.2.1 | Project/workspace concept — each with its own knowledge base | ✅ Done | Documents, settings, and chat history are scoped per workspace |
| 3.2.2 | Project-level LLM and retrieval config | ✅ Done | Each workspace can use a different model or chunk strategy |
| 3.2.3 | Project API keys | ✅ Done | Generate a key per workspace for programmatic access |

### 3.3 Integrations & Webhooks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.3.1 | Webhook trigger for document ingestion | ✅ Done | POST to `/api/ingest` with a URL or file content |
| 3.3.2 | Notion connector | 💡 Idea | Sync a Notion database or page into the knowledge base |
| 3.3.3 | GitHub connector | 💡 Idea | Index a repository's markdown docs and README files |
| 3.3.4 | Google Drive connector | 💡 Idea | Ingest documents from a Drive folder |
| 3.3.5 | Confluence connector | 💡 Idea | For teams using Confluence as their knowledge base |
| 3.3.6 | Slack connector | 💡 Idea | Index Slack channel history |

### 3.4 Conversation Features

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.4.1 | Persistent conversation history per user | ✅ Done | Store chat history in Postgres, load on return |
| 3.4.2 | Conversation export (PDF, DOCX) | ✅ Done | Download a full conversation |
| 3.4.3 | Suggested follow-up questions | 💡 Idea | LLM generates 2–3 suggested next questions after each response |
| 3.4.4 | Message feedback (thumbs up/down) | 📋 Planned | Logged for quality tracking |
| 3.4.5 | Conversation search | 💡 Idea | Search past conversations by keyword |

### 3.5 Agent Mode

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.5.1 | Tool use framework | ✅ Done | Define tools the LLM can call: search web, calculate, run code |
| 3.5.2 | Web search tool (via Tavily or Exa) | ✅ Done | LLM can search the web when the knowledge base doesn't have the answer |
| 3.5.3 | Code execution tool | ✅ Done | LLM can write and run JavaScript in a sandboxed environment |
| 3.5.4 | Calculator tool | ✅ Done | Built-in calculator for mathematical queries |

---

## Phase 4 — Community & Ecosystem
**Goal: Other developers build on top of this. It becomes the reference implementation.**
**Timeline: Month 6–12 (runs in parallel with Phase 3)**

This phase is not code. It's the work that turns a good repo into a project people know and trust.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | Deep-dive article: "Building a production RAG system in TypeScript" | 📋 Planned | The flagship piece of content. Target dev.to, Hashnode, and a Reddit post to r/LocalLLM |
| 4.2 | Post to r/LocalLLM | 📋 Planned | "I built a TypeScript RAG chatbot — Next.js, pgvector, voice I/O, one-click Vercel" |
| 4.3 | Post to r/selfhosted | 📋 Planned | Same project, different framing — focus on data privacy and cloud-native deployment |
| 4.4 | Post to r/nextjs | 📋 Planned | Focus on the Next.js 15 + App Router + streaming implementation |
| 4.5 | Submit to "awesome-selfhosted" list | 📋 Planned | High-traffic GitHub list, permanent inbound traffic |
| 4.6 | Submit to "awesome-langchain" or "awesome-llm" list | 📋 Planned | Developer discoverability |
| 4.7 | GitHub Discussions enabled for Q&A | 📋 Planned | Let users ask questions publicly, builds a searchable knowledge base |
| 4.8 | Issue templates for bug reports and feature requests | ✅ Done | Makes contribution friction-free |
| 4.9 | `CHANGELOG.md` — keep a visible history of changes | ✅ Done | Shows active development, builds trust |
| 4.10 | Monthly dev log / update (LinkedIn or blog) | 💡 Idea | "What I shipped on rag-starter-kit this month" — builds personal brand in parallel |

---

## What's Never Going in This Repo

These are explicit non-goals. If a PR or feature request falls into one of these categories, close it and point here.

- **Python code of any kind.** This is a TypeScript project. Period.
- **A billing or subscription system.** Not a SaaS product. Not going in.
- **No-code UI builders.** This is a developer tool. Always code-first.
- **A second language runtime.** No Bun, no Deno. Node.js.
- **Kubernetes config or Helm charts.** Out of scope for where this project is right now.
- **Docker or container orchestration.** This is a cloud-native project using managed services. No Docker.
- **General-purpose LLM framework features.** We build one thing well. We don't become LangChain.

---

## How Decisions Get Made

Before adding a new feature, ask three questions:

1. **Does this exist in VISION.md?** If the vision document doesn't support it, the answer is almost certainly no.
2. **Does this help a developer ship faster or run this more confidently in production?** If it's a nice-to-have that doesn't serve those goals, defer it.
3. **Is this Python-able?** If the only way to do it is to introduce a non-TypeScript dependency, rethink the approach.

---

*Last updated: May 2026. Maintained by [@rejisterjack](https://github.com/rejisterjack).*
