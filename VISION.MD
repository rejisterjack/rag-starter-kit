# rag-starter-kit — Product Vision

> *This document defines what we are building, why it exists, who it's for, and what success looks like. When in doubt about a feature, a decision, or a direction — come back here.*

---

## The One-Line Version

**The TypeScript-native, self-hostable RAG platform for developers who build products — not experiments. And it costs nothing to run.**

---

## The Problem

Every serious developer building an AI product eventually needs a RAG system. And every one of them runs into the same wall.

The ecosystem is almost entirely Python. LangChain, LlamaIndex, Haystack, RAGFlow — all Python. If you're a TypeScript/Node.js developer building a Next.js product, you're either forced to introduce a Python service into your stack, or you piece together something fragile from tutorials that don't account for production realities like background job queues, real-time streaming, multi-user state, error monitoring, or deployment.

The tutorials show you how to build a RAG chatbot. None of them show you how to run one.

And then there's the cost problem. Almost every RAG tutorial assumes you're paying for OpenAI. For a developer learning, experimenting, or building a side project — that's a real barrier. Most people give up before they've shipped anything.

---

## The Solution

`rag-starter-kit` is a production-ready RAG platform built entirely in TypeScript and Next.js, with **zero required API costs** — built on OpenRouter free models and Google Gemini's free embedding tier.

You clone it, configure it with two free API keys, and deploy it. You get a real, working chatbot backed by your own documents, running on your own infrastructure, at no cost.

No Python. No paid API keys. No tutorial shortcuts. No fragile glue code.

Everything a production system needs is already wired in: streaming responses, voice I/O, background job processing, multi-user workspaces, file storage, authentication, rate limiting, observability, and one-click deployment to Vercel.

The core stays open source forever. Developers who want to self-host own it completely.

---

## The Core Differentiator

**TypeScript-first, production-ready, self-hostable, and free to run.**

This is the combination no other open-source RAG project offers:

**1. TypeScript all the way down.**
Most RAG tools are Python. This is one of the very few production-grade RAG systems built entirely in the TypeScript/Node.js ecosystem. Next.js 15, React 19, LangChain.js, Prisma, Inngest — no context switching, no Python services, no mixed-language complexity.

**2. Zero-cost AI stack by default.**
- Chat/LLM: OpenRouter free models (DeepSeek, Mistral, Llama, Gemma)
- Embeddings: Google Gemini free tier (1,500 requests/day)
- Cost to run in development and light production: $0

This removes the biggest barrier to adoption. Developers try things that are free. They skip things that require a credit card.

**3. Production infrastructure already wired in.**
Most RAG demos are 200 lines of code with no auth, no file storage, no background jobs, no monitoring. This has all of it — NextAuth.js v5, MinIO/S3, Inngest, PostHog, Plausible, Upstash rate limiting, audit logging, Playwright E2E tests. It's the project you'd spend three weeks building from scratch.

**4. Real-time and collaborative from the start.**
Multi-user workspaces, typing indicators, presence tracking, WebSocket/SSE — not bolted on later. Built in from day one.

---

## Who This Is For

**Primary: The TypeScript/Node.js developer building a product.**

Someone working in Next.js, NestJS, or Node.js who needs to add AI chat capabilities to their product or build a standalone AI assistant. They know React, they know TypeScript, they don't want to learn Python infra to ship a chatbot — and they don't want to pay OpenAI before they've even shipped an MVP.

**Secondary: The developer who wants to learn how production RAG works.**

Someone studying AI engineering who wants a real codebase — not a Jupyter notebook, not a 200-line tutorial. They want to see how Inngest handles background document ingestion, how pgvector stores embeddings, how streaming SSE works end to end, how auth, analytics, and rate limiting fit into an AI product. And they want to run all of it for free while they learn.

---

## Who This Is NOT For

- Python developers — there are better tools in their ecosystem
- Non-technical users looking for a no-code chatbot builder
- Anyone who just wants to use an AI chatbot — use ChatGPT
- Enterprise teams needing vendor SLAs and compliance documentation out of the box

---

## The Feature Set (What We're Building)

