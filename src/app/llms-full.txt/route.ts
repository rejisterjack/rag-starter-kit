import { logger } from '@/lib/logger';
import { DOCS_PAGES, LANDING_PAGES, SITE, STACK_FACTS } from '@/lib/seo/content-registry';

export const dynamic = 'force-static';

/**
 * llms-full.txt — complete flattened site content for LLM ingestion.
 * Docs pages are curated summaries keyed to the registry; each section links to
 * the canonical HTML page for the interactive version.
 */
export function GET() {
  const sectionContent: Record<string, string> = {
    '/docs/getting-started/installation': `Prerequisites: Node.js 20+ or Bun 1.2+, PostgreSQL 16 with the pgvector extension, a Gemini or OpenRouter API key (free tiers work).

\`\`\`bash
git clone https://github.com/rejisterjack/rag-starter-kit.git
cd rag-starter-kit
bun install
cp .env.example .env
bun run db:migrate
bun run db:seed
bun run dev
\`\`\`

The dev server runs on port 7392. Enable the pgvector extension in your database first: \`CREATE EXTENSION IF NOT EXISTS vector;\`. All required environment variables are documented in .env.example.`,
    '/docs/getting-started/configuration': `Primary environment variables:

- DATABASE_URL — PostgreSQL connection string (pgvector enabled)
- AUTH_SECRET — session signing key (required in production)
- OPENROUTER_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY — free-tier LLM access
- GEMINI_API_KEY or OPENAI_API_KEY — embeddings (Gemini free tier: 1,500 req/day)
- NEXT_PUBLIC_APP_URL — canonical site URL used for metadata and sitemap
- SENTRY_DSN — optional error tracking
- NEXT_PUBLIC_POSTHOG_KEY — optional product analytics

Embedding and chat providers are swappable per workspace via the RAG settings UI.`,
    '/docs/getting-started/quick-start': `Five-minute path to a working chatbot:

1. Clone and install (see Installation).
2. Set DATABASE_URL and one free AI key in .env.
3. Run migrations and seed data.
4. Open http://localhost:7392, register an account, and create a workspace.
5. Upload a PDF or DOCX; documents are chunked, embedded, and stored in pgvector via Inngest background jobs.
6. Ask a question — answers stream token-by-token over SSE with inline citations.`,
    '/docs/api/chat': `POST /api/chat — streaming RAG chat.

Request: { "message": string, "workspaceId": string, options?: { model?, temperature?, topK?, filters? } }.
Response: text/event-stream with token deltas and a final sources array (document title, chunk index, score).
Auth: session cookie or X-API-Key. Rate-limited per user.`,
    '/docs/api/documents': `Endpoints:

- POST /api/ingest — multipart upload (PDF, DOCX, TXT, MD); triggers the Inngest processing pipeline (parse → chunk → embed → upsert pgvector).
- GET /api/documents — list workspace documents with status.
- DELETE /api/documents/{id} — delete document and its vectors.
- POST /api/webhooks/deploy — webhook URL ingestion of arbitrary documents.

All endpoints require authentication and workspace membership.`,
    '/docs/api/embeddings': `POST /api/public/ingest and internal embedding pipeline.

Default provider: Google Gemini text-embedding (free tier, 1,500 requests/day). OpenAI-compatible endpoints are supported by setting OPENAI_API_KEY. Dimension must match the pgvector column (1536 by default); switching providers after ingestion requires re-embedding existing documents.`,
    '/docs/guides/embedding-providers': `Swappable embedding providers: Google Gemini (free tier), OpenAI, and any OpenAI-compatible endpoint (Ollama, Azure, self-hosted). Configure per workspace in Settings → RAG. Re-embed documents after changing dimensions or models — vectors with mismatched dimensions are rejected by pgvector.`,
    '/docs/guides/llm-providers': `Chat providers, all via the Vercel AI SDK: OpenRouter (default; free models include Gemma, Llama, GPT-OSS, Hermes), Google Gemini, OpenAI, Anthropic, and local Ollama. Bring-your-own-key per workspace. Streaming works identically across providers through a single SSE contract.`,
    '/docs/guides/deployment': `Targets: Vercel (recommended; standalone output, 2-minute deploy), Railway, Docker, and any Node 20+ host. Run \`bun run build\` then \`bun run start\`, or use the standalone output in ./next. Apply migrations with \`bun run db:migrate:prod\`. Set NEXT_PUBLIC_APP_URL to the production origin so canonical URLs, sitemap, and OG tags resolve correctly.`,
    '/docs/guides/authentication': `NextAuth v5 with credentials, GitHub and Google OAuth, TOTP MFA, and SAML SSO (workspace-scoped). Roles: USER, MEMBER, ADMIN, OWNER with workspace-scoped RBAC. Session cookies are httpOnly; API routes also accept X-API-Key with workspace-scoped permissions.`,
    '/docs/guides/chrome-extension': `A bundled Manifest V3 Chrome extension provides inline RAG chat on any webpage. Load extensions/chrome as an unpacked extension, configure the server URL and API key in options, and use the side panel to chat with your workspace documents while browsing.`,
    '/docs/reference/environment-variables': `Full variable list with defaults is maintained in .env.example. Critical ones: DATABASE_URL, AUTH_SECRET, NEXT_PUBLIC_APP_URL, provider keys, and optional integrations (Cloudinary, Ably, Inngest, Sentry, PostHog).`,
    '/docs/reference/database-schema': `Prisma 7 models include User, Workspace, Membership, Document, Chunk (with pgvector embedding column), Conversation, Message, Feedback, ApiKey, AuditLog, Webhook, and IngestJob. Vector search uses a raw SQL function (src/lib/db/sql/vector-search.sql) for ANN queries with HNSW indexing.`,
    '/docs/reference/rbac-permissions': `Roles per workspace: OWNER (all), ADMIN (manage members, settings, keys), MEMBER (chat, upload, read docs), USER (chat only). Permissions are enforced in middleware and per-route; audit logs record all admin actions.`,
  };

  const lines: string[] = [];

  lines.push(`# ${SITE.name} — Full Content`);
  lines.push('');
  lines.push(`> ${SITE.tagline}. ${SITE.description}`);
  lines.push('');
  lines.push('## Facts');
  lines.push('');
  for (const fact of STACK_FACTS) {
    lines.push(`- ${fact}`);
  }
  lines.push('');

  for (const page of LANDING_PAGES) {
    if (page.path === '/blog') continue;
    lines.push(`## ${page.title}`);
    lines.push(`Source: ${SITE.url}${page.path}`);
    lines.push('');
    lines.push(page.description);
    lines.push('');
  }

  for (const page of DOCS_PAGES) {
    lines.push(`## ${page.title}`);
    lines.push(`Source: ${SITE.url}${page.path}`);
    lines.push('');
    lines.push(sectionContent[page.path] ?? page.description);
    lines.push('');
  }

  const body = lines.join('\n');

  logger.info('llms-full.txt served', { bytes: body.length });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
