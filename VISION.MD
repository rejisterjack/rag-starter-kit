# RAG Starter Kit — Product Vision

> *This document is the north star. Every feature decision, every PR, every README edit should pass one test: does it serve this vision? If not, it doesn't ship.*

---

## The Confusion This Document Ends

Before anything else, let's name the confusion directly — because the product currently suffers from it.

**What is this thing?**

- Is it a chatbot users come to and use? No.
- Is it a framework devs import into their projects? No.
- Is it a no-code tool someone configures without writing code? No.

**It is this:**

> A developer clones this repository, uploads their documents (company policies, product docs, help articles, internal wikis, anything), and in a weekend has a fully working, production-grade AI chatbot they own 100% — deployed to their own infrastructure, using their own API keys, trained on their own knowledge base.

That's it. Nothing more, nothing less.

The developer is **the builder**. Their team, their customers, their support users — those are the end users of what gets built. This project serves the builder, not the end user of the final chatbot.

---

## The Real-World Problem

Here is a problem that happens every week, in real companies, right now:

---

**Scenario 1 — The drowning support team**

A SaaS company has 400 pages of documentation. Their support inbox receives 200 tickets per week. Of those, 140 are questions already answered in the docs. Their support team is burnt out answering the same things repeatedly. The founder knows an AI chatbot trained on the docs would cut ticket volume in half. But building one properly — with auth, file storage, background processing, real-time streaming, and something that actually survives production traffic — takes weeks. They can't afford to spend weeks on this. The tickets keep coming.

**Scenario 2 — The new employee who can't find anything**

A company has 5 years of knowledge scattered across Google Drive, Confluence, internal Notion pages, and the heads of people who've been there since the beginning. A new hire spends their first month asking "where is the X document?" and "what's our policy on Y?" The answer is always "let me find that for you" — which means the senior people are interrupted constantly. Nobody has time to build a proper internal knowledge tool. The knowledge stays inaccessible.

**Scenario 3 — The freelancer with a client request**

A freelancer gets a client: "We want an AI chatbot on our website that knows everything about our product." Without a production-ready foundation, the freelancer either says no, undercharges and struggles, or spends three weeks building infrastructure instead of the actual product. Most say no and lose the business.

**Scenario 4 — The developer who wants to learn RAG properly**

A developer is trying to break into AI engineering. Every resource they find is either a Python Jupyter notebook or a 200-line "hello world" tutorial. There is no real TypeScript codebase they can study that shows how production RAG actually works — how documents flow from upload to pgvector, how streaming SSE works end-to-end, how Inngest handles background job queues, how auth and rate limiting and analytics fit together. The learning resources don't exist for the TypeScript ecosystem. So they either learn Python (not what they want) or stay shallow.

---

These are four real, painful, recurring problems. They share a common thread:

> **People need a chatbot that knows their specific knowledge — and nobody has the time or infrastructure expertise to build one from scratch.**

---

## The Solution: Own Your AI, This Weekend

`rag-starter-kit` is the answer to all four scenarios — a production-ready, self-hosted AI knowledge base chatbot you can have running by Sunday.

**What it does:**

1. You clone the repository
2. You get two free API keys (OpenRouter + Google AI Studio — both free forever for light usage)
3. You configure a single `.env` file
4. You deploy to Vercel (one click) or run locally (`bun dev`)
5. You upload your documents — PDFs, Word files, Markdown, plain text, or paste a URL
6. You get a working, streaming AI chatbot that answers questions based exclusively on your content

The chatbot you deploy is yours — your infrastructure, your data, your API keys, zero recurring cost for the AI layer.

**What "production-ready" actually means here:**

Most tutorials stop at "it works on your laptop." This goes further. The system that comes out of a clone of this repo includes:

- Authentication (OAuth via GitHub/Google, or email/password)
- Multi-user workspaces with role-based access
- Background document processing (you upload a 200-page PDF and the app keeps running while it processes)
- Real-time streaming responses (tokens appear as they're generated, like ChatGPT)
- Source citations on every answer (the chatbot shows which document it pulled from)
- Rate limiting (your chatbot doesn't get hammered into an API bill)
- Audit logging (you know who asked what)
- One-click deploy to Vercel, Railway, or Render

This is not a demo. It's the system you'd spend three weeks building from scratch if you started today.

---

## Who This Is For (Be Specific)

### Primary User: The TypeScript Developer Who Needs to Ship a Chatbot

**They look like this:**

- They work in Next.js, NestJS, or Node.js professionally
- They've been asked to "add an AI chatbot" to something — a product, an internal tool, a client project
- They know React and TypeScript well
- They don't know Python infrastructure, don't want to learn it, and shouldn't have to
- They've looked at LangChain, LlamaIndex, RAGFlow — all Python
- They've tried piecing something together from tutorials — it works locally but they have no idea how to make it production-ready
- They don't want to pay for OpenAI before they've even shipped an MVP

**What this project gives them:**

A production-ready foundation they can clone, customise for their use case, deploy, and hand off — in a single weekend. No infrastructure decisions, no Python services, no fragile glue code.

---

### Secondary User: The Developer Learning AI Engineering

**They look like this:**

- They want to break into AI/ML engineering
- They're a TypeScript/JavaScript developer first
- They've done tutorials, but they want to see how production RAG actually works in a real codebase
- They want to understand: how do background jobs work? How does vector search work? How does streaming SSE work end-to-end?
- They want a real project to study and learn from — not a Jupyter notebook

**What this project gives them:**

A complete, working, production-grade RAG system in TypeScript they can run for free (`bun dev` + two free API keys), read from top to bottom, and use as a reference. The kind of codebase that used to require months of work and a team to build.

---

### Tertiary User: The Freelancer or Agency

**They look like this:**

- They get client requests for "AI chatbots trained on our content"
- They need a production-ready foundation, not a proof of concept
- They want to deliver a working product quickly, not spend weeks on infrastructure
- They want to be able to customise and brand it for each client

**What this project gives them:**

A billable-hours multiplier. Clone, configure, customise, deploy. What would be three weeks of infrastructure work becomes a day. The rest of the engagement can be focused on customisation, which is where real value gets created.

---

## Who This Is NOT For

This is equally important. Knowing who this is **not** for prevents scope creep and wasted effort.

- **Non-technical users.** This is a code-first developer tool. If you can't read TypeScript, use a no-code tool instead.
- **Python developers.** There are better RAG tools in the Python ecosystem (LangChain, LlamaIndex, RAGFlow). This is TypeScript-first by design.
- **People who just want to use a chatbot.** Use ChatGPT, Claude, or Perplexity. This is for builders, not users of AI.
- **Enterprise teams needing vendor SLAs.** This is open-source and self-hosted. If you need enterprise support contracts, this isn't the right tool.
- **Developers who want a no-code configuration experience.** Code-first, always. No drag-and-drop builders. No GUI workflow editors.

---

## The Identity Problem (and How to Solve It)

The current project has an identity problem because it's trying to be two things at once:

1. A **starter kit** (devs clone and build on top of it)
2. A **running application** (devs deploy and use as-is, without customising)

Both are valid use cases. But the confusion comes from not making this explicit.

### The answer: Two modes, one codebase

**Mode 1 — Deploy as-is (The "Ready to Use" path)**

Clone → configure → deploy → upload your documents → your chatbot is live.

The developer doesn't touch the code. They configure environment variables and upload documents. The chatbot they get answers questions about their content. This is the support bot use case, the internal knowledge base use case, the client chatbot use case.

**Mode 2 — Fork and customise (The "Starter Kit" path)**

Clone → study the codebase → customise the UI, the RAG pipeline, the models, the workflows → deploy something bespoke.

The developer reads the code, changes what they need, and builds something tailored to their product. This is the learning use case and the "I need something specific" use case.

**The README must make this explicit.** In the first 200 words, a developer landing on this repo must understand which path they're taking and what to do next. Currently it doesn't. That's the communication gap to fix.

---

## The Core Technical Differentiators

There are other RAG projects. Here is what makes this one worth choosing.

### 1. TypeScript All the Way Down

The entire ecosystem of production RAG tools is Python. LangChain, LlamaIndex, Haystack, RAGFlow — Python. A TypeScript/Next.js developer who wants to build a RAG chatbot has two options: introduce a Python microservice into their stack, or piece something together from shallow tutorials.

This is one of the only production-grade RAG systems built entirely in TypeScript. Same language as your frontend, your existing API routes, your type definitions. No context switching. No Python environment management. No mixed-language complexity.

### 2. Free to Run by Default

The default configuration costs $0 — not "free trial, then paid," not "free tier with severe limits":

- **Chat/LLM:** OpenRouter free models (DeepSeek, Llama, Mistral, and others — genuinely free, no credit card required)
- **Embeddings:** Google Gemini free tier — 1,500 embedding requests per day, sufficient for a real knowledge base
- **Infrastructure:** Vercel free tier for hosting, Prisma Postgres free tier for the database

A developer can run this from development through to light production without spending a dollar. This removes the biggest adoption barrier. People try things that are free. They skip things that require a credit card before they've seen anything work.

Paid providers (OpenAI, Anthropic) are opt-in — swappable per workspace, configured in environment variables.

### 3. Production Infrastructure Already Wired In

Most RAG demos are 150 lines of code. They have no auth, no file storage, no background jobs, no monitoring, no rate limiting, no tests. They stop working as soon as you try to deploy them to a real environment.

This project includes everything a production system needs — already wired in, already tested, already configured:

| What | Why it matters |
|------|----------------|
| NextAuth.js v5 with OAuth | Users can sign in with GitHub or Google — no custom auth to build |
| Inngest background jobs | Large document uploads don't block the UI — processed asynchronously |
| Cloudinary file storage | Uploaded files are stored durably in the cloud, not on a local disk |
| Upstash Redis rate limiting | Your chatbot can't be abused into API bills |
| pgvector on PostgreSQL | Vector search in the same Postgres database — no separate vector DB service |
| PostHog + Plausible analytics | You know how people use your chatbot |
| Playwright E2E tests | You can change the code and know things still work |

The work that would take three weeks to build from scratch is already done.

### 4. Real-time and Collaborative from Day One

Multi-user workspaces, typing indicators, presence tracking, and Ably WebSocket connections are not bolt-ons. They're built in from the start. A team can share a knowledge base and see each other working in it.

---

## What the Product Is Not Building (Non-Goals)

These are explicit non-goals. When a feature request falls into one of these categories, this document is the answer.

- **A no-code platform.** Code-first, always.
- **A managed SaaS product.** This is self-hosted. You own the infrastructure.
- **A Python implementation.** TypeScript-first is a feature, not a limitation.
- **A general-purpose LLM framework.** One thing, done well. Not a competitor to LangChain.
- **Kubernetes, Helm charts, or enterprise ops tooling.** Out of scope.
- **A billing or subscription system.** Open source, MIT licensed, forever.

---

## Use Case Scenarios (How Real People Actually Use This)

These are the concrete scenarios this project is built to serve. They should be in the README. They should be in the demo. They should be the first thing a developer reads.

### Support Documentation Bot

A SaaS product has hundreds of help articles. 70% of support tickets are questions already answered in the docs. A developer clones this project, indexes all the help articles, and deploys it. Now there's a chatbot on the support page that answers questions instantly, with source citations. The support team handles only the genuinely complex issues. Setup time: one weekend.

### Internal Company Knowledge Base

Years of company knowledge lives in Google Drive, Confluence, and scattered Notion pages. New employees spend weeks just trying to find things. A developer on the team clones this project, indexes the documents, and deploys an internal tool. Now any employee can ask "what's our refund policy?" or "how do we onboard a new enterprise client?" and get an answer in seconds, with a link to the source document. Setup time: one weekend.

### Client Chatbot (Freelancer Use Case)

A client asks a freelancer to build an AI chatbot for their website trained on their product documentation. The freelancer clones this project, customises the branding, indexes the client's content, and deploys it. What would otherwise take three weeks of infrastructure work takes a day. Billable time is spent on client value, not reinventing infrastructure.

### Research Assistant

A researcher or analyst has a large collection of PDFs — academic papers, reports, industry documents. They need to query across all of it, find specific information, and get cited answers. They clone this project, upload their document library, and have a personal research assistant that can answer questions across hundreds of documents in seconds. Setup time: two hours.

### Developer Learning Production RAG

A TypeScript developer wants to understand how production RAG systems work. They clone this project, run it locally with `bun dev` and two free API keys, and spend time reading the code: how Inngest queues and processes document ingestion, how pgvector stores and retrieves embeddings, how streaming SSE works end-to-end, how auth and rate limiting and analytics fit together. A real production codebase to learn from, for free.

---

## The /chat Page Confusion (Resolved)

The current project has a dedicated `/chat` page inside the application. This confuses new developers landing on the repo. Is the app the product? Are they supposed to run the chat for their own use?

**Clarification:**

The `/chat` page is the interface that the **builder's end users** interact with after deployment. It is not the developer's product — it's the thing the developer ships to their users. Think of it like the template pages in a CMS: the developer sees it during setup, but it's designed for the final users.

The README and onboarding must make this distinction crystal clear:

> "When you deploy this, your users will chat at `/chat`. You manage the knowledge base from `/admin`. This is what your users see. This is what you see."

That single clarification eliminates most of the confusion.

---

## Design Principles

**1. Production-first, not demo-first.**
Every feature is built the way it would ship in a real product. If something wouldn't survive production, it doesn't go in.

**2. Free by default.**
The zero-cost configuration is not a compromise — it's the feature. Developers who can run something for free will try it. Developers who have to pull out a credit card before they've seen anything work will not.

**3. TypeScript all the way down.**
No Python, no shell script hacks, no mixed-language workarounds. If it can't be done in TypeScript, find a TypeScript-native way.

**4. Zero-config start, full-config depth.**
Running it locally should take under 10 minutes with no prior knowledge of RAG. Customising every pipeline parameter should be possible without touching core logic.

**5. The README is a product.**
A developer landing on this repo should be able to understand what it is, understand which path they're taking (deploy as-is vs. customise), and be running it — within 30 minutes. Confusion is a bug.

**6. Observability from day one.**
Analytics, audit logging, error monitoring, and rate limiting are not afterthoughts. They're built in because production systems need them on day one.

**7. One thing, done exceptionally well.**
The goal is not to be the most feature-complete RAG project. It's to be the best starting point for a TypeScript developer who needs to ship a real chatbot to real users. Depth over breadth.

---

## What Success Looks Like

**3 months:**
- A developer can land on this repo, understand it in 5 minutes, and have a running chatbot in under 30 minutes
- At least 3 documented real-world deployments (support bots, internal tools, client projects)
- 200+ GitHub stars from organic traffic
- The README makes the "deploy as-is vs. customise" distinction crystal clear
- One published technical article explaining the architecture that ranks in search

**6 months:**
- 500+ GitHub stars
- Developers in public forums (Reddit, Twitter/X, LinkedIn) sharing that they shipped a client chatbot with this
- The embeddable widget shipped — devs can embed the chatbot on any site with a `<script>` tag
- Listed in at least one "awesome-selfhosted" or "awesome-llm" curated list

**12 months:**
- The reference implementation for TypeScript RAG — the way `create-t3-app` is the reference for the T3 stack
- Used in portfolios and technical interviews by developers who learned production RAG from this codebase
- An active contributor community building integrations (Notion connector, GitHub connector, etc.)

---

## Positioning Statement

For TypeScript developers who need to add a document-aware AI chatbot to their product, their client's website, or their company's internal tools — `rag-starter-kit` is the only open-source project that gives you a production-ready, deployable chatbot in a single weekend.

Unlike Python-based tools (LangChain, LlamaIndex, RAGFlow) that require leaving the TypeScript ecosystem, unlike minimal templates that stop at "works on my machine," and unlike managed SaaS products that own your data and charge monthly — this is TypeScript-native, self-hosted, costs nothing to run, and ships with everything a real production system needs already built in.

You own the code. You own the data. You own the infrastructure.

---

## One-Line Summary

**The fastest way for a TypeScript developer to go from "I have documents" to "I have a production chatbot" — in one weekend, at zero cost.**

---

*Last updated: October 2026. Maintained by [@rejisterjack](https://github.com/rejisterjack).*