### Foundation (Already Built)
- RAG pipeline: document ingestion → chunking → embedding → vector storage → retrieval → generation
- Real-time streaming responses via SSE
- Multi-user workspaces with presence and typing indicators
- Voice input and output (Web Speech API + Whisper)
- Background document processing via Inngest
- MinIO/S3-compatible file storage
- pgvector on Postgres via Prisma 7
- NextAuth.js v5 with OAuth (GitHub, Google)
- Rate limiting via Upstash Redis
- PostHog + Plausible analytics (self-hosted)
- Audit logging
- Playwright E2E tests + Vitest unit tests
- CI/CD via GitHub Actions
- One-click Vercel/Railway/Render deploy
- Full Docker Compose local stack
- PWA support

### Near-Term (Next 3 Months)
- **Admin dashboard** — upload documents, view ingestion status, manage knowledge bases, see usage stats
- **Multi-LLM switching** — Anthropic Claude and Ollama support, in addition to OpenRouter
- **Ingestion progress UI** — real-time progress as large documents are processed
- **Duplicate detection** — don't re-ingest a file that's already indexed
- **Configurable retrieval** — chunk size, overlap, top-k, similarity threshold all via env vars

### Medium-Term (3–6 Months)
- **Embeddable chat widget** — a `<script>` tag that adds the chatbot to any website
- **Webhook ingestion** — POST a URL, the system fetches, parses, and indexes it
- **Evaluation tooling** — retrieval accuracy scoring so developers can measure RAG quality
- **Multi-tenancy** — multiple isolated knowledge bases from a single deployment

### Long-Term (6+ Months)
- **Connector ecosystem** — Notion, GitHub, Google Drive, Confluence, Slack
- **Agent mode** — tools: search the web, query a database, call an API
- **Multi-modal ingestion** — images, audio files, YouTube transcripts
- **npm widget package** — `@rejisterjack/rag-widget` for embedding anywhere

---

## What We Are NOT Building

- **A no-code platform.** Code-first, always.
- **A managed SaaS product.** No billing, no subscriptions.
- **A Python implementation.** TypeScript-first is a feature, not a limitation.
- **A general-purpose AI framework.** We build one thing well. We are not competing with LangChain.
- **Kubernetes or enterprise ops tooling.** Out of scope for now.

---

## Design Principles

**1. Production-first, not demo-first.**
Every feature gets built the way it would ship in a real product.

**2. Free by default.**
The default configuration should cost the developer nothing. Paid tiers are opt-in, not required.

**3. TypeScript all the way down.**
No Python, no shell script hacks, no mixed-language workarounds.

**4. Zero-config start, full-config depth.**
Running it locally should take under 10 minutes. Customizing every parameter should be possible without touching core logic.

**5. Observability from day one.**
PostHog, Plausible, audit logging, and rate limiting are not afterthoughts.

**6. The README is a product.**
A developer landing on this repo should be able to understand it, run it, and start customizing it — within 30 minutes.

**7. Slow, meaningful commits over fast, breaking ones.**
One solid feature every few weeks beats ten half-finished ones.

---

## What Success Looks Like

**3 months:** 200+ GitHub stars, flagship article published, admin dashboard shipped, zero broken links or placeholders in the repo.

**6 months:** 500+ GitHub stars, developers forking it for real products, embeddable widget shipped, listed in at least one "awesome-selfhosted" or "awesome-llm" curated list.

**12 months:** The go-to reference implementation for TypeScript RAG systems — the way `create-t3-app` is for the T3 stack. Used in interviews and portfolios by other developers who learned from it.

---

## The Repository Identity

**GitHub:** `github.com/rejisterjack/rag-starter-kit`

**Topics:** `rag` `langchain` `nextjs` `typescript` `pgvector` `self-hosted` `chatbot` `openrouter` `free-ai` `inngest` `voice-ai` `docker`

**One-line description:** Production-ready TypeScript RAG chatbot — free AI, streaming, voice, multi-user, self-hostable, one-click Vercel deploy.

**License:** MIT — free to use, fork, and build on. Always.

---

## The Positioning Statement

For TypeScript developers who need to add RAG capabilities to their product, `rag-starter-kit` is the only open-source platform that gives you a production-ready starting point — with streaming, voice, authentication, background processing, and observability already wired in — without leaving the Node.js ecosystem and without paying for AI APIs to get started.

Unlike Python-based alternatives like LangChain or RAGFlow, and unlike minimal templates that stop at "it works on my machine," this is built for developers who think in TypeScript, deploy on Vercel or Node.js infrastructure, and want something they can ship to real users from day one.

---

*Last updated: May 2026. Maintained by [@rejisterjack](https://github.com/rejisterjack).*
